const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Generate a secure JWT secret if not provided
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRY = process.env.JWT_EXPIRY || '15d'; // 15 days default
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '30d'; // 30 days for refresh

/**
 * Generate JWT access token
 * @param {Object} payload - User data to include in token
 * @param {string} payload.userId - User ID
 * @param {string} payload.email - User email
 * @param {string} payload.name - User name
 * @returns {string} JWT token
 */
function generateAccessToken(payload) {
  return jwt.sign(
    {
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
      type: 'access'
    },
    JWT_SECRET,
    { 
      expiresIn: JWT_EXPIRY,
      issuer: 'settlelah',
      audience: 'settlelah-users'
    }
  );
}

/**
 * Generate JWT refresh token
 * @param {Object} payload - User data to include in token
 * @param {string} payload.userId - User ID
 * @returns {string} JWT refresh token
 */
function generateRefreshToken(payload) {
  return jwt.sign(
    {
      userId: payload.userId,
      type: 'refresh'
    },
    JWT_SECRET,
    { 
      expiresIn: REFRESH_TOKEN_EXPIRY,
      issuer: 'settlelah',
      audience: 'settlelah-users'
    }
  );
}

/**
 * Verify and decode JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Decoded token payload or null if invalid
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'settlelah',
      audience: 'settlelah-users'
    });
  } catch (error) {
    console.error('JWT verification failed:', error.message);
    return null;
  }
}

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} Extracted token or null
 */
function extractTokenFromHeader(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * JWT Authentication middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required',
      code: 'TOKEN_MISSING'
    });
  }

  const decoded = verifyToken(token);
  if (!decoded || decoded.type !== 'access') {
    return res.status(401).json({ 
      error: 'Invalid or expired token',
      code: 'TOKEN_INVALID'
    });
  }

  // Add user info to request object
  req.user = {
    userId: decoded.userId,
    email: decoded.email,
    name: decoded.name
  };

  next();
}

/**
 * Optional JWT Authentication middleware (doesn't fail if no token)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function optionalAuthenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = extractTokenFromHeader(authHeader);

  if (token) {
    const decoded = verifyToken(token);
    if (decoded && decoded.type === 'access') {
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        name: decoded.name
      };
    }
  }

  next();
}

/**
 * Check if JWT secret is using default (insecure) value
 * @returns {boolean} True if using default secret
 */
function isUsingDefaultSecret() {
  return !process.env.JWT_SECRET;
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  extractTokenFromHeader,
  authenticateJWT,
  optionalAuthenticateJWT,
  isUsingDefaultSecret,
  JWT_SECRET: isUsingDefaultSecret() ? null : JWT_SECRET // Don't expose default secret
};