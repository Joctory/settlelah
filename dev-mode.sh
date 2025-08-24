#!/bin/bash

# Enable development mode
export SETTLELAH_DEV_MODE=true

# Set a dummy auth token for development
export SETTLELAH_AUTH_TOKEN=dev-token-123

# Use Firebase emulators for local development
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099

echo "🔓 Development mode enabled - Security rules relaxed"
echo "🔥 Using Firebase emulators for local development"
echo "⚠️  WARNING: Don't use this in production!"

# Run the application in development mode
npm run dev 