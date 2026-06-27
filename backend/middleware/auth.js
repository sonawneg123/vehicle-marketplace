const jwt = require('jsonwebtoken');

// Verifies the Bearer token sent by the React frontend and attaches
// the decoded user (id, email, mobile) to req.user.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'You need to log in to do that.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Your session has expired. Please log in again.' });
  }
}

module.exports = { requireAuth };
