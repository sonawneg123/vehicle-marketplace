const mysql = require('mysql2/promise');
require('dotenv').config();

// Connection pool to the RDS MySQL instance.
// Using a pool (instead of a single connection) lets the backend EC2
// handle many concurrent requests without exhausting connections.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true
});

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('Connected to RDS MySQL successfully');
    conn.release();
  } catch (err) {
    console.error('Failed to connect to RDS MySQL:', err.message);
  }
}

module.exports = { pool, testConnection };
