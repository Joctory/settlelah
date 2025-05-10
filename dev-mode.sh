#!/bin/bash

# Enable development mode
export SETTLELAH_DEV_MODE=true

# Set a dummy auth token for development
export SETTLELAH_AUTH_TOKEN=dev-token-123

echo "🔓 Development mode enabled - Security rules relaxed"
echo "⚠️  WARNING: Don't use this in production!"

# Run the application in development mode
npm run dev 