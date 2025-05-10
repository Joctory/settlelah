/**
 * Firebase Authentication Helper for SettleLah
 * This module provides simplified authentication handling for your application
 */

const firebase = require("firebase/app");
require("firebase/auth");

// Initialize Firebase auth
let authInitialized = false;
let firebaseApp = null;

/**
 * Initialize Firebase auth with your app's existing Firebase instance
 * @param {Object} existingApp - Your Firebase app instance
 */
function initializeAuth(existingApp) {
  if (authInitialized) return;

  firebaseApp = existingApp;
  authInitialized = true;

  console.log("Firebase Auth initialized successfully");
}

/**
 * Get the current user's authentication token
 * @returns {Promise<string|null>} Authentication token or null if not signed in
 */
async function getAuthToken() {
  if (!authInitialized) {
    console.warn("Auth not initialized. Call initializeAuth first.");
    return null;
  }

  try {
    const auth = firebase.auth(firebaseApp);
    const currentUser = auth.currentUser;

    if (!currentUser) {
      // Auto sign in with anonymous auth for development convenience
      await signInAnonymously();
      return await getAuthToken(); // Try again after sign in
    }

    return await currentUser.getIdToken();
  } catch (error) {
    console.error("Error getting auth token:", error);
    return null;
  }
}

/**
 * Sign in anonymously (for development purposes)
 * @returns {Promise<Object>} User credential
 */
async function signInAnonymously() {
  if (!authInitialized) {
    console.warn("Auth not initialized. Call initializeAuth first.");
    return null;
  }

  try {
    const auth = firebase.auth(firebaseApp);
    return await auth.signInAnonymously();
  } catch (error) {
    console.error("Error signing in anonymously:", error);
    throw error;
  }
}

/**
 * Add authentication token to fetch requests
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Updated fetch options with auth header
 */
async function addAuthToRequest(options = {}) {
  const token = await getAuthToken();

  if (!token) return options;

  return {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  };
}

module.exports = {
  initializeAuth,
  getAuthToken,
  signInAnonymously,
  addAuthToRequest,
};
