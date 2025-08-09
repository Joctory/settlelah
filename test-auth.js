// Test script for the new authentication system
const bcrypt = require('bcrypt');
const jwtAuth = require('./jwt-auth');

async function testPasswordHashing() {
  console.log("🔒 Testing password hashing...");
  
  const testPasscode = "123456";
  const hashedPasscode = await bcrypt.hash(testPasscode, 12);
  
  console.log(`Original passcode: ${testPasscode}`);
  console.log(`Hashed passcode: ${hashedPasscode}`);
  
  // Verify the hash
  const isValid = await bcrypt.compare(testPasscode, hashedPasscode);
  const isInvalid = await bcrypt.compare("wrong", hashedPasscode);
  
  console.log(`Correct passcode verification: ${isValid ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Wrong passcode verification: ${isInvalid ? '❌ FAIL' : '✅ PASS'}\n`);
}

function testJWTTokens() {
  console.log("🎫 Testing JWT tokens...");
  
  const testUser = {
    userId: "test123",
    email: "test@example.com",
    name: "Test User"
  };
  
  // Generate tokens
  const accessToken = jwtAuth.generateAccessToken(testUser);
  const refreshToken = jwtAuth.generateRefreshToken({ userId: testUser.userId });
  
  console.log(`Access token generated: ${accessToken ? '✅' : '❌'}`);
  console.log(`Refresh token generated: ${refreshToken ? '✅' : '❌'}`);
  
  // Verify tokens
  const decodedAccess = jwtAuth.verifyToken(accessToken);
  const decodedRefresh = jwtAuth.verifyToken(refreshToken);
  
  console.log(`Access token verification: ${decodedAccess && decodedAccess.userId === testUser.userId ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Refresh token verification: ${decodedRefresh && decodedRefresh.userId === testUser.userId ? '✅ PASS' : '❌ FAIL'}`);
  
  // Test invalid token
  const invalidDecoded = jwtAuth.verifyToken("invalid.token.here");
  console.log(`Invalid token rejection: ${invalidDecoded === null ? '✅ PASS' : '❌ FAIL'}\n`);
}

function testTokenParsing() {
  console.log("📋 Testing token parsing...");
  
  const testUser = {
    userId: "test123",
    email: "test@example.com", 
    name: "Test User"
  };
  
  const token = jwtAuth.generateAccessToken(testUser);
  
  try {
    // Parse the token manually (like the client-side code does)
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;
    const isExpired = payload.exp < currentTime;
    
    console.log(`Token payload parsing: ${payload.userId === testUser.userId ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Token expiry check: ${!isExpired ? '✅ PASS' : '❌ FAIL'}`);
  } catch (error) {
    console.log(`Token parsing: ❌ FAIL - ${error.message}`);
  }
  
  console.log();
}

async function runTests() {
  console.log("🧪 Testing SettleLah Authentication System\n");
  
  await testPasswordHashing();
  testJWTTokens();
  testTokenParsing();
  
  console.log("✨ All tests completed!");
  
  if (jwtAuth.isUsingDefaultSecret()) {
    console.log("\n⚠️  Remember to set JWT_SECRET environment variable in production!");
  } else {
    console.log("\n✅ JWT secret is properly configured!");
  }
}

// Run the tests
runTests().catch(console.error);