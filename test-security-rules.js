/**
 * Tests for SettleLah Firestore Security Rules
 *
 * This file contains basic tests to verify your Firestore security rules.
 *
 * To run these tests:
 * 1. Install testing dependencies: npm install -D @firebase/rules-unit-testing mocha
 * 2. Start Firebase emulators: firebase emulators:start
 * 3. Run tests: npx mocha test-security-rules.js
 */

const firebase = require("@firebase/rules-unit-testing");
const fs = require("fs");
const { assert } = require("chai");

// Load security rules content
const securityRules = fs.readFileSync("./firestore.rules", "utf8");

describe("SettleLah Firestore Security Rules", () => {
  let projectId;
  let adminApp;
  let authApp;
  let unauthApp;

  before(async () => {
    // Generate a unique project ID for this test run
    projectId = `settlelah-rules-test-${Date.now()}`;

    // Clear any existing rules and load our test rules
    await firebase.loadFirestoreRules({
      projectId,
      rules: securityRules,
    });

    // Initialize admin, authenticated, and unauthenticated app instances
    adminApp = firebase.initializeAdminApp({ projectId });
    authApp = firebase.initializeTestApp({
      projectId,
      auth: { uid: "test-user", email: "test@example.com" },
    });
    unauthApp = firebase.initializeTestApp({
      projectId,
    });
  });

  after(async () => {
    // Clean up after tests
    await Promise.all([firebase.clearFirestoreData({ projectId }), firebase.apps().map((app) => app.delete())]);
  });

  describe("Bill Collection Rules", () => {
    const billsCollectionRef = "bills";

    // Test data for a valid bill
    const validBillData = {
      members: [
        { name: "User 1", avatar: 1 },
        { name: "User 2", avatar: 2 },
      ],
      dishes: [{ name: "Pizza", cost: 20, members: ["User 1", "User 2"] }],
      breakdown: { subtotal: 20, total: 20 },
      perPersonBreakdown: { "User 1": { total: 10 }, "User 2": { total: 10 } },
      totals: { "User 1": 10, "User 2": 10 },
      timestamp: Date.now(),
      serviceChargeRate: "10%",
      gstRate: "9%",
    };

    it("allows anyone to read a bill with valid ID", async () => {
      // First create a bill as admin
      const billId = "test123-abc123-def456";
      await adminApp.firestore().collection(billsCollectionRef).doc(billId).set(validBillData);

      // Test that unauthenticated user can read it
      const unauthBill = unauthApp.firestore().collection(billsCollectionRef).doc(billId);

      await firebase.assertSucceeds(unauthBill.get());
    });

    it("rejects reading a bill with invalid ID format", async () => {
      // Create a bill with invalid ID as admin
      const billId = "invalid!id@format";
      await adminApp.firestore().collection(billsCollectionRef).doc(billId).set(validBillData);

      // Try to read with unauthenticated user
      const unauthBill = unauthApp.firestore().collection(billsCollectionRef).doc(billId);

      await firebase.assertFails(unauthBill.get());
    });

    it("allows authenticated users to create a bill with valid data", async () => {
      const billId = "valid123-random456-hash789";
      const authBill = authApp.firestore().collection(billsCollectionRef).doc(billId);

      await firebase.assertSucceeds(authBill.set(validBillData));
    });

    it("rejects bill creation with missing required fields", async () => {
      const billId = "valid123-random456-hash789";
      const invalidBillData = { ...validBillData };
      delete invalidBillData.members; // Remove required field

      const authBill = authApp.firestore().collection(billsCollectionRef).doc(billId);

      await firebase.assertFails(authBill.set(invalidBillData));
    });

    it("allows authenticated users to delete their bills", async () => {
      // Create a bill with createdBy field matching the test user
      const billId = "owned123-random456-hash789";
      await adminApp
        .firestore()
        .collection(billsCollectionRef)
        .doc(billId)
        .set({
          ...validBillData,
          createdBy: "test-user",
        });

      // Try to delete it as the authenticated user
      const authBill = authApp.firestore().collection(billsCollectionRef).doc(billId);

      await firebase.assertSucceeds(authBill.delete());
    });

    it("rejects bill updates (bills are immutable)", async () => {
      // Create a bill first
      const billId = "immutable123-random456-hash789";
      await adminApp.firestore().collection(billsCollectionRef).doc(billId).set(validBillData);

      // Try to update it
      const authBill = authApp.firestore().collection(billsCollectionRef).doc(billId);

      await firebase.assertFails(authBill.update({ timestamp: Date.now() }));
    });
  });

  describe("Default Rules", () => {
    it("rejects access to other collections", async () => {
      // Try to access a different collection
      const otherCollection = authApp.firestore().collection("other");

      await firebase.assertFails(otherCollection.get());
      await firebase.assertFails(otherCollection.add({ test: true }));
    });
  });
});
