// Migration script to hash existing plain text passwords
const firebase = require("firebase/app");
const firestore = require("firebase/firestore");
const bcrypt = require("bcrypt");
require("dotenv").config();

// Firebase configuration - same as main app
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: "settlelah-1da97.firebaseapp.com",
  projectId: "settlelah-1da97",
};

const firebaseApp = firebase.initializeApp(firebaseConfig);
const db = firestore.getFirestore(firebaseApp);

async function migratePasswords() {
  console.log("🔄 Starting password migration...");
  
  try {
    // Get all users
    const usersRef = firestore.collection(db, "users");
    const snapshot = await firestore.getDocs(usersRef);
    
    if (snapshot.empty) {
      console.log("📭 No users found to migrate.");
      return;
    }
    
    console.log(`👥 Found ${snapshot.size} users to check.`);
    let migrated = 0;
    let alreadyHashed = 0;
    
    for (const doc of snapshot.docs) {
      const userData = doc.data();
      const userId = doc.id;
      
      // Check if password is already hashed (bcrypt hashes start with $2b$)
      if (userData.passcode && !userData.passcode.startsWith('$2b$')) {
        console.log(`🔐 Migrating user: ${userData.email || userId}`);
        
        // Hash the plain text passcode
        const hashedPasscode = await bcrypt.hash(userData.passcode, 12);
        
        // Update the user document
        await firestore.updateDoc(firestore.doc(usersRef, userId), {
          passcode: hashedPasscode,
          migrated_at: Date.now(),
          migration_version: '1.0.0'
        });
        
        migrated++;
        console.log(`  ✅ Password hashed for ${userData.email || userId}`);
      } else {
        alreadyHashed++;
        console.log(`  ⚡ Already hashed: ${userData.email || userId}`);
      }
    }
    
    console.log(`\n📊 Migration Summary:`);
    console.log(`  • Users migrated: ${migrated}`);
    console.log(`  • Already hashed: ${alreadyHashed}`);
    console.log(`  • Total users: ${snapshot.size}`);
    
    if (migrated > 0) {
      console.log("\n✅ Migration completed successfully!");
      console.log("🔒 All user passwords are now securely hashed.");
    } else {
      console.log("\n💫 No migration needed - all passwords already secure!");
    }
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Check if this script is run directly
if (require.main === module) {
  console.log("🛠️  SettleLah Password Migration Tool");
  console.log("===================================\n");
  
  // Confirm before running
  console.log("⚠️  This script will hash all plain text passwords in your database.");
  console.log("📝 Make sure you have a backup of your database before proceeding.");
  console.log("\n🚀 Starting migration in 3 seconds...\n");
  
  setTimeout(() => {
    migratePasswords()
      .then(() => {
        console.log("\n🎉 Migration process finished.");
        process.exit(0);
      })
      .catch((error) => {
        console.error("💥 Migration failed:", error);
        process.exit(1);
      });
  }, 3000);
}

module.exports = { migratePasswords };