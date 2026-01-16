# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SettleLah is a Node.js web application for splitting bills with secure passcode authentication. It uses Express.js as the web framework and Firebase Firestore for data persistence. The app supports receipt scanning (via Veryfi API), group management, and bill sharing with enhanced security features including JWT authentication.

## Development Commands

### Quick Reference
```bash
npm run dev              # Start development server with nodemon (port 3001)
npm run dev:vercel       # Start Vercel dev server (port 3000)
npm test                 # Run security rules tests
npm run build            # Build minified assets for production
npm run quality:fix      # Auto-fix linting and formatting issues
npm run deploy           # Full deployment: quality check + build + git push
```

### Testing
```bash
npm test                                    # Run Mocha security rules tests
npm run test:security                       # Run tests with Firebase emulators
npm run test:integration                    # Integration tests (60s timeout)
firebase emulators:start                    # Start local Firebase emulators
firebase emulators:exec "mocha test.js"     # Run specific test with emulators
```

### Build Commands
```bash
npm run build           # Full build: JS + CSS + HTML minification
npm run build:js        # Terser minification: script.js, result.js, login.js
npm run build:css       # CleanCSS minification: styles.css, result.css, login.css
npm run build:html      # Process HTML via build-html.js
npm run build:prod      # Build with NODE_ENV=production
```

### Code Quality
```bash
npm run lint            # ESLint check
npm run lint:fix        # ESLint with auto-fix
npm run format          # Prettier format all files
npm run quality         # Run lint + format check
npm run quality:fix     # Fix lint + format issues
```

### Deployment
```bash
npm run deploy          # Quality fix + build + git commit + push
npm run quick-deploy    # Same with auto commit message
vercel --prod           # Deploy to Vercel production
npm run deploy-rules    # Deploy Firestore security rules only
```

## Architecture

### Request Flow
All requests on Vercel route through `api/index.js` → `index.js` (Express app). The vercel.json rewrites all paths to `/api/index`.

### Backend Structure
- **index.js** - Main Express server (~1500 lines): authentication middleware, rate limiters, all API endpoints, bill calculation logic
- **firestore-adapter.js** - Firestore CRUD operations with dev mode fallbacks
- **jwt-auth.js** - JWT token generation/verification (access + refresh tokens)
- **enhanced-security.js** - Rate limiting, CSRF protection, account lockout tracking
- **enhanced-dev-auth.js** - Development authentication utilities
- **auth-helper.js** - Firebase Admin SDK authentication utilities
- **build-html.js** - Build script for environment-specific HTML processing

### Frontend Structure (public/)
- **index.html** - Main app entry point (bill creation)
- **bill.html** - Bill result display page (shareable)
- **login.html** / **register.html** - Authentication pages
- **admin.html** - Security monitoring dashboard
- **script.js** - Main application logic (bill creation, member management, dish assignment)
- **result.js** - Bill result page functionality (payment status toggling)
- **login.js** - Authentication flow (email verification → passcode entry)
- **sw.js** - Service worker for PWA offline support

### API Endpoints (defined in index.js)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/verify-email` | POST | Check if email exists before passcode entry |
| `/api/validate-passcode` | POST | Authenticate with email + 6-digit passcode |
| `/api/register` | POST | Create new user account |
| `/api/refresh-token` | POST | Refresh JWT access token |
| `/calculate` | POST | Create new bill, returns shareable link |
| `/result/:id` | GET | Get bill data as JSON |
| `/bill/:id` | GET | Serve bill HTML page |
| `/api/history` | GET | User's bill history |
| `/api/groups` | GET | User's saved groups |
| `/api/groups/save` | POST | Save a new group |
| `/api/scan-receipt` | POST | OCR receipt scanning via Veryfi API |
| `/api/bills/:id/payment-status` | PATCH | Update member payment status |

### Authentication Flow
1. User enters email → `/api/verify-email` checks if account exists
2. If exists, user enters 6-digit passcode → `/api/validate-passcode`
3. Server verifies bcrypt-hashed passcode, returns JWT access + refresh tokens
4. Frontend stores tokens, includes in Authorization header for protected routes
5. Token refresh via `/api/refresh-token` when access token expires

## Environment Variables

### Required for Production
- `FIREBASE_PRIVATE_KEY` - Firebase service account private key
- `FIREBASE_CLIENT_EMAIL` - Firebase service account email
- `JWT_SECRET` - Secret for signing JWT tokens (critical for security)
- `VERYFI_CLIENT_ID`, `VERYFI_USERNAME`, `VERYFI_API_KEY` - Receipt scanning API

### Optional
- `SETTLELAH_AUTH_TOKEN` - Legacy API authentication token
- `SESSION_SECRET` - Express session secret (auto-generated if not set)
- `ADMIN_EMAIL` - Email allowed to access `/api/security/stats`

### Development
- `SETTLELAH_DEV_MODE=true` - Bypass authentication, enable dev fallbacks in Firestore adapter
- `USE_EMULATOR=true` - Use Firebase emulators (localhost:8081, localhost:9098)
- `NODE_ENV=development` - Development environment flag

## Database Schema (Firestore)

### Bills Collection
- **ID format**: `{timestamp36}-{randomHex8}-{matterHash4}` (e.g., `lq3abc12-a1b2c3d4-ef56`)
- **Fields**: members[], dishes[], totals{}, perPersonBreakdown{}, breakdown{}, taxProfile, timestamp, paynowName, paynowID, discount, userId, paymentStatus{}

### Users Collection
- **Fields**: name, email, passcode (bcrypt hashed), created_at, last_login, last_login_ip

### Groups Collection
- **Fields**: members[], timestamp, userId

## Code Conventions

### ESLint Rules (eslint.config.js)
- 2-space indentation
- Single quotes, semicolons required
- `prefer-const`, `no-var`, `eqeqeq: 'always'`
- Unused vars allowed with `_` prefix (`argsIgnorePattern: '^_'`)

### Important Patterns
- **Commented functions** indicate disabled features (e.g., bill expiration check in index.js:1098-1100)
- **Bill ID validation**: Always validate with `isValidBillId()` before database operations
- **Rate limiters**: Different limits per endpoint (billCreateLimiter, resultViewLimiter, deleteLimiter)
- **Input sanitization**: Use `validator.escape()` for user inputs via `sanitizeInput` middleware

### Build Output
- Source files: `script.js`, `styles.css`, `result.js`, `login.js`
- Minified: `*.min.js`, `*.min.css` (production uses minified versions based on NODE_ENV)