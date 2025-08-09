// Vercel API route for development security stats
const security = require('../../enhanced-security');

module.exports = (req, res) => {
  // Only allow in development (check for localhost or dev environment)
  const isProduction = process.env.VERCEL_ENV === 'production';
  if (isProduction) {
    return res.status(404).json({ error: 'Not found' });
  }

  if (req.method === 'GET') {
    const stats = security.getSecurityStats();
    return res.json({
      ...stats,
      warning: "Development endpoint - disabled in production",
      timestamp: new Date().toISOString(),
      message: "This endpoint shows security monitoring data for development purposes"
    });
  }

  res.status(405).json({ error: 'Method not allowed' });
};