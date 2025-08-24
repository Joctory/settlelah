// Vercel API route for email verification
const admin = require('firebase-admin');
const validator = require('validator');
const security = require('../enhanced-security');

// Initialize Firebase Admin if not already initialized
let db;
try {
  if (!admin.apps.length) {
    // Use service account from individual environment variables (easier approach)
    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID || "settlelah-1da97",
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL
      };
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      console.log('✅ Firebase Admin initialized with individual env vars');
    } 
    // Fallback to JSON key if individual vars not available
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || 'settlelah-1da97'
      });
      console.log('✅ Firebase Admin initialized with service account key');
    } else {
      // Fallback initialization - this should work in Vercel with proper env vars
      console.log('⚠️ FIREBASE_SERVICE_ACCOUNT_KEY not found, trying application default');
      admin.initializeApp({
        projectId: 'settlelah-1da97'
      });
    }
  }

  db = admin.firestore();
} catch (error) {
  console.error('❌ Firebase Admin initialization error:', error);
  throw error; // Re-throw to see the full error
}

module.exports = async (req, res) => {
  // Add CORS headers for Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }


  try {
    const { email } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

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
    if (!db) {
      throw new Error('Database connection not available');
    }

    // Use Admin SDK to query users collection
    const usersRef = db.collection('users');
    const emailQuery = usersRef.where('email', '==', email.toLowerCase().trim());
    const emailSnapshot = await emailQuery.get();

    if (emailSnapshot.empty) {
      // Email doesn't exist - record failed attempt but don't reveal this information
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
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    security.handleLoginFailure(ip, req.body?.email);

    res.status(500).json({
      valid: false,
      message: 'Server error. Please try again.'
    });
  }
};