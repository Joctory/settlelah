#!/usr/bin/env node

/**
 * Development Environment Setup Script for SettleLah
 * This script helps configure the development environment
 */

const fs = require('fs');
const path = require('path');

const DEV_ENV_TEMPLATE = `# SettleLah Development Environment Configuration
# Copy this file to .env and fill in your actual values

# Development Mode (set to 'true' for development)
SETTLELAH_DEV_MODE=true
NODE_ENV=development

# Firebase Configuration (Development Project)
FIREBASE_API_KEY=your_dev_firebase_api_key_here

# Authentication (for development - use simple values)
APP_PASSCODE=123456
SETTLELAH_AUTH_TOKEN=dev_token_123

# Session Security
SESSION_SECRET=dev_session_secret_change_in_production

# Optional: Mindee API for receipt scanning (can be empty for basic testing)
MINDEE_API_KEY=

# Development Server
PORT=3001
`;

function setupDevEnvironment() {
  console.log('🚀 Setting up SettleLah development environment...\n');

  // Check if .env already exists
  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), '.env.example');

  if (fs.existsSync(envPath)) {
    console.log('⚠️  .env file already exists. Please review your configuration.');
    console.log('   If you need to reset, delete .env and run this script again.\n');
    return;
  }

  // Create .env file
  try {
    fs.writeFileSync(envPath, DEV_ENV_TEMPLATE);
    console.log('✅ Created .env file for development');

    // Also update .env.example if it exists
    if (fs.existsSync(envExamplePath)) {
      fs.writeFileSync(envExamplePath, DEV_ENV_TEMPLATE);
      console.log('✅ Updated .env.example file');
    }

    console.log('\n📝 Next steps:');
    console.log('1. Edit .env file and add your Firebase API key');
    console.log('2. Ensure Firestore database is created in Firebase Console');
    console.log('3. Run: npm run dev');
    console.log('4. Test with: npm run test:integration\n');

    console.log('🔧 Firebase Console URLs:');
    console.log('   Development: https://console.firebase.google.com/project/settlelah-dev');
    console.log('   Production:  https://console.firebase.google.com/project/settlelah-1da97\n');

    console.log('🧪 Testing:');
    console.log('   Unit tests:        npm test');
    console.log('   Security tests:    npm run test:security');
    console.log('   Integration tests: npm run test:integration');

  } catch (error) {
    console.error('❌ Error creating .env file:', error.message);
    process.exit(1);
  }
}

// Check if we're in the right directory
if (!fs.existsSync('package.json')) {
  console.error('❌ Please run this script from the SettleLah root directory');
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (packageJson.name !== 'settlelah') {
  console.error('❌ This doesn\'t appear to be the SettleLah project directory');
  process.exit(1);
}

setupDevEnvironment();