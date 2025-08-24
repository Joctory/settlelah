# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SettleLah is a Node.js web application for splitting bills with secure passcode authentication. It uses Express.js as the web framework and Firebase Firestore for data persistence. The app supports receipt scanning, group management, and bill sharing with enhanced security features.

## Development Commands

### Core Commands
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run security rules tests using Mocha
- `npm run test:security` - Run security tests with Firebase emulators
- `npm run deploy-rules` - Deploy Firestore security rules to Firebase
- `npm run security-setup` - Run security setup script

### Build & Optimization Commands
- `npm run build` - Build minified CSS, JS, and HTML files for production
- `npm run build:js` - Minify JavaScript files only (includes login.js)
- `npm run build:css` - Minify CSS files only (includes login.css)
- `npm run build:html` - Build HTML files using build-html.js
- `npm run build:prod` - Build for production with NODE_ENV=production
- `npm run build:dev` - Build HTML files only for development
- `npm run vercel-build` - Vercel-specific build command (auto-runs on deploy)

### Code Quality Commands
- `npm run lint` - Run ESLint on all JavaScript files
- `npm run lint:fix` - Run ESLint with automatic fixes
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting without making changes
- `npm run quality` - Run both linting and format checking
- `npm run quality:fix` - Run linting with fixes and format code

### Deployment Commands
- `npm run deploy` - Full deployment flow with quality checks, build, and git push
- `npm run quick-deploy` - Quick deployment with automatic commit message
- `npm run dev-deploy` - Prepare for deployment but require manual commit

### Vercel Development Commands
- `npm run dev:vercel` - Start Vercel dev with clear URL display
- `npm run dev:silent` - Start Vercel dev silently on port 3000
- `vercel dev --yes --listen 3000` - Direct Vercel dev command
- `npm run dev` - Regular development server (port 3001)

### Vercel Deployment Commands
- `vercel --prod` - Deploy to production
- `vercel` - Preview deployment
- `vercel env add VARIABLE_NAME` - Add environment variable

### Firebase Commands
- `firebase login` - Authenticate with Firebase CLI
- `firebase deploy --only firestore:rules` - Deploy only Firestore rules
- `firebase emulators:start` - Start Firebase emulators for testing

## Architecture

### Backend Structure
- **index.js** - Main Express server with authentication middleware, rate limiting, and API endpoints
- **firestore-adapter.js** - Abstraction layer for Firestore operations with error handling
- **auth-helper.js** - Firebase authentication utilities and token management
- **enhanced-security.js** - Advanced security features including rate limiting, CSRF protection, and account lockout
- **jwt-auth.js** - JWT token management and validation utilities
- **build-html.js** - Build script for processing HTML files with environment-specific configurations

### Frontend Structure
- **public/** - Static assets and client-side code
  - **index.html** - Main application entry point
  - **bill.html** - Bill result display page
  - **login.html** - Authentication page
  - **admin.html** - Administrative interface
  - **script.js** - Main application JavaScript
  - **styles.css** - Application styles
  - **result.js** - Bill result page functionality
  - **login.js** - Authentication page JavaScript
  - **sw.js** - Service worker for PWA functionality
  - **assets/** - Static images and SVG files

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
- Note: Bill expiration check is currently disabled (function commented out in index.js)

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

## Code Conventions

- **ESLint Configuration**: Project uses ESLint with specific rules (2-space indentation, single quotes, semicolons required)
- **Prettier Integration**: Automated code formatting with Prettier
- **Commented Functions**: When a function is commented out in the codebase, it indicates that the function is not currently active or used in the webapp. These functions should be considered inactive/disabled features.
- **Minification**: Production builds minify JS/CSS files with `.min.js` and `.min.css` extensions
- **File Naming**: Static assets use kebab-case, JavaScript uses camelCase

## Build Process

The build system uses several tools:
- **Terser** - JavaScript minification and compression
- **CleanCSS** - CSS minification and optimization  
- **build-html.js** - Custom HTML processing script that handles environment-specific file references
- **ESLint + Prettier** - Code quality and formatting validation

Production builds automatically switch between minified (.min) and development versions of assets based on NODE_ENV.