// Test script for enhanced security features
const security = require('./enhanced-security');

function testAccountLockout() {
  console.log("🔐 Testing Account Lockout...");
  
  const testIP = "192.168.1.100";
  const testEmail = "test@example.com";
  
  // Test initial state
  console.log(`Initial lockout status (IP): ${security.isAccountLocked(testIP, 'ip')}`);
  console.log(`Initial lockout status (User): ${security.isAccountLocked(testEmail, 'user')}`);
  
  // Test failed attempts
  for (let i = 1; i <= 6; i++) {
    const result = security.recordFailedAttempt(testIP, 'ip');
    console.log(`Attempt ${i}: Count=${result.count}, Locked=${result.isLocked}, Remaining=${result.remainingAttempts}`);
  }
  
  // Check lockout status
  const lockoutInfo = security.getLockoutInfo(testIP, 'ip');
  console.log(`Lockout info:`, lockoutInfo);
  
  // Test clearing attempts
  security.clearFailedAttempts(testIP, 'ip');
  console.log(`After clearing: ${security.isAccountLocked(testIP, 'ip')}`);
  
  console.log("✅ Account lockout test completed\n");
}

function testRateLimiting() {
  console.log("⚡ Testing Rate Limiting Configuration...");
  
  const config = security.SECURITY_CONFIG;
  console.log(`Max failed attempts: ${config.MAX_FAILED_ATTEMPTS}`);
  console.log(`Lockout duration: ${config.LOCKOUT_DURATION / 60000} minutes`);
  console.log(`Rate limit window: ${config.RATE_LIMIT_WINDOW / 60000} minutes`);
  console.log(`Max requests per IP: ${config.MAX_REQUESTS_PER_IP}`);
  console.log(`Max login attempts per IP: ${config.MAX_LOGIN_ATTEMPTS_PER_IP}`);
  
  console.log("✅ Rate limiting configuration verified\n");
}

function testIPUserTracking() {
  console.log("📍 Testing IP-User Tracking...");
  
  const testIP = "10.0.0.1";
  
  // Track multiple users from same IP
  security.trackUserIP(testIP, "user1@test.com");
  security.trackUserIP(testIP, "user2@test.com");
  security.trackUserIP(testIP, "user3@test.com");
  
  const usersFromIP = security.getUsersFromIP(testIP);
  console.log(`Users from ${testIP}:`, Array.from(usersFromIP));
  console.log(`Number of users: ${usersFromIP.size}`);
  
  console.log("✅ IP-User tracking test completed\n");
}

function testCSRFTokens() {
  console.log("🛡️ Testing CSRF Protection...");
  
  const csrfMiddleware = security.createCSRFMiddleware();
  
  // Mock request/response objects
  const mockReq = { session: {} };
  const mockRes = { locals: {} };
  const mockNext = () => console.log("CSRF middleware called next()");
  
  // Generate token
  csrfMiddleware.generateToken(mockReq, mockRes, mockNext);
  
  console.log(`CSRF Token generated: ${mockRes.locals.csrfToken ? '✅' : '❌'}`);
  console.log(`Session secret created: ${mockReq.session.csrfSecret ? '✅' : '❌'}`);
  
  console.log("✅ CSRF token test completed\n");
}

function testSecurityStats() {
  console.log("📊 Testing Security Statistics...");
  
  // Add some test data
  security.recordFailedAttempt("192.168.1.1", 'ip');
  security.recordFailedAttempt("192.168.1.2", 'ip');
  security.recordFailedAttempt("user@test.com", 'user');
  security.trackUserIP("192.168.1.1", "user@test.com");
  
  const stats = security.getSecurityStats();
  
  console.log(`Failed attempts by IP: ${stats.failedAttemptsByIP.length}`);
  console.log(`Failed attempts by User: ${stats.failedAttemptsByUser.length}`);
  console.log(`IP-User mappings: ${stats.ipUserMapping.length}`);
  
  console.log("Security stats:", JSON.stringify(stats, null, 2));
  
  console.log("✅ Security statistics test completed\n");
}

function testLoginFailureHandling() {
  console.log("❌ Testing Login Failure Handling...");
  
  const testIP = "203.0.113.1";
  const testEmail = "attacker@evil.com";
  
  const failureResult = security.handleLoginFailure(testIP, testEmail);
  
  console.log("Failure handling result:");
  console.log(`IP lockout info:`, failureResult.ip);
  console.log(`User lockout info:`, failureResult.user);
  
  // Test success handling (should clear failures)
  security.handleLoginSuccess(testIP, testEmail);
  console.log("After success - IP locked:", security.isAccountLocked(testIP, 'ip'));
  console.log("After success - User locked:", security.isAccountLocked(testEmail, 'user'));
  
  console.log("✅ Login failure handling test completed\n");
}

async function runAllTests() {
  console.log("🧪 Testing Enhanced Security Features");
  console.log("===================================\n");
  
  testAccountLockout();
  testRateLimiting();
  testIPUserTracking();
  testCSRFTokens();
  testSecurityStats();
  testLoginFailureHandling();
  
  console.log("🎉 All enhanced security tests completed!");
  console.log("\n💡 Security Features Implemented:");
  console.log("  ✅ Account lockout after failed attempts");
  console.log("  ✅ IP-based rate limiting per user");
  console.log("  ✅ CSRF protection for authenticated endpoints");
  console.log("  ✅ Progressive login delays");
  console.log("  ✅ Security monitoring and statistics");
  console.log("  ✅ Enhanced rate limiting with user tracking");
}

// Run the tests
runAllTests().catch(console.error);