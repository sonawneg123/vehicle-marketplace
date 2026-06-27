const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ---------------------------------------------------------------------
// Photo upload setup (multer). In production swap this for S3 storage
// and store the S3 URL in vehicle_photos.photo_url instead.
// ---------------------------------------------------------------------
const uploadDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `vehicle_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per photo
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, or WEBP photos are allowed.'));
  }
});

// ---------------------------------------------------------------------
// GET /api/vehicles
// Public list of available vehicles, with simple filters + pagination.
// Query: ?brand=&vehicle_type=&min_price=&max_price=&city=&page=&limit=
// ---------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { brand, vehicle_type, min_price, max_price, city, page = 1, limit = 12 } = req.query;
    const conditions = ["v.status = 'available'"];
    const params = [];

    if (brand) { conditions.push('v.brand LIKE ?'); params.push(`%${brand}%`); }
    if (vehicle_type) { conditions.push('v.vehicle_type = ?'); params.push(vehicle_type); }
    if (min_price) { conditions.push('v.price >= ?'); params.push(Number(min_price)); }
    if (max_price) { conditions.push('v.price <= ?'); params.push(Number(max_price)); }
    if (city) { conditions.push('v.city LIKE ?'); params.push(`%${city}%`); }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

    const [rows] = await pool.query(
      `SELECT v.*, 
              (SELECT photo_url FROM vehicle_photos p WHERE p.vehicle_id = v.id ORDER BY is_primary DESC, p.id ASC LIMIT 1) AS primary_photo
       FROM vehicles v
       ${whereClause}
       ORDER BY v.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    res.json({ vehicles: rows });
  } catch (err) {
    console.error('List vehicles error:', err);
    res.status(500).json({ message: 'Could not load vehicles right now.' });
  }
});

// ---------------------------------------------------------------------
// GET /api/vehicles/:id
// Full detail of one vehicle, including all photos and seller name.
// ---------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const [[vehicle]] = await pool.query(
      `SELECT v.*, u.full_name AS seller_name, u.city AS seller_city
       FROM vehicles v
       JOIN users u ON u.id = v.seller_id
       WHERE v.id = ?`,
      [req.params.id]
    );
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found.' });

    const [photos] = await pool.query(
      'SELECT id, photo_url, is_primary FROM vehicle_photos WHERE vehicle_id = ? ORDER BY is_primary DESC, id ASC',
      [req.params.id]
    );

    res.json({ vehicle, photos });
  } catch (err) {
    console.error('Get vehicle error:', err);
    res.status(500).json({ message: 'Could not load this vehicle right now.' });
  }
});

// ---------------------------------------------------------------------
// POST /api/vehicles
// Create a new listing. Requires login. Accepts up to 6 photos.
// ---------------------------------------------------------------------
router.post('/', requireAuth, upload.array('photos', 6), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const {
      title, vehicle_type, brand, model, manufacture_year, price,
      fuel_type, transmission, kms_driven, owners_count,
      registration_no, city, description
    } = req.body;

    if (!title || !brand || !model || !manufacture_year || !price) {
      return res.status(400).json({ message: 'Title, brand, model, year, and price are required.' });
    }

    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO vehicles
        (seller_id, title, vehicle_type, brand, model, manufacture_year, price,
         fuel_type, transmission, kms_driven, owners_count, registration_no, city, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, title, vehicle_type || 'car', brand, model, manufacture_year, price,
        fuel_type || 'petrol', transmission || 'manual', kms_driven || 0, owners_count || 1,
        registration_no || null, city || null, description || null
      ]
    );

    const vehicleId = result.insertId;

    if (req.files && req.files.length > 0) {
      const photoRows = req.files.map((f, idx) => [vehicleId, `/uploads/${f.filename}`, idx === 0 ? 1 : 0]);
      await conn.query(
        'INSERT INTO vehicle_photos (vehicle_id, photo_url, is_primary) VALUES ?',
        [photoRows]
      );
    }

    await conn.commit();
    res.status(201).json({ message: 'Vehicle listed for sale.', vehicleId });
  } catch (err) {
    await conn.rollback();
    console.error('Create vehicle error:', err);
    res.status(500).json({ message: 'Could not save your listing. Please try again.' });
  } finally {
    conn.release();
  }
});

// ---------------------------------------------------------------------
// GET /api/vehicles/mine/listings
// All listings created by the logged-in user (seller dashboard).
// ---------------------------------------------------------------------
router.get('/mine/listings', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT v.*,
              (SELECT photo_url FROM vehicle_photos p WHERE p.vehicle_id = v.id ORDER BY is_primary DESC, p.id ASC LIMIT 1) AS primary_photo,
              (SELECT COUNT(*) FROM buy_requests b WHERE b.vehicle_id = v.id) AS interest_count
       FROM vehicles v
       WHERE v.seller_id = ?
       ORDER BY v.created_at DESC`,
      [req.user.id]
    );
    res.json({ vehicles: rows });
  } catch (err) {
    console.error('My listings error:', err);
    res.status(500).json({ message: 'Could not load your listings.' });
  }
});

// ---------------------------------------------------------------------
// PATCH /api/vehicles/:id/status
// Seller marks their own vehicle as sold / available / inactive.
// ---------------------------------------------------------------------
router.patch('/:id/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['available', 'sold', 'inactive'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }

    const [[vehicle]] = await pool.query('SELECT seller_id FROM vehicles WHERE id = ?', [req.params.id]);
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found.' });
    if (vehicle.seller_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only update your own listings.' });
    }

    await pool.query('UPDATE vehicles SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ message: 'Listing updated.' });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ message: 'Could not update the listing.' });
  }
});

module.exports = router;
