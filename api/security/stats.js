// Vercel API route for protected security stats
const jwtAuth = require('../../jwt-auth');
const security = require('../../enhanced-security');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for JWT authorization
  const authHeader = req.headers.authorization;
  const token = jwtAuth.extractTokenFromHeader(authHeader);
  
  if (!token) {
    return res.status(401).json({ 
      error: "Access token required",
      code: "TOKEN_MISSING"
    });
  }

  // Verify JWT token
  const decoded = jwtAuth.verifyToken(token);
  if (!decoded || decoded.type !== 'access') {
    return res.status(401).json({ 
      error: "Invalid or expired token",
      code: "TOKEN_INVALID"
    });
  }

  // Check if user is admin
  if (decoded.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ 
      error: "Admin access required",
      code: "ADMIN_ONLY"
    });
  }

  // Return security stats
  const stats = security.getSecurityStats();
  return res.json({
    ...stats,
    adminUser: decoded.email,
    timestamp: new Date().toISOString(),
    message: "Security monitoring dashboard - admin access"
  });
};