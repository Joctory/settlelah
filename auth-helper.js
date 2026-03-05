/**
 * Firebase Authentication Helper for SettleLah
 * Uses Firebase Admin SDK - no client-side auth needed on the server
 */

let adminApp = null;
let authInitialized = false;

/**
 * Initialize auth with the Firebase Admin SDK app instance
 * @param {Object} existingApp - Firebase Admin app instance
 */
function initializeAuth(existingApp) {
  if (authInitialized) {return;}

  adminApp = existingApp;
  authInitialized = true;
}

/**
 * Get auth token - with Admin SDK, server already has full access.
 * Returns a placeholder token to satisfy callers that expect a token.
 * @returns {Promise<string|null>} A token string or null
 */
async function getAuthToken() {
  if (!authInitialized || !adminApp) {
    console.warn('Auth not initialized. Call initializeAuth first.');
    return null;
  }

  // Admin SDK has full privileges; no client auth token is needed.
  // Return a truthy value so callers that check for a token proceed normally.
  return 'admin-sdk-authenticated';
}

/**
 * Sign in anonymously - no-op for Admin SDK (already has full access)
 * @returns {Promise<null>}
 */
async function signInAnonymously() {
  return null;
}

/**
 * Add authentication token to fetch requests
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Updated fetch options with auth header
 */
async function addAuthToRequest(options = {}) {
  const token = await getAuthToken();

  if (!token) {return options;}

  return {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`
    }
  };
}

module.exports = {
  initializeAuth,
  getAuthToken,
  signInAnonymously,
  addAuthToRequest
};
