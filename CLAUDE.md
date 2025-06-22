# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SettleLah is a Node.js web application for splitting bills with secure passcode authentication. It uses Express.js as the web framework and Firebase Firestore for data persistence. The app supports receipt scanning, group management, and bill sharing with enhanced security features.

## Development Commands

### Core Commands
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run security rules tests using Mocha
- `npm run deploy-rules` - Deploy Firestore security rules to Firebase
- `npm run security-setup` - Run security setup script

### Firebase Commands
- `firebase login` - Authenticate with Firebase CLI
- `firebase deploy --only firestore:rules` - Deploy only Firestore rules
- `firebase emulators:start` - Start Firebase emulators for testing

## Architecture

### Backend Structure
- **index.js** - Main Express server with authentication middleware, rate limiting, and API endpoints
- **firestore-adapter.js** - Abstraction layer for Firestore operations with error handling
- **auth-helper.js** - Firebase authentication utilities and token management
- **server.js** - Server entry point (if different from index.js)

### Frontend Structure
- **public/** - Static assets and client-side code
  - **index.html** - Main application entry point
  - **bill.html** - Bill result display page
  - **login.html** - Authentication page
  - **script.js** - Main application JavaScript
  - **styles.css** - Application styles
  - **result.js** - Bill result page functionality

### Key Features
- **Authentication**: 6-digit passcode system with session management
- **Rate Limiting**: Per-endpoint rate limiting to prevent abuse
- **Receipt Scanning**: Integration with Mindee API for OCR processing
- **Bill Management**: Create, view, and delete bills with secure IDs
- **Group Management**: Save and manage member groups
- **Security**: CSP headers, input validation, and Firestore security rules

## Environment Variables

### Required for Production
- `APP_PASSCODE` - 6-digit authentication passcode
- `SETTLELAH_AUTH_TOKEN` - Secure token for API authentication
- `FIREBASE_API_KEY` - Firebase project API key
- `MINDEE_API_KEY` - Mindee API key for receipt scanning

### Development
- `SETTLELAH_DEV_MODE=true` - Enables development mode with relaxed authentication
- `NODE_ENV=development` - Sets development environment

## Database Schema

### Bills Collection (`bills`)
- Secure ID format: `timestamp-randomBytes-matterHash`
- Contains: members, dishes, totals, breakdown, ownership info
- Auto-expires after 30 days

### Groups Collection (`groups`)
- User-owned group configurations
- Contains: members array, timestamp, userId

### Users Collection (`users`)
- User accounts with email and passcode
- Contains: name, email, passcode, timestamps

## Security Considerations

- Bills use secure ID generation with cryptographic randomness
- Rate limiting on all major endpoints
- Firestore security rules enforce data access controls
- CSP headers prevent XSS attacks
- Input validation on all user inputs
- IP-based tracking for audit purposes

## Development Tips

- Use `SETTLELAH_DEV_MODE=true` to bypass authentication during development
- Firebase emulators can be used for local testing without affecting production data
- The firestore-adapter provides fallback mechanisms for development
- Bill IDs are validated before database operations to prevent injection attacks