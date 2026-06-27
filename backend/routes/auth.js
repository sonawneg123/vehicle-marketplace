const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { isEmail, isMobile, isStrongEnoughPassword, detectIdentifierType } = require('../utils/validators');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, full_name: user.full_name, email: user.email, mobile_number: user.mobile_number },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// ---------------------------------------------------------------------
// POST /api/auth/signup
// Body: { full_name, email?, mobile_number?, password, city? }
// At least one of email / mobile_number is required.
// ---------------------------------------------------------------------
router.post('/signup', async (req, res) => {
  try {
    const { full_name, email, mobile_number, password, city } = req.body;

    if (!full_name || !password) {
      return res.status(400).json({ message: 'Name and password are required.' });
    }
    if (!email && !mobile_number) {
      return res.status(400).json({ message: 'Provide an email or a mobile number to sign up.' });
    }
    if (email && !isEmail(email)) {
      return res.status(400).json({ message: 'That email address does not look valid.' });
    }
    if (mobile_number && !isMobile(mobile_number)) {
      return res.status(400).json({ message: 'Enter a valid 10-digit mobile number.' });
    }
    if (!isStrongEnoughPassword(password)) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    // Check for existing account
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE (email IS NOT NULL AND email = ?) OR (mobile_number IS NOT NULL AND mobile_number = ?) LIMIT 1',
      [email || null, mobile_number || null]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: 'An account with that email or mobile number already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      'INSERT INTO users (full_name, email, mobile_number, password_hash, city) VALUES (?, ?, ?, ?, ?)',
      [full_name, email || null, mobile_number || null, passwordHash, city || null]
    );

    const user = {
      id: result.insertId,
      full_name,
      email: email || null,
      mobile_number: mobile_number || null
    };

    const token = signToken(user);
    res.status(201).json({ message: 'Account created.', token, user });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Something went wrong while creating your account.' });
  }
});

// ---------------------------------------------------------------------
// POST /api/auth/login
// Body: { identifier, password }  -- identifier can be email OR mobile
// ---------------------------------------------------------------------
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Enter your email or mobile number and password.' });
    }

    const type = detectIdentifierType(identifier);
    if (!type) {
      return res.status(400).json({ message: 'Enter a valid email address or 10-digit mobile number.' });
    }

    const column = type === 'email' ? 'email' : 'mobile_number';
    const [rows] = await pool.query(
      `SELECT * FROM users WHERE ${column} = ? AND is_active = 1 LIMIT 1`,
      [identifier.trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'No account found with those details.' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Incorrect password.' });
    }

    const token = signToken(user);
    res.json({
      message: 'Logged in.',
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        mobile_number: user.mobile_number,
        city: user.city
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Something went wrong while logging you in.' });
  }
});

module.exports = router;
