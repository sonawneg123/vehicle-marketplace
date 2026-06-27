const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ---------------------------------------------------------------------
// POST /api/interests
// Buyer clicks "Buy" / "I'm interested" on a vehicle.
// Body: { vehicle_id, message?, offer_price? }
// ---------------------------------------------------------------------
router.post('/', requireAuth, async (req, res) => {
  try {
    const { vehicle_id, message, offer_price } = req.body;
    if (!vehicle_id) {
      return res.status(400).json({ message: 'vehicle_id is required.' });
    }

    const [[vehicle]] = await pool.query(
      'SELECT id, seller_id, status FROM vehicles WHERE id = ?',
      [vehicle_id]
    );
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found.' });
    if (vehicle.seller_id === req.user.id) {
      return res.status(400).json({ message: 'You cannot buy your own listing.' });
    }
    if (vehicle.status !== 'available') {
      return res.status(400).json({ message: 'This vehicle is no longer available.' });
    }

    await pool.query(
      `INSERT INTO buy_requests (vehicle_id, buyer_id, seller_id, message, offer_price)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE message = VALUES(message), offer_price = VALUES(offer_price)`,
      [vehicle_id, req.user.id, vehicle.seller_id, message || null, offer_price || null]
    );

    res.status(201).json({ message: 'Your interest has been sent to the seller.' });
  } catch (err) {
    console.error('Create buy request error:', err);
    res.status(500).json({ message: 'Could not send your interest. Please try again.' });
  }
});

// ---------------------------------------------------------------------
// GET /api/interests/received
// SELLER VIEW: every buy request on the seller's own vehicles, with
// the buyer's contact details visible (this is the core "seller can
// see who wants to buy" feature).
// ---------------------------------------------------------------------
router.get('/received', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
          b.id AS request_id, b.message, b.offer_price, b.status, b.created_at,
          v.id AS vehicle_id, v.title AS vehicle_title, v.price AS vehicle_price,
          u.id AS buyer_id, u.full_name AS buyer_name,
          u.email AS buyer_email, u.mobile_number AS buyer_mobile, u.city AS buyer_city
       FROM buy_requests b
       JOIN vehicles v ON v.id = b.vehicle_id
       JOIN users u ON u.id = b.buyer_id
       WHERE b.seller_id = ?
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    res.json({ requests: rows });
  } catch (err) {
    console.error('Received interests error:', err);
    res.status(500).json({ message: 'Could not load buyer requests.' });
  }
});

// ---------------------------------------------------------------------
// GET /api/interests/sent
// BUYER VIEW: every vehicle the logged-in user has expressed interest
// in, along with the status the seller has set.
// ---------------------------------------------------------------------
router.get('/sent', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
          b.id AS request_id, b.message, b.offer_price, b.status, b.created_at,
          v.id AS vehicle_id, v.title AS vehicle_title, v.price AS vehicle_price,
          s.full_name AS seller_name
       FROM buy_requests b
       JOIN vehicles v ON v.id = b.vehicle_id
       JOIN users s ON s.id = b.seller_id
       WHERE b.buyer_id = ?
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    res.json({ requests: rows });
  } catch (err) {
    console.error('Sent interests error:', err);
    res.status(500).json({ message: 'Could not load your interests.' });
  }
});

// ---------------------------------------------------------------------
// PATCH /api/interests/:id/status
// Seller accepts / rejects / completes a buy request.
// ---------------------------------------------------------------------
router.patch('/:id/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'accepted', 'rejected', 'completed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }

    const [[request]] = await pool.query('SELECT seller_id, vehicle_id FROM buy_requests WHERE id = ?', [req.params.id]);
    if (!request) return res.status(404).json({ message: 'Request not found.' });
    if (request.seller_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only act on requests for your own listings.' });
    }

    await pool.query('UPDATE buy_requests SET status = ? WHERE id = ?', [status, req.params.id]);

    if (status === 'completed') {
      await pool.query('UPDATE vehicles SET status = "sold" WHERE id = ?', [request.vehicle_id]);
    }

    res.json({ message: 'Request updated.' });
  } catch (err) {
    console.error('Update request status error:', err);
    res.status(500).json({ message: 'Could not update this request.' });
  }
});

module.exports = router;
