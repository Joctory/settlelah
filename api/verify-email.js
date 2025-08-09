// Vercel API route for email verification
const firebase = require("firebase/app");
const firestore = require("firebase/firestore");
const validator = require("validator");
const security = require("../enhanced-security");

// Initialize Firebase if not already initialized
let db;
try {
  const { getFirestore } = require("firebase/firestore");
  
  if (!firebase.getApps().length) {
    const firebaseConfig = {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: "settlelah-1da97.firebaseapp.com",
      projectId: "settlelah-1da97",
    };
    
    firebase.initializeApp(firebaseConfig);
  }
  
  db = getFirestore();
} catch (error) {
  console.error("Firebase initialization error:", error);
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
        message: "Please enter a valid email address" 
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

    const usersRef = firestore.collection(db, "users");
    const emailQuery = firestore.query(usersRef, firestore.where("email", "==", email.toLowerCase().trim()));
    const emailSnapshot = await firestore.getDocs(emailQuery);

    if (emailSnapshot.empty) {
      // Email doesn't exist - record failed attempt but don't reveal this information
      security.handleLoginFailure(ip, email);
      
      // Return generic error to prevent email enumeration
      return res.status(400).json({
        valid: false,
        message: "Invalid email or passcode. Please try again."
      });
    }

    // Email exists and user is not locked
    res.json({
      valid: true,
      message: "Email verified. Please enter your passcode."
    });

  } catch (error) {
    console.error("Email verification error:", error);
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    security.handleLoginFailure(ip, req.body?.email);
    
    res.status(500).json({
      valid: false,
      message: "Server error. Please try again."
    });
  }
};