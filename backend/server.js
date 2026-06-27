require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const { testConnection } = require('./config/db');
const authRoutes = require('./routes/auth');
const vehicleRoutes = require('./routes/vehicles');
const interestRoutes = require('./routes/interests');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: (process.env.CORS_ORIGIN || '*').split(','),
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded vehicle photos. In production, prefer S3 + CloudFront
// instead of serving files from the backend EC2 disk.
app.use('/uploads', express.static(path.join(__dirname, process.env.UPLOAD_DIR || 'uploads')));

// Health check for the internal/external load balancer target group
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/interests', interestRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

// Generic error handler (e.g. multer file errors)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Something went wrong.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`Backend API running on port ${PORT}`);
  await testConnection();
});
