const crypto = require('crypto');

/**
 * Generates a cryptographically random 6-digit OTP for password reset.
 * Only the hash is stored in the database.
 *
 * @returns {{ code: string, hashedCode: string, expires: Date }}
 */
const generateOtp = () => {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  return { code, hashedCode, expires };
};

/**
 * Hashes a submitted OTP code for comparison against the stored hash.
 *
 * @param {string} code
 * @returns {string} SHA-256 hex digest
 */
const hashOtp = (code) => {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
};

module.exports = { generateOtp, hashOtp };
