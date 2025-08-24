const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const csrf = require('csrf');
const crypto = require('crypto');

// In-memory stores (in production, use Redis)
const failedAttempts = new Map(); // IP -> { count, lastAttempt, lockedUntil }
const userAttempts = new Map(); // email -> { count, lastAttempt, lockedUntil }
const ipUserMapping = new Map(); // IP -> Set of emails

// CSRF token generator
const csrfTokens = csrf();

// Configuration
const SECURITY_CONFIG = {
  // Account lockout settings
  MAX_FAILED_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
  ATTEMPT_WINDOW: 15 * 60 * 1000, // 15 minutes

  // Rate limiting settings
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS_PER_IP: 100,
  MAX_LOGIN_ATTEMPTS_PER_IP: 10,

  // Progressive delay settings
  DELAY_INCREMENT: 1000, // 1 second
  MAX_DELAY: 10 * 1000 // 10 seconds
};

/**
 * CSRF Protection Middleware
 */
function createCSRFMiddleware() {
  return {
    // Generate CSRF token
    generateToken: (req, res, next) => {
      if (!req.session) {
        req.session = {};
      }

      const secret = req.session.csrfSecret || csrfTokens.secretSync();
      req.session.csrfSecret = secret;

      const token = csrfTokens.create(secret);
      res.locals.csrfToken = token;
      req.csrfToken = () => token;

      next();
    },

    // Verify CSRF token
    verifyToken: (req, res, next) => {
      const token = req.body._csrf || req.headers['x-csrf-token'] || req.query._csrf;
      const secret = req.session && req.session.csrfSecret;

      if (!token || !secret || !csrfTokens.verify(secret, token)) {
        return res.status(403).json({
          error: 'Invalid CSRF token',
          code: 'CSRF_INVALID'
        });
      }

      next();
    }
  };
}

/**
 * Account Lockout Functions
 */
function recordFailedAttempt(identifier, type = 'ip') {
  const now = Date.now();
  const store = type === 'ip' ? failedAttempts : userAttempts;

  const record = store.get(identifier) || { count: 0, lastAttempt: 0, lockedUntil: 0 };

  // Reset count if outside attempt window
  if (now - record.lastAttempt > SECURITY_CONFIG.ATTEMPT_WINDOW) {
    record.count = 0;
  }

  record.count++;
  record.lastAttempt = now;

  // Set lockout if max attempts reached
  if (record.count >= SECURITY_CONFIG.MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + SECURITY_CONFIG.LOCKOUT_DURATION;
  }

  store.set(identifier, record);

  return {
    count: record.count,
    isLocked: record.lockedUntil > now,
    lockedUntil: record.lockedUntil,
    remainingAttempts: Math.max(0, SECURITY_CONFIG.MAX_FAILED_ATTEMPTS - record.count)
  };
}

function isAccountLocked(identifier, type = 'ip') {
  const store = type === 'ip' ? failedAttempts : userAttempts;
  const record = store.get(identifier);

  if (!record) {return false;}

  const now = Date.now();

  // Clear lockout if expired
  if (record.lockedUntil && now > record.lockedUntil) {
    record.lockedUntil = 0;
    record.count = 0;
    store.set(identifier, record);
    return false;
  }

  return record.lockedUntil > now;
}

function clearFailedAttempts(identifier, type = 'ip') {
  const store = type === 'ip' ? failedAttempts : userAttempts;
  store.delete(identifier);
}

function getLockoutInfo(identifier, type = 'ip') {
  const store = type === 'ip' ? failedAttempts : userAttempts;
  const record = store.get(identifier);

  if (!record || !record.lockedUntil || Date.now() > record.lockedUntil) {
    return null;
  }

  return {
    lockedUntil: record.lockedUntil,
    remainingTime: record.lockedUntil - Date.now(),
    remainingMinutes: Math.ceil((record.lockedUntil - Date.now()) / 60000)
  };
}

/**
 * IP-based Rate Limiting per User
 */
function trackUserIP(ip, email) {
  if (!ipUserMapping.has(ip)) {
    ipUserMapping.set(ip, new Set());
  }
  ipUserMapping.get(ip).add(email);
}

function getUsersFromIP(ip) {
  return ipUserMapping.get(ip) || new Set();
}

/**
 * Enhanced Rate Limiting Middleware
 */
function createEnhancedRateLimit(options = {}) {
  const config = { ...SECURITY_CONFIG, ...options };

  return rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW,
    max: (req) => {
      const ip = req.ip || req.connection.remoteAddress;
      const usersFromIP = getUsersFromIP(ip);

      // Reduce limit if multiple users from same IP
      if (usersFromIP.size > 1) {
        return Math.floor(config.MAX_REQUESTS_PER_IP / usersFromIP.size);
      }

      return config.MAX_REQUESTS_PER_IP;
    },
    message: (req) => {
      const ip = req.ip || req.connection.remoteAddress;
      const usersFromIP = getUsersFromIP(ip);

      return {
        error: 'Too many requests from this IP',
        code: 'RATE_LIMIT_EXCEEDED',
        usersFromIP: usersFromIP.size,
        retryAfter: Math.ceil(config.RATE_LIMIT_WINDOW / 1000)
      };
    },
    standardHeaders: true,
    legacyHeaders: false
  });
}

/**
 * Login Rate Limiting with Progressive Delays
 */
function createLoginRateLimit() {
  return [
    // Basic rate limiting for login endpoint
    rateLimit({
      windowMs: SECURITY_CONFIG.RATE_LIMIT_WINDOW,
      max: SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS_PER_IP,
      message: {
        error: 'Too many login attempts from this IP',
        code: 'LOGIN_RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(SECURITY_CONFIG.RATE_LIMIT_WINDOW / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false
    }),

    // Progressive delay for repeated attempts
    slowDown({
      windowMs: SECURITY_CONFIG.RATE_LIMIT_WINDOW,
      delayAfter: 3, // Start delaying after 3 requests
      delayMs: () => SECURITY_CONFIG.DELAY_INCREMENT, // Fixed deprecation warning
      maxDelayMs: SECURITY_CONFIG.MAX_DELAY,
      validate: { delayMs: false } // Disable deprecation warning
    })
  ];
}

/**
 * Account Lockout Middleware for Login
 */
function createAccountLockoutMiddleware() {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const email = req.body.email;

    // Check IP lockout
    if (isAccountLocked(ip, 'ip')) {
      const lockoutInfo = getLockoutInfo(ip, 'ip');
      return res.status(429).json({
        error: 'IP address temporarily locked due to too many failed attempts',
        code: 'IP_LOCKED',
        lockedUntil: lockoutInfo?.lockedUntil,
        remainingMinutes: lockoutInfo?.remainingMinutes
      });
    }

    // Check user account lockout
    if (email && isAccountLocked(email, 'user')) {
      const lockoutInfo = getLockoutInfo(email, 'user');
      return res.status(429).json({
        error: 'Account temporarily locked due to too many failed attempts',
        code: 'ACCOUNT_LOCKED',
        lockedUntil: lockoutInfo?.lockedUntil,
        remainingMinutes: lockoutInfo?.remainingMinutes
      });
    }

    next();
  };
}

/**
 * Helper function to handle login failure
 */
function handleLoginFailure(ip, email) {
  const ipResult = recordFailedAttempt(ip, 'ip');
  let userResult = null;

  if (email) {
    userResult = recordFailedAttempt(email, 'user');
    trackUserIP(ip, email);
  }

  return {
    ip: ipResult,
    user: userResult
  };
}

/**
 * Helper function to handle login success
 */
function handleLoginSuccess(ip, email) {
  clearFailedAttempts(ip, 'ip');

  if (email) {
    clearFailedAttempts(email, 'user');
    trackUserIP(ip, email);
  }
}

/**
 * Check if IP is currently locked
 */
function isIpLocked(ip) {
  const record = failedAttempts.get(ip);
  if (!record) {return false;}

  const now = Date.now();
  return record.lockedUntil > now;
}

/**
 * Check if user is currently locked
 */
function isUserLocked(email) {
  const record = userAttempts.get(email);
  if (!record) {return false;}

  const now = Date.now();
  return record.lockedUntil > now;
}

/**
 * Get IP lock information
 */
function getIpLockInfo(ip) {
  const record = failedAttempts.get(ip);
  if (!record) {return null;}

  const now = Date.now();
  return {
    isLocked: record.lockedUntil > now,
    lockedUntil: record.lockedUntil,
    remainingTime: Math.max(0, record.lockedUntil - now),
    attemptCount: record.count
  };
}

/**
 * Get user lock information
 */
function getUserLockInfo(email) {
  const record = userAttempts.get(email);
  if (!record) {return null;}

  const now = Date.now();
  return {
    isLocked: record.lockedUntil > now,
    lockedUntil: record.lockedUntil,
    remainingTime: Math.max(0, record.lockedUntil - now),
    attemptCount: record.count
  };
}

/**
 * Get security statistics (for monitoring)
 */
function getSecurityStats() {
  return {
    failedAttemptsByIP: Array.from(failedAttempts.entries()).map(([ip, data]) => ({
      ip,
      count: data.count,
      isLocked: data.lockedUntil > Date.now(),
      lastAttempt: new Date(data.lastAttempt).toISOString()
    })),
    failedAttemptsByUser: Array.from(userAttempts.entries()).map(([email, data]) => ({
      email,
      count: data.count,
      isLocked: data.lockedUntil > Date.now(),
      lastAttempt: new Date(data.lastAttempt).toISOString()
    })),
    ipUserMapping: Array.from(ipUserMapping.entries()).map(([ip, users]) => ({
      ip,
      users: Array.from(users)
    }))
  };
}

module.exports = {
  // Configuration
  SECURITY_CONFIG,

  // CSRF Protection
  createCSRFMiddleware,

  // Account Lockout
  recordFailedAttempt,
  isAccountLocked,
  clearFailedAttempts,
  getLockoutInfo,
  handleLoginFailure,
  handleLoginSuccess,

  // Rate Limiting
  createEnhancedRateLimit,
  createLoginRateLimit,
  createAccountLockoutMiddleware,

  // IP-User Tracking
  trackUserIP,
  getUsersFromIP,

  // Lock Status Checking
  isIpLocked,
  isUserLocked,
  getIpLockInfo,
  getUserLockInfo,

  // Monitoring
  getSecurityStats
};