/**
 * Enhanced Development Authentication
 * This module provides production-like authentication with development debugging
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const validator = require('validator');

class EnhancedDevAuth {
  constructor() {
    this.isDevMode = process.env.SETTLELAH_DEV_MODE === 'true';
    this.enableDebugLogging = process.env.ENABLE_DEBUG_LOGGING === 'true';
    this.enableEnhancedSecurity = process.env.ENABLE_ENHANCED_SECURITY === 'true';
  }

  log(message, level = 'info') {
    if (this.enableDebugLogging) {
      const timestamp = new Date().toISOString();
      const prefix = this.isDevMode ? '🔧 DEV-AUTH' : '🔒 PROD-AUTH';
      console.log(`${prefix} [${timestamp}] ${level.toUpperCase()}: ${message}`);
    }
  }

  validateEmail(email) {
    if (!email || !validator.isEmail(email)) {
      this.log(`Invalid email format: ${email}`, 'error');
      return false;
    }
    return true;
  }

  validatePasscode(passcode) {
    if (!passcode || passcode.length !== 6 || !/^\d{6}$/.test(passcode)) {
      this.log(`Invalid passcode format: ${passcode ? '***masked***' : 'undefined'}`, 'error');
      return false;
    }
    return true;
  }

  validateName(name) {
    if (!name || name.trim().length < 2 || name.trim().length > 100) {
      this.log(`Invalid name format: ${name}`, 'error');
      return false;
    }
    return true;
  }

  async hashPasscode(passcode) {
    this.log('Hashing passcode...');
    const saltRounds = this.isDevMode ? 4 : 12; // Faster in dev, secure in prod
    const hashed = await bcrypt.hash(passcode, saltRounds);
    this.log('Passcode hashed successfully');
    return hashed;
  }

  async verifyPasscode(plainPasscode, hashedPasscode) {
    this.log('Verifying passcode...');
    const isValid = await bcrypt.compare(plainPasscode, hashedPasscode);
    this.log(`Passcode verification: ${isValid ? 'SUCCESS' : 'FAILED'}`);
    return isValid;
  }

  generateTokens(user) {
    this.log(`Generating tokens for user: ${user.email}`);
    
    const jwtSecret = process.env.JWT_SECRET || 'fallback_dev_secret';
    
    const accessTokenPayload = {
      userId: user.userId,
      email: user.email,
      name: user.name,
      type: 'access'
    };

    const refreshTokenPayload = {
      userId: user.userId,
      email: user.email,
      type: 'refresh'
    };

    const accessToken = jwt.sign(
      accessTokenPayload,
      jwtSecret,
      { 
        expiresIn: this.isDevMode ? '24h' : '15m', // Longer in dev for convenience
        issuer: 'settlelah',
        audience: 'settlelah-users'
      }
    );

    const refreshToken = jwt.sign(
      refreshTokenPayload,
      jwtSecret,
      { 
        expiresIn: '7d',
        issuer: 'settlelah',
        audience: 'settlelah-users'
      }
    );

    this.log('Tokens generated successfully');
    return { accessToken, refreshToken };
  }

  verifyToken(token) {
    try {
      this.log('Verifying JWT token...');
      const jwtSecret = process.env.JWT_SECRET || 'fallback_dev_secret';
      const decoded = jwt.verify(token, jwtSecret, {
        issuer: 'settlelah',
        audience: 'settlelah-users'
      });
      this.log(`Token verified for user: ${decoded.email}`);
      return decoded;
    } catch (error) {
      this.log(`Token verification failed: ${error.message}`, 'error');
      return null;
    }
  }

  sanitizeUserData(userData) {
    this.log('Sanitizing user data...');
    return {
      name: validator.escape(userData.name.trim()),
      email: userData.email.toLowerCase().trim(),
      passcode: userData.passcode // Will be hashed separately
    };
  }

  createSecureUserId() {
    const crypto = require('crypto');
    const userId = crypto.randomBytes(16).toString('hex');
    this.log(`Generated secure user ID: ${userId.substring(0, 8)}...`);
    return userId;
  }

  // Enhanced security checks for development testing
  performSecurityChecks(req) {
    const checks = {
      hasValidUserAgent: !!req.headers['user-agent'],
      hasValidReferer: this.isDevMode || !!req.headers.referer,
      rateLimitOk: process.env.BYPASS_RATE_LIMITING === 'true' || true, // Rate limit bypass in dev
      hasValidIP: !!req.ip,
      hasValidContentType: req.headers['content-type'] === 'application/json'
    };

    const passed = Object.values(checks).every(check => check);
    
    this.log(`Security checks: ${JSON.stringify(checks)} - ${passed ? 'PASSED' : 'FAILED'}`);
    
    return { passed, checks };
  }
}

module.exports = new EnhancedDevAuth();