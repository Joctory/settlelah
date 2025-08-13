const express = require('express');
const firebase = require('firebase/app');
const firestore = require('firebase/firestore');
const path = require('path');
const crypto = require('crypto');
const validator = require('validator');
const bcrypt = require('bcrypt');
const jwtAuth = require('./jwt-auth');
const security = require('./enhanced-security');
const session = require('express-session');
const app = express();

app.use(express.json());

// Session configuration for CSRF protection
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(64).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// File references are handled by build-html.js during build process

app.use(express.static(path.join(__dirname, 'public')));

// Enhanced rate limiting
app.use(security.createEnhancedRateLimit());

// Rate limiting middleware
const rateLimit = require('express-rate-limit');

// Configure rate limiters
const billCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 bill creations per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { error: 'Too many bills created. Please try again later.' }
});

const resultViewLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 60, // Limit each IP to 60 bill views per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
});

const deleteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 deletion requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many deletion requests. Please try again later.' }
});

// Add CSP headers middleware
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    'default-src \'self\'; script-src \'self\' \'unsafe-inline\' \'unsafe-eval\' https: https://vercel.live; connect-src \'self\' https:; img-src \'self\' data: https:; style-src \'self\' \'unsafe-inline\' https:; font-src \'self\' https:;'
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Performance monitoring header for Vercel
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('X-Powered-By', 'SettleLah-Optimized');
  }

  next();
});

// Authentication middleware
const authRequiredPaths = ['/'];
const excludedPaths = ['/login', '/api/validate-passcode', '/api/verify-email', '/api/refresh-token', '/api/register', '/result', '/assets'];

app.use((req, res, next) => {
  // Skip authentication for excluded paths
  if (excludedPaths.some((path) => req.path.startsWith(path))) {
    return next();
  }

  // Check if authentication is required for this path
  if (authRequiredPaths.some((path) => req.path === path)) {
    // DEVELOPMENT MODE: If SETTLELAH_DEV_MODE is set, skip authentication
    if (process.env.SETTLELAH_DEV_MODE === 'true') {
      console.warn('Development mode: Proceeding without authentication');
      return next();
    }

    // For API requests, check for JWT authorization header
    if (req.headers.authorization) {
      const token = jwtAuth.extractTokenFromHeader(req.headers.authorization);

      if (!token) {
        return res.status(401).json({ error: 'Invalid authorization header format' });
      }

      // Try JWT verification first
      const decoded = jwtAuth.verifyToken(token);
      if (decoded && decoded.type === 'access') {
        // JWT token is valid, add user info to request
        req.user = {
          userId: decoded.userId,
          email: decoded.email,
          name: decoded.name
        };
        return next();
      }

      // Fallback to legacy token validation for backward compatibility
      if (token === process.env.SETTLELAH_AUTH_TOKEN) {
        return next();
      }

      return res.status(401).json({
        error: 'Invalid or expired token',
        code: 'TOKEN_INVALID'
      });
    } else {
      // For browser requests, redirect to login page
      return res.redirect('/login');
    }
  }

  // For other paths, no authentication needed
  next();
});

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: 'settlelah-1da97.firebaseapp.com',
  projectId: 'settlelah-1da97'
  // Add the rest from Firebase Console > Project Settings > General > Your Apps
};
const firebaseApp = firebase.initializeApp(firebaseConfig);
const db = firestore.getFirestore(firebaseApp);

// Add this after your Firebase initialization
const FirestoreAdapter = require('./firestore-adapter');
const firebaseAdapter = new FirestoreAdapter(db);
const authHelper = require('./auth-helper');

// Initialize auth with your Firebase app
authHelper.initializeAuth(firebaseApp);

// Install multer for file uploads
// npm install multer
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const FormData = require('form-data');

// Generate a secure bill ID with timestamp and cryptographic randomness
function generateSecureBillId(settleMatter = '') {
  // Create timestamp component (first 8 chars)
  const timestamp = Date.now().toString(36);

  // Create random component (8 chars) using crypto
  const randomBytes = crypto.randomBytes(8).toString('hex').slice(0, 8);

  // Create a simple hash from the settle matter (4 chars)
  const matterHash = settleMatter
    ? crypto.createHash('sha256').update(settleMatter).digest('hex').slice(0, 4)
    : crypto.randomBytes(2).toString('hex');

  // Combine all parts into a 20-character ID
  return `${timestamp}-${randomBytes}-${matterHash}`;
}

// Replace the existing database functions with adapter calls
async function saveBill(id, data) {
  return await firebaseAdapter.saveBill(id, data);
}

async function getBill(id) {
  return await firebaseAdapter.getBill(id);
}

async function deleteBills(ids) {
  return await firebaseAdapter.deleteBills(ids);
}

// New function to save a group to Firebase
async function saveGroup(groupName, groupData) {
  try {
    await firestore.setDoc(firestore.doc(db, 'groups', groupName), groupData);
    return true;
  } catch (error) {
    console.error(`Error saving group ${groupName}:`, error);
    throw error;
  }
}

// Make sure login page is served correctly
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Serve registration page
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Email verification endpoint - check if email exists before showing keypad
app.post('/api/verify-email',
  ...security.createLoginRateLimit(),
  security.createAccountLockoutMiddleware(),
  async (req, res) => {
    try {
      const { email } = req.body;
      const ip = req.ip || req.connection.remoteAddress;

      // Check if IP or email is locked before processing
      if (security.isIpLocked(ip)) {
        const lockInfo = security.getIpLockInfo(ip);
        return res.status(423).json({
          valid: false,
          locked: true,
          code: 'IP_LOCKED',
          error: 'Too many failed attempts from this IP address.',
          remainingMinutes: Math.ceil((lockInfo.lockedUntil - Date.now()) / (60 * 1000))
        });
      }

      // Validate email format
      if (!email || !validator.isEmail(email)) {
        const ip = req.ip || req.connection.remoteAddress;
        security.handleLoginFailure(ip, email);
        return res.status(400).json({
          valid: false,
          message: 'Please enter a valid email address'
        });
      }

      // Check if user is locked
      if (security.isUserLocked(email)) {
        const lockInfo = security.getUserLockInfo(email);
        return res.status(423).json({
          valid: false,
          locked: true,
          code: 'ACCOUNT_LOCKED',
          error: 'Account temporarily locked due to too many failed attempts.',
          remainingMinutes: Math.ceil((lockInfo.lockedUntil - Date.now()) / (60 * 1000))
        });
      }

      // Check if email exists in database
      const usersRef = firestore.collection(db, 'users');
      const emailQuery = firestore.query(usersRef, firestore.where('email', '==', email.toLowerCase().trim()));
      const emailSnapshot = await firestore.getDocs(emailQuery);

      if (emailSnapshot.empty) {
        // Email doesn't exist - record failed attempt but don't reveal this information
        const ip = req.ip || req.connection.remoteAddress;
        security.handleLoginFailure(ip, email);

        // Return generic error to prevent email enumeration
        return res.status(400).json({
          valid: false,
          message: 'Invalid email or passcode. Please try again.'
        });
      }

      // Email exists and user is not locked
      res.json({
        valid: true,
        message: 'Email verified. Please enter your passcode.'
      });

    } catch (error) {
      console.error('Email verification error:', error);
      const ip = req.ip || req.connection.remoteAddress;
      security.handleLoginFailure(ip, req.body.email);

      res.status(500).json({
        valid: false,
        message: 'Server error. Please try again.'
      });
    }
  }
);

// User registration endpoint
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, passcode } = req.body;

    // Validate inputs
    if (!name || !email || !passcode) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    if (passcode.length !== 6 || !/^\d{6}$/.test(passcode)) {
      return res.status(400).json({ success: false, message: 'Passcode must be exactly 6 digits' });
    }

    // Validate email format
    if (!validator.isEmail(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    // Check if email already exists
    const usersRef = firestore.collection(db, 'users');
    const emailQuery = firestore.query(usersRef, firestore.where('email', '==', email));
    const emailSnapshot = await firestore.getDocs(emailQuery);

    if (!emailSnapshot.empty) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Hash the passcode with bcrypt (salt rounds: 12 for security)
    const hashedPasscode = await bcrypt.hash(passcode, 12);

    // Create a new user
    const userId = crypto.randomBytes(16).toString('hex');
    const user = {
      name: validator.escape(name.trim()),
      email: email.toLowerCase().trim(),
      passcode: hashedPasscode, // Now properly hashed
      created_at: Date.now(),
      last_login: null
    };

    await firestore.setDoc(firestore.doc(usersRef, userId), user);

    // Return success with userId (but not the passcode for security)
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      userId
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

// Passcode validation endpoint with enhanced security
app.post('/api/validate-passcode',
  ...security.createLoginRateLimit(),
  security.createAccountLockoutMiddleware(),
  async (req, res) => {
    const { passcode, email } = req.body;

    // Add delay function to prevent brute force attacks
    const delayedResponse = (responseData, delay = 1000) => {
      setTimeout(() => {
        res.json(responseData);
      }, delay);
    };

    // If email is provided, validate against user database
    if (email) {
      try {
      // Validate email format
        if (!validator.isEmail(email)) {
          return delayedResponse({
            valid: false,
            message: 'Invalid email format.'
          });
        }

        const usersRef = firestore.collection(db, 'users');
        const query = firestore.query(
          usersRef,
          firestore.where('email', '==', email.toLowerCase().trim())
        );

        const snapshot = await firestore.getDocs(query);

        if (snapshot.empty) {
        // Record failed attempt for IP and user
          const ip = req.ip || req.connection.remoteAddress;
          const failureInfo = security.handleLoginFailure(ip, email);

          return delayedResponse({
            valid: false,
            message: 'Invalid email or passcode. Please try again.',
            remainingAttempts: failureInfo.user?.remainingAttempts
          });
        }

        // Get the first matching user
        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();

        // Compare provided passcode with hashed passcode using bcrypt
        const isValidPasscode = await bcrypt.compare(passcode, userData.passcode);

        if (!isValidPasscode) {
        // Record failed attempt for IP and user
          const ip = req.ip || req.connection.remoteAddress;
          const failureInfo = security.handleLoginFailure(ip, email);

          return delayedResponse({
            valid: false,
            message: 'Invalid email or passcode. Please try again.',
            remainingAttempts: failureInfo.user?.remainingAttempts
          });
        }

        // Clear failed attempts on successful login
        const ip = req.ip || req.connection.remoteAddress;
        security.handleLoginSuccess(ip, email);

        // Update last login timestamp
        await firestore.updateDoc(firestore.doc(usersRef, userDoc.id), {
          last_login: Date.now(),
          last_login_ip: ip
        });

        // Generate JWT access and refresh tokens
        const tokenPayload = {
          userId: userDoc.id,
          email: userData.email,
          name: userData.name
        };

        const accessToken = jwtAuth.generateAccessToken(tokenPayload);
        const refreshToken = jwtAuth.generateRefreshToken({ userId: userDoc.id });

        // Generate CSRF token for authenticated requests
        const csrfTokenGenerator = security.createCSRFMiddleware();
        req.session.csrfSecret = req.session.csrfSecret || require('crypto').randomBytes(32).toString('hex');

        res.json({
          valid: true,
          accessToken,
          refreshToken,
          userId: userDoc.id,
          name: userData.name,
          email: userData.email,
          message: 'Authentication successful'
        });
      } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({
          valid: false,
          message: 'Authentication failed. Please try again.'
        });
      }
      return;
    }

    // Legacy fallback for environment-based authentication (for backward compatibility)
    const correctPasscode = process.env.APP_PASSCODE || '123456'; // Default for development

    // Validate the passcode (use strict equality to avoid timing attacks)
    const isValid = passcode === correctPasscode;

    if (isValid) {
    // Generate legacy token for API calls
      const token = process.env.SETTLELAH_AUTH_TOKEN || 'default-auth-token';

      res.json({
        valid: true,
        token, // Legacy token for backward compatibility
        message: 'Authentication successful'
      });
    } else {
      delayedResponse({
        valid: false,
        message: 'Invalid passcode. Please try again.'
      });
    }
  });

// JWT token refresh endpoint
app.post('/api/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        error: 'Refresh token required',
        code: 'REFRESH_TOKEN_MISSING'
      });
    }

    // Verify refresh token
    const decoded = jwtAuth.verifyToken(refreshToken);
    if (!decoded || decoded.type !== 'refresh') {
      return res.status(401).json({
        error: 'Invalid or expired refresh token',
        code: 'REFRESH_TOKEN_INVALID'
      });
    }

    // Get user data from database
    const usersRef = firestore.collection(db, 'users');
    const userDoc = await firestore.getDoc(firestore.doc(usersRef, decoded.userId));

    if (!userDoc.exists()) {
      return res.status(401).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const userData = userDoc.data();

    // Generate new access token
    const tokenPayload = {
      userId: decoded.userId,
      email: userData.email,
      name: userData.name
    };

    const newAccessToken = jwtAuth.generateAccessToken(tokenPayload);

    res.json({
      accessToken: newAccessToken,
      message: 'Token refreshed successfully'
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Token refresh failed',
      code: 'REFRESH_FAILED'
    });
  }
});

// Make sure root route serves index.html explicitly
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// New API endpoint to fetch bill history from Firebase
app.get('/api/history', async (req, res) => {
  try {
    // Get user ID from session storage
    const userId = req.headers['x-user-id'];

    // Query Firestore for bills
    const billsRef = firestore.collection(db, 'bills');
    let query = billsRef;

    // If user is authenticated, filter by their bills
    if (userId) {
      query = firestore.query(
        billsRef,
        firestore.where('userId', '==', userId),
        firestore.orderBy('timestamp', 'desc'),
        firestore.limit(20)
      );
    } else {
      // For unauthenticated users, just get the most recent bills (limited number)
      query = firestore.query(billsRef, firestore.orderBy('timestamp', 'desc'), firestore.limit(10));
    }

    const snapshot = await firestore.getDocs(query);

    // Convert snapshot to array of bills with IDs
    const bills = [];
    snapshot.forEach((doc) => {
      bills.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({ bills });
  } catch (error) {
    console.error('Error fetching bill history:', error);
    res.status(500).json({ error: 'Failed to fetch bill history' });
  }
});

// New API endpoint to get latest bill from Firebase
app.get('/api/history/latest', async (req, res) => {
  try {
    // Get user ID from session storage
    const userId = req.headers['x-user-id'];

    // Query Firestore for bills
    const billsRef = firestore.collection(db, 'bills');
    let query = billsRef;

    // If user is authenticated, filter by their bills
    if (userId) {
      query = firestore.query(
        billsRef,
        firestore.where('userId', '==', userId),
        firestore.orderBy('timestamp', 'desc'),
        firestore.limit(1)
      );
    } else {
      // For unauthenticated users, get the most recent bill
      query = firestore.query(billsRef, firestore.orderBy('timestamp', 'desc'), firestore.limit(1));
    }

    const snapshot = await firestore.getDocs(query);

    if (snapshot.empty) {
      return res.json({ bill: null });
    }

    // Get the first (most recent) bill
    const doc = snapshot.docs[0];
    const bill = {
      id: doc.id,
      ...doc.data()
    };

    res.json({ bill });
  } catch (error) {
    console.error('Error fetching latest bill:', error);
    res.status(500).json({ error: 'Failed to fetch latest bill' });
  }
});

// New API endpoint to clear bill history from Firebase
app.delete('/api/history/clear', async (req, res) => {
  try {
    // Get user ID from session storage
    const userId = req.headers['x-user-id'];

    // Query Firestore for bills
    const billsRef = firestore.collection(db, 'bills');
    let query = billsRef;

    // If user is authenticated, filter by their bills
    if (userId) {
      query = firestore.query(billsRef, firestore.where('userId', '==', userId), firestore.limit(100));
    } else {
      // For unauthenticated users, get the most recent bills
      query = firestore.query(billsRef, firestore.orderBy('timestamp', 'desc'), firestore.limit(50));
    }

    // Get the bills to delete
    const snapshot = await firestore.getDocs(query);

    // If no bills found, return success
    if (snapshot.empty) {
      return res.json({ success: true, message: 'No bills to delete', count: 0 });
    }

    // Delete the bills in batches (Firestore limits batch operations to 500)
    const batch = firestore.writeBatch(db);
    let count = 0;

    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
      count++;
    });

    // Commit the batch delete
    await batch.commit();

    res.json({
      success: true,
      message: `Successfully deleted ${count} bills`,
      count
    });
  } catch (error) {
    console.error('Error clearing bill history:', error);
    res.status(500).json({ error: 'Failed to clear bill history' });
  }
});

// New API endpoint to delete individual bill from Firebase
app.delete('/api/history/:id', async (req, res) => {
  try {
    const billId = req.params.id;
    const userId = req.headers['x-user-id'];

    // Validate bill ID format
    if (!isValidBillId(billId)) {
      return res.status(400).json({ error: 'Invalid bill ID format' });
    }

    // First, try to get the bill to verify it exists and check ownership
    const billRef = firestore.doc(db, 'bills', billId);
    const billDoc = await firestore.getDoc(billRef);

    if (!billDoc.exists()) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    const billData = billDoc.data();

    // If user is authenticated, verify ownership
    if (userId && billData.userId && billData.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete the bill
    await firestore.deleteDoc(billRef);

    res.json({
      success: true,
      message: 'Bill deleted successfully',
      billId: billId
    });
  } catch (error) {
    console.error('Error deleting individual bill:', error);
    res.status(500).json({ error: 'Failed to delete bill' });
  }
});

// Input sanitization middleware
function sanitizeInput(req, res, next) {
  if (req.body.settleMatter) {
    req.body.settleMatter = validator.escape(req.body.settleMatter.trim());
  }
  if (req.body.paynowName) {
    req.body.paynowName = validator.escape(req.body.paynowName.trim());
  }
  if (req.body.paynowID) {
    req.body.paynowID = validator.escape(req.body.paynowID.trim());
  }
  if (req.body.members && Array.isArray(req.body.members)) {
    req.body.members = req.body.members.map((member) => ({
      ...member,
      name: validator.escape(member.name.trim())
    }));
  }
  if (req.body.dishes && Array.isArray(req.body.dishes)) {
    req.body.dishes = req.body.dishes.map((dish) => ({
      ...dish,
      name: validator.escape(dish.name.trim())
    }));
  }
  next();
}

// CSRF protection middleware
const csrfMiddleware = security.createCSRFMiddleware();

app.post('/calculate', billCreateLimiter, csrfMiddleware.generateToken, sanitizeInput, async (req, res) => {
  const {
    members,
    settleMatter,
    dishes,
    discount,
    applyServiceCharge,
    applyGst,
    taxProfile,
    paynowName,
    paynowID,
    serviceChargeValue,
    birthdayPerson
  } = req.body;

  // Replace simple random ID with secure ID
  const id = generateSecureBillId(settleMatter);
  // Get the host from request headers if available, otherwise fall back to environment variables
  const baseUrl =
    req.headers && req.headers.host
      ? req.headers.host.includes('localhost') ||
        req.headers.host.includes('[::1]') ||
        req.headers.host.includes('127.0.0.1')
        ? `http://${req.headers.host}`
        : `https://${req.headers.host}`
      : process.env.CUSTOM_DOMAIN
        ? `https://${process.env.CUSTOM_DOMAIN}`
        : process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'http://localhost:3000';

  // Optimized bill calculation
  const calculateBillBreakdown = (dishes, members, options) => {
    const { serviceChargeValue, applyServiceCharge, discount, applyGst, taxProfile } = options;

    const subtotal = dishes.reduce((sum, dish) => sum + parseFloat(dish.cost), 0);
    const serviceRate = serviceChargeValue ? parseFloat(serviceChargeValue) / 100 : 0.1;
    const gstRate = taxProfile === 'singapore' ? 0.09 : 0.06;

    // Main calculations
    const serviceCharge = applyServiceCharge ? subtotal * serviceRate : 0;
    const afterService = subtotal + serviceCharge;

    let discountAmount = 0;
    if (discount) {
      if (discount.includes('%')) {
        discountAmount = afterService * (parseFloat(discount) / 100);
      } else {
        discountAmount = parseFloat(discount) || 0;
      }
    }

    const afterDiscount = afterService - discountAmount;
    const gst = applyGst ? afterDiscount * gstRate : 0;
    const total = afterDiscount + gst;

    // Per-person calculations using Map for better performance
    const perPersonBreakdown = new Map();
    const totals = {};

    // Initialize breakdown for all members
    members.forEach((member) => {
      perPersonBreakdown.set(member.name, {
        subtotal: 0,
        serviceCharge: 0,
        afterService: 0,
        discountAmount: 0,
        afterDiscount: 0,
        gst: 0,
        total: 0
      });
    });

    // Calculate per-person costs
    dishes.forEach((dish) => {
      const share = dish.cost / dish.members.length;
      dish.members.forEach((memberName) => {
        const memberData = perPersonBreakdown.get(memberName);
        if (memberData) {
          memberData.subtotal += share;
        }
      });
    });

    const discountPerPerson = discountAmount / members.length;

    // Finalize per-person calculations
    perPersonBreakdown.forEach((memberData, memberName) => {
      memberData.serviceCharge = applyServiceCharge ? memberData.subtotal * serviceRate : 0;
      memberData.afterService = memberData.subtotal + memberData.serviceCharge;
      memberData.discountAmount = discountPerPerson;
      memberData.afterDiscount = memberData.afterService - discountPerPerson;
      memberData.gst = applyGst ? memberData.afterDiscount * gstRate : 0;
      memberData.total = memberData.afterDiscount + memberData.gst;
      totals[memberName] = memberData.total;
    });

    return {
      breakdown: { subtotal, serviceCharge, afterService, discountAmount, afterDiscount, gst, total },
      perPersonBreakdown: Object.fromEntries(perPersonBreakdown),
      totals
    };
  };

  const billCalculation = calculateBillBreakdown(dishes, members, {
    serviceChargeValue,
    applyServiceCharge,
    discount,
    applyGst,
    taxProfile
  });

  const { breakdown, perPersonBreakdown, totals } = billCalculation;

  // Handle birthday person logic - redistribute their cost to other members
  if (birthdayPerson && totals[birthdayPerson] !== undefined) {
    const birthdayPersonTotal = totals[birthdayPerson];
    const otherMembers = Object.keys(totals).filter((member) => member !== birthdayPerson);

    if (otherMembers.length > 0) {
      // Calculate how much each other member needs to pay extra
      const redistributeAmount = birthdayPersonTotal / otherMembers.length;

      // Add the redistributed amount to each other member
      otherMembers.forEach((member) => {
        totals[member] += redistributeAmount;
        // Also update their breakdown for accurate display
        perPersonBreakdown[member].total += redistributeAmount;
        perPersonBreakdown[member].birthdayShare = redistributeAmount;
      });

      // Set birthday person's total to zero
      totals[birthdayPerson] = 0;
      perPersonBreakdown[birthdayPerson].total = 0;
      perPersonBreakdown[birthdayPerson].birthdayPerson = true;
    }
  }

  const billData = {
    members,
    settleMatter,
    dishes,
    totals,
    perPersonBreakdown,
    breakdown,
    taxProfile,
    timestamp: Date.now(), // Store timestamp in Firebase
    paynowName,
    paynowID,
    discount, // Save the original discount input value (e.g., "10%" or "5")
    serviceChargeRate: `${parseFloat(serviceChargeValue || 10)}%`, // Include service charge rate
    gstRate: taxProfile === 'singapore' ? '9%' : '6%', // Include GST rate as a percentage
    birthdayPerson: birthdayPerson || null, // Include birthday person information
    // Add ownership information for security
    createdBy: req.headers['x-user-id'] || null,
    createdIP: req.ip || req.headers['x-forwarded-for'] || 'unknown',
    // Add a creation date string for easier reference
    createdDate: new Date().toISOString(),
    // Associate with user if authenticated
    userId: req.headers['x-user-id'] || null
  };

  // Verify that sum of individual totals matches the bill total
  const sumOfIndividualTotals = Object.values(totals).reduce((sum, personTotal) => sum + personTotal, 0);
  // Use toFixed(2) to avoid floating point precision issues
  const roundedBillTotal = parseFloat(breakdown.total.toFixed(2));
  const roundedSum = parseFloat(sumOfIndividualTotals.toFixed(2));

  if (Math.abs(roundedBillTotal - roundedSum) > 0.01) {
    console.warn(
      `Bill total (${roundedBillTotal}) does not match sum of individual totals (${roundedSum}). Difference: ${
        roundedBillTotal - roundedSum
      }`
    );
  }

  await saveBill(id, billData);
  const link = `${baseUrl}/bill/${id}`;
  res.json({ link, id, billData }); // Return ID and timestamp for localStorage
});

// Validate a bill ID format
function isValidBillId(id) {
  // Check if the ID follows our secure format pattern
  // Format: timestamp-randomBytes-matterHash
  const pattern = /^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/i;

  if (!pattern.test(id)) {
    return false;
  }

  // Add additional validation logic as needed
  // For example, timestamp validation or length checks
  const parts = id.split('-');

  // Verify we have exactly 3 parts
  if (parts.length !== 3) {
    return false;
  }

  // Verify each part has the expected length
  if (parts[0].length < 6 || parts[1].length < 6 || parts[2].length < 2) {
    return false;
  }

  return true;
}

app.get('/result/:id', resultViewLimiter, async (req, res) => {
  const id = req.params.id;

  // Validate the ID format before querying the database
  if (!isValidBillId(id)) {
    return res.status(400).sendFile(path.join(__dirname, 'public', 'hello-world.html'));
  }

  const bill = await getBill(id);
  if (!bill) {return res.status(400).sendFile(path.join(__dirname, 'public', 'hello-world.html'));}

  // Add timestamp verification - optional, can reject bills older than X days
  const billAge = Date.now() - bill.timestamp;
  const maxAgeInDays = 30; // Configure this as needed
  const maxAgeInMs = maxAgeInDays * 24 * 60 * 60 * 1000;

  // if (billAge > maxAgeInMs) {
  //   return res.status(410).json({ error: "Bill has expired" });
  // }

  // Return JSON for API requests
  res.json({
    members: bill.members,
    totals: bill.totals,
    perPersonBreakdown: bill.perPersonBreakdown,
    breakdown: bill.breakdown,
    dishes: bill.dishes,
    taxProfile: bill.taxProfile,
    timestamp: bill.timestamp,
    settleMatter: bill.settleMatter,
    paynowName: bill.paynowName,
    paynowID: bill.paynowID,
    discount: bill.discount, // Include the original discount input value
    serviceChargeRate: bill.serviceChargeRate,
    gstRate: bill.gstRate,
    birthdayPerson: bill.birthdayPerson || null, // Include birthday person information
    paymentStatus: bill.paymentStatus || {} // Include payment status
  });
});

// Add a new route for the HTML bill view
app.get('/bill/:id', resultViewLimiter, async (req, res) => {
  const id = req.params.id;

  // Validate the ID format before querying the database
  if (!isValidBillId(id)) {
    return res.status(400).sendFile(path.join(__dirname, 'public', 'hello-world.html'));
  }

  const bill = await getBill(id);
  if (!bill) {return res.status(404).sendFile(path.join(__dirname, 'public', 'hello-world.html'));}

  // Add timestamp verification - optional, can reject bills older than X days
  const billAge = Date.now() - bill.timestamp;
  const maxAgeInDays = 30; // Configure this as needed
  const maxAgeInMs = maxAgeInDays * 24 * 60 * 60 * 1000;

  // if (billAge > maxAgeInMs) {
  //   return res.status(410).json({ error: "Bill has expired" });
  // }

  // Serve the bill.html page
  res.sendFile(path.join(__dirname, 'public', 'bill.html'));
});

app.post('/api/scan-receipt', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Create form data for the API request
    const formData = new FormData();
    formData.append('document', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    // API key from environment variable
    const apiKey = process.env.MINDEE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing API key' });
    }

    // Make the API request to Mindee
    const response = await fetch('https://api.mindee.net/v1/products/mindee/expense_receipts/v5/predict', {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: `Mindee API error: ${response.status}`,
        details: errorText
      });
    }

    const data = await response.json();

    // Process the data
    const prediction = data.document?.inference?.prediction;
    if (!prediction) {
      return res.status(400).json({ error: 'No prediction data found in the response' });
    }

    // Extract line items from the prediction
    const lineItems = prediction.line_items || [];
    const newDishes = [];

    lineItems.forEach((item) => {
      if (item.description) {
        newDishes.push({
          name: item.description,
          cost: parseFloat(item.total_amount) || 0,
          members: []
        });
      }
    });

    // If no line items were found but we have a total amount, create a single item
    if (newDishes.length === 0 && prediction.total_amount?.value) {
      newDishes.push({
        name: prediction.supplier_name?.value || 'Receipt Item',
        cost: parseFloat(prediction.total_amount.value),
        members: []
      });
    }

    // Return the processed data
    res.json({ success: true, dishes: newDishes });
  } catch (error) {
    console.error('Error scanning receipt:', error);
    res.status(500).json({ error: 'Error scanning receipt', details: error.message });
  }
});

// New API endpoint to save a group to Firebase
app.post('/api/groups/save', async (req, res) => {
  try {
    const { groupName, groupData } = req.body;

    if (!groupName || !groupData) {
      return res.status(400).json({
        success: false,
        message: 'Group name and data are required'
      });
    }

    // Add userId from headers if available
    const userId = req.headers['x-user-id'];
    if (userId) {
      groupData.userId = userId;
    }

    // Save timestamp
    groupData.timestamp = Date.now();

    await saveGroup(groupName, groupData);

    res.json({
      success: true,
      message: `Group "${groupName}" saved successfully`,
      groupName
    });
  } catch (error) {
    console.error('Error saving group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save group',
      error: error.message
    });
  }
});

// New API endpoint to get user's groups from Firebase
app.get('/api/groups', async (req, res) => {
  try {
    // Get user ID from session storage
    const userId = req.headers['x-user-id'];

    // Query Firestore for groups
    const groupsRef = firestore.collection(db, 'groups');
    let query;

    // If user is authenticated, filter by their groups
    if (userId) {
      query = firestore.query(
        groupsRef,
        firestore.where('userId', '==', userId),
        firestore.orderBy('timestamp', 'desc')
      );
    } else {
      // For unauthenticated users, return empty array
      return res.json({ groups: [] });
    }

    const snapshot = await firestore.getDocs(query);

    // Convert snapshot to array of groups with IDs
    const groups = {};
    snapshot.forEach((doc) => {
      const data = doc.data();
      groups[doc.id] = data.members;
    });

    res.json({ groups });
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// API endpoint to delete a group from Firebase
app.delete('/api/groups/:groupName', async (req, res) => {
  try {
    const { groupName } = req.params;
    const userId = req.headers['x-user-id'];

    if (!groupName) {
      return res.status(400).json({
        success: false,
        message: 'Group name is required'
      });
    }

    // Check if the group exists and belongs to the user (optional in development mode)
    if (userId) {
      const groupRef = firestore.doc(db, 'groups', groupName);
      const groupDoc = await firestore.getDoc(groupRef);

      if (groupDoc.exists() && groupDoc.data().userId && groupDoc.data().userId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to delete this group'
        });
      }
    }

    // Delete the group
    await firestore.deleteDoc(firestore.doc(db, 'groups', groupName));

    res.json({
      success: true,
      message: `Group "${groupName}" deleted successfully`,
      groupName
    });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete group',
      error: error.message
    });
  }
});

// API endpoint to update payment status for a bill member
app.patch('/api/bills/:billId/payment-status', async (req, res) => {
  try {
    const { billId } = req.params;
    const { memberName, hasPaid } = req.body;

    // Basic validation
    if (!memberName || typeof hasPaid !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Member name and payment status are required'
      });
    }

    // Validate bill ID format
    const validIdPattern = /^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/i;
    if (!validIdPattern.test(billId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bill ID format'
      });
    }

    // Get the bill document
    const billRef = firestore.doc(db, 'bills', billId);
    const billDoc = await firestore.getDoc(billRef);

    if (!billDoc.exists()) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    const billData = billDoc.data();

    // Check if member exists in the bill
    const memberExists = billData.members.some((member) => member.name === memberName);
    if (!memberExists) {
      return res.status(400).json({
        success: false,
        message: 'Member not found in this bill'
      });
    }

    // Initialize paymentStatus object if it doesn't exist
    const paymentStatus = billData.paymentStatus || {};
    paymentStatus[memberName] = {
      hasPaid: hasPaid,
      timestamp: Date.now()
    };

    // Update the bill document
    await firestore.updateDoc(billRef, {
      paymentStatus: paymentStatus,
      lastUpdated: Date.now()
    });

    res.json({
      success: true,
      message: `Payment status updated for ${memberName}`,
      paymentStatus: paymentStatus[memberName]
    });
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment status'
    });
  }
});

// API endpoint to get client configuration
app.get('/api/config', (req, res) => {
  res.json({
    WEATHER_API_KEY: process.env.WEATHER_API_KEY
  });
});

// Security monitoring endpoints - MUST be before catch-all route
// Security monitoring endpoint (admin only)
app.get('/api/security/stats', jwtAuth.authenticateJWT, (req, res) => {
  // Only allow admin users to view security stats
  if (req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const stats = security.getSecurityStats();
  res.json(stats);
});

// Development-only security stats endpoint (no auth required)
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/security/stats-dev', (req, res) => {
    const stats = security.getSecurityStats();
    res.json({
      ...stats,
      warning: 'Development endpoint - disable in production',
      timestamp: new Date().toISOString()
    });
  });
}

// Admin security dashboard route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Add this at the end of your routes, just before the listen call
// This is a fallback route to serve index.html for any path that doesn't match a specific route
// This is especially useful for SPAs (Single Page Applications)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Only start server if this file is run directly (not imported)
if (require.main === module) {
  const port = process.env.PORT || 3000;

  // Security warning for JWT secret
  if (jwtAuth.isUsingDefaultSecret()) {
    console.warn('\n⚠️  SECURITY WARNING: Using default JWT secret!');
    console.warn('🔑 Set JWT_SECRET environment variable for production');
    console.warn('💡 Generate a secure secret: node -p "require(\'crypto\').randomBytes(64).toString(\'hex\')"');
  }

  app.listen(port, () => {
    console.log('\n🎉 SettleLah is running!');
    console.log(`📱 Local URL: http://localhost:${port}`);
    console.log(`⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔐 JWT Auth: ${jwtAuth.isUsingDefaultSecret() ? 'INSECURE (default secret)' : 'SECURE'}`);
    console.log('🔧 Press Ctrl+C to stop\n');
  });
}

module.exports = app;
