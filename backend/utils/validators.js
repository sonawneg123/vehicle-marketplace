const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_REGEX = /^[6-9]\d{9}$/; // 10-digit Indian mobile number, adjust if needed

function isEmail(value) {
  return typeof value === 'string' && EMAIL_REGEX.test(value.trim());
}

function isMobile(value) {
  return typeof value === 'string' && MOBILE_REGEX.test(value.trim());
}

function isStrongEnoughPassword(value) {
  return typeof value === 'string' && value.length >= 6;
}

// Accepts either an email or a mobile number as the login identifier
// and tells the caller which one it is.
function detectIdentifierType(identifier) {
  if (isEmail(identifier)) return 'email';
  if (isMobile(identifier)) return 'mobile';
  return null;
}

module.exports = {
  isEmail,
  isMobile,
  isStrongEnoughPassword,
  detectIdentifierType
};
