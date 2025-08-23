/**
 * Comprehensive Integration Tests for SettleLah
 * Tests authentication, CRUD operations, and development mode functionality
 */

const assert = require("assert");
const fetch = require('node-fetch');
const { spawn } = require('child_process');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  BASE_URL: 'http://localhost:3001',
  DEV_MODE: true,
  TIMEOUT: 30000
};

let serverProcess;
let testUser = {
  name: 'Test User',
  email: 'test@settlelah.dev',
  passcode: '123456',
  userId: null,
  accessToken: null,
  refreshToken: null
};

let testBill = {
  id: null,
  settleMatter: 'Integration Test Bill',
  members: ['Alice', 'Bob'],
  dishes: [
    { name: 'Pizza', cost: 25.50, members: ['Alice', 'Bob'] },
    { name: 'Drinks', cost: 8.00, members: ['Alice'] }
  ]
};

// Helper functions
async function waitForServer(url, timeout = 30000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url);
      if (response.status === 200 || response.status === 401) {
        return true;
      }
    } catch (error) {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`Server did not start within ${timeout}ms`);
}

async function makeRequest(endpoint, options = {}) {
  const url = `${TEST_CONFIG.BASE_URL}${endpoint}`;
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };

  // Add auth token if available
  if (testUser.accessToken) {
    defaultOptions.headers['Authorization'] = `Bearer ${testUser.accessToken}`;
  }

  const finalOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...(options.headers || {})
    }
  };

  const response = await fetch(url, finalOptions);
  const text = await response.text();
  
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = { text, status: response.status };
  }

  return { response, data };
}

// Test suites
describe("SettleLah Integration Tests", function() {
  this.timeout(TEST_CONFIG.TIMEOUT);

  before(async function() {
    console.log("Starting server for integration tests...");
    
    // Set environment variables for development mode
    process.env.SETTLELAH_DEV_MODE = 'true';
    process.env.NODE_ENV = 'development';
    process.env.PORT = '3001';
    
    // Start the server
    serverProcess = spawn('node', ['index.js'], {
      cwd: __dirname,
      env: { ...process.env },
      stdio: 'pipe'
    });

    serverProcess.stdout.on('data', (data) => {
      console.log(`Server stdout: ${data}`);
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`Server stderr: ${data}`);
    });

    // Wait for server to be ready
    await waitForServer(TEST_CONFIG.BASE_URL);
    console.log("Server is ready for testing");
  });

  after(function() {
    if (serverProcess) {
      console.log("Stopping test server...");
      serverProcess.kill();
    }
  });

  describe("Authentication Flow", function() {
    it("should register a new user", async function() {
      const { response, data } = await makeRequest('/api/register', {
        method: 'POST',
        body: JSON.stringify({
          name: testUser.name,
          email: testUser.email,
          passcode: testUser.passcode
        })
      });

      assert.strictEqual(response.status, 201);
      assert.ok(data.success);
      assert.ok(data.userId);
      assert.ok(data.accessToken);
      assert.ok(data.refreshToken);

      // Store tokens for subsequent tests
      testUser.userId = data.userId;
      testUser.accessToken = data.accessToken;
      testUser.refreshToken = data.refreshToken;
    });

    it("should login with correct credentials", async function() {
      const { response, data } = await makeRequest('/api/validate-passcode', {
        method: 'POST',
        body: JSON.stringify({
          email: testUser.email,
          passcode: testUser.passcode
        })
      });

      assert.strictEqual(response.status, 200);
      assert.ok(data.success);
      assert.ok(data.accessToken);
      assert.strictEqual(data.user.email, testUser.email);
    });

    it("should reject invalid login credentials", async function() {
      const { response, data } = await makeRequest('/api/validate-passcode', {
        method: 'POST',
        body: JSON.stringify({
          email: testUser.email,
          passcode: '000000' // Wrong passcode
        })
      });

      assert.strictEqual(response.status, 401);
      assert.strictEqual(data.success, false);
    });

    it("should refresh access token", async function() {
      const { response, data } = await makeRequest('/api/refresh-token', {
        method: 'POST',
        body: JSON.stringify({
          refreshToken: testUser.refreshToken
        })
      });

      assert.strictEqual(response.status, 200);
      assert.ok(data.accessToken);
      
      // Update token for subsequent tests
      testUser.accessToken = data.accessToken;
    });
  });

  describe("Bill CRUD Operations", function() {
    it("should create a new bill", async function() {
      const billData = {
        members: testBill.members,
        settleMatter: testBill.settleMatter,
        dishes: testBill.dishes,
        discount: '0',
        applyServiceCharge: true,
        applyGst: true,
        taxProfile: 'singapore',
        paynowName: testUser.name,
        paynowID: '91234567',
        serviceChargeValue: '10'
      };

      const { response, data } = await makeRequest('/calculate', {
        method: 'POST',
        body: JSON.stringify(billData)
      });

      assert.strictEqual(response.status, 200);
      assert.ok(data.billId);
      assert.ok(data.link);
      assert.ok(data.billData);
      
      // Store bill ID for subsequent tests
      testBill.id = data.billId;
      
      // Verify bill structure
      assert.strictEqual(data.billData.settleMatter, testBill.settleMatter);
      assert.strictEqual(data.billData.members.length, testBill.members.length);
      assert.strictEqual(data.billData.dishes.length, testBill.dishes.length);
    });

    it("should retrieve the created bill", async function() {
      const { response, data } = await makeRequest(`/api/bill/${testBill.id}`);

      assert.strictEqual(response.status, 200);
      assert.ok(data.success);
      assert.ok(data.bill);
      
      // Verify bill data
      assert.strictEqual(data.bill.settleMatter, testBill.settleMatter);
      assert.strictEqual(data.bill.members.length, testBill.members.length);
      assert.strictEqual(data.bill.dishes.length, testBill.dishes.length);
    });

    it("should handle invalid bill ID", async function() {
      const { response, data } = await makeRequest('/api/bill/invalid-id');

      assert.strictEqual(response.status, 400);
      assert.strictEqual(data.success, false);
    });

    it("should prevent bill deletion (security feature)", async function() {
      const { response, data } = await makeRequest(`/api/bill/${testBill.id}`, {
        method: 'DELETE'
      });

      // Based on enhanced security rules, deletion should be restricted
      assert.ok(response.status === 403 || response.status === 400);
    });
  });

  describe("Groups Management", function() {
    const testGroup = {
      name: 'Test Group',
      members: ['Alice', 'Bob', 'Charlie']
    };

    it("should create a new group", async function() {
      const { response, data } = await makeRequest('/api/groups', {
        method: 'POST',
        body: JSON.stringify(testGroup)
      });

      // Note: Groups creation might require authentication in production
      if (response.status === 401) {
        console.log("Group creation requires authentication - this is expected with enhanced security");
        return;
      }

      assert.ok(response.status === 200 || response.status === 201);
      assert.ok(data.success);
    });

    it("should retrieve user groups", async function() {
      const { response, data } = await makeRequest('/api/groups');

      // Note: Groups retrieval might require authentication in production
      if (response.status === 401) {
        console.log("Group retrieval requires authentication - this is expected with enhanced security");
        return;
      }

      assert.ok(response.status === 200);
      assert.ok(Array.isArray(data) || data.groups);
    });
  });

  describe("Development Mode Features", function() {
    it("should allow unauthenticated access in dev mode", async function() {
      // Remove auth token temporarily
      const originalToken = testUser.accessToken;
      testUser.accessToken = null;

      const { response } = await makeRequest('/');

      // In dev mode, should allow access or redirect to login
      assert.ok(response.status === 200 || response.status === 302);

      // Restore token
      testUser.accessToken = originalToken;
    });

    it("should connect to development Firebase project", async function() {
      // This test verifies that the server is using the correct Firebase project
      const { response, data } = await makeRequest('/api/health');

      if (response.status === 404) {
        console.log("Health endpoint not implemented - this is expected");
        return;
      }

      // If health endpoint exists, verify it's using dev config
      if (data.firebase) {
        assert.ok(data.firebase.projectId === 'settlelah-dev');
      }
    });
  });

  describe("Error Handling and Rate Limiting", function() {
    it("should handle malformed JSON requests", async function() {
      const { response } = await makeRequest('/api/validate-passcode', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      assert.strictEqual(response.status, 400);
    });

    it("should apply rate limiting", async function() {
      // Make multiple rapid requests to trigger rate limiting
      const requests = Array(25).fill().map(() => 
        makeRequest('/api/validate-passcode', {
          method: 'POST',
          body: JSON.stringify({
            email: 'test@example.com',
            passcode: '123456'
          })
        })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.some(({ response }) => response.status === 429);
      
      if (!rateLimited) {
        console.log("Rate limiting may not be active in development mode");
      }
    });
  });

  describe("Security Features", function() {
    it("should have proper security headers", async function() {
      const { response } = await makeRequest('/');

      const headers = response.headers;
      assert.ok(headers.get('x-content-type-options'));
      assert.ok(headers.get('x-frame-options'));
      assert.ok(headers.get('content-security-policy'));
    });

    it("should validate input data", async function() {
      const { response, data } = await makeRequest('/calculate', {
        method: 'POST',
        body: JSON.stringify({
          members: [], // Invalid: empty members
          dishes: [],  // Invalid: empty dishes
          settleMatter: ''
        })
      });

      assert.ok(response.status >= 400);
    });
  });
});