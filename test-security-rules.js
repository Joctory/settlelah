const assert = require("assert");
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc, deleteDoc } = require("firebase/firestore");
const fs = require("fs");

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "settlelah-test",
    firestore: {
      rules: fs.readFileSync("firestore.rules", "utf8"),
    },
  });
});

after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("SettleLah Firestore Security Rules", () => {
  // Test Bills Collection
  context("bills collection", () => {
    it("should allow reading a valid and non-expired bill", async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      const testDoc = doc(db, "bills/1234567890-abcdef-123456");
      await assertSucceeds(
        setDoc(testDoc, {
          timestamp: Date.now(),
          members: ["user1"],
          dishes: [{ name: "dish1", cost: 10, members: ["user1"] }],
          breakdown: {},
          perPersonBreakdown: {},
          totals: {},
        })
      );
      await assertSucceeds(getDoc(testDoc));
    });

    it("should deny reading an expired bill", async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      const testDoc = doc(db, "bills/1234567890-abcdef-123456");
      await assertSucceeds(
        setDoc(testDoc, {
          timestamp: Date.now() - 31 * 24 * 60 * 60 * 1000, // 31 days ago
          members: ["user1"],
          dishes: [{ name: "dish1", cost: 10, members: ["user1"] }],
          breakdown: {},
          perPersonBreakdown: {},
          totals: {},
        })
      );
      await assertFails(getDoc(testDoc));
    });

    it("should allow creating a bill with valid data", async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      const testDoc = doc(db, "bills/1234567890-abcdef-123456");
      await assertSucceeds(
        setDoc(testDoc, {
          timestamp: Date.now(),
          members: ["user1"],
          dishes: [{ name: "dish1", cost: 10, members: ["user1"] }],
          breakdown: {},
          perPersonBreakdown: {},
          totals: {},
        })
      );
    });

    it("should deny deleting a bill", async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      const testDoc = doc(db, "bills/1234567890-abcdef-123456");
      await assertSucceeds(
        setDoc(testDoc, {
          timestamp: Date.now(),
          members: ["user1"],
          dishes: [{ name: "dish1", cost: 10, members: ["user1"] }],
          breakdown: {},
          perPersonBreakdown: {},
          totals: {},
        })
      );
      await assertFails(deleteDoc(testDoc));
    });
  });

  // Test Users Collection
  context("users collection", () => {
    it("should allow creating a user with valid data", async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      const testDoc = doc(db, "users/user123");
      await assertSucceeds(
        setDoc(testDoc, {
          name: "Test User",
          email: "test@example.com",
          passcode: "1234",
          created_at: Date.now(),
        })
      );
    });

    it("should deny reading another user's data", async () => {
      const db = testEnv.authenticatedContext("user456").firestore();
      const testDoc = doc(db, "users/user123");
      await assertSucceeds(
        setDoc(testDoc, {
          name: "Test User",
          email: "test@example.com",
          passcode: "1234",
          created_at: Date.now(),
        })
      );
      await assertFails(getDoc(testDoc));
    });

    it("should allow reading your own user data", async () => {
      const db = testEnv.authenticatedContext("user123").firestore();
      const testDoc = doc(db, "users/user123");
      await assertSucceeds(
        setDoc(testDoc, {
          name: "Test User",
          email: "test@example.com",
          passcode: "1234",
          created_at: Date.now(),
        })
      );
      await assertSucceeds(getDoc(testDoc));
    });
  });

  // Test Groups Collection
  context("groups collection", () => {
    it("should deny creating a group without authentication", async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      const testDoc = doc(db, "groups/group123");
      await assertFails(
        setDoc(testDoc, {
          name: "Test Group",
          members: ["user1", "user2"],
          timestamp: Date.now(),
          userId: "user123",
        })
      );
    });

    it("should deny reading a group's data without authentication", async () => {
      const authDb = testEnv.authenticatedContext("user123").firestore();
      const testDoc = doc(authDb, "groups/group123");
      await assertSucceeds(
        setDoc(testDoc, {
          name: "Test Group",
          members: ["user1", "user2"],
          timestamp: Date.now(),
          userId: "user123",
        })
      );

      const unauthDb = testEnv.unauthenticatedContext().firestore();
      const unauthTestDoc = doc(unauthDb, "groups/group123");
      await assertFails(getDoc(unauthTestDoc));
    });

    it("should allow creating a group with authentication", async () => {
      const db = testEnv.authenticatedContext("user123").firestore();
      const testDoc = doc(db, "groups/group123");
      await assertSucceeds(
        setDoc(testDoc, {
          name: "Test Group",
          members: ["user1", "user2"],
          timestamp: Date.now(),
          userId: "user123",
        })
      );
    });

    it("should allow reading a group's data with authentication", async () => {
      const db = testEnv.authenticatedContext("user123").firestore();
      const testDoc = doc(db, "groups/group123");
      await assertSucceeds(
        setDoc(testDoc, {
          name: "Test Group",
          members: ["user1", "user2"],
          timestamp: Date.now(),
          userId: "user123",
        })
      );
      await assertSucceeds(getDoc(testDoc));
    });
  });
});