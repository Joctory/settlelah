# 🧾 SettleLah

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-16%2B-green.svg)](https://nodejs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-orange.svg)](https://firebase.google.com/)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black.svg)](https://vercel.com)

> A sophisticated, secure bill-splitting web application built with modern Node.js technologies, featuring OCR receipt scanning, robust authentication, and real-time collaboration.

<div align="center">
  <img src="https://raw.githubusercontent.com/Joctory/settlelah/main/public/assets/settlelah-1.png" alt="SettleLah App" width="600"/>
  <p><em>Seamless bill splitting with automatic GST and service charge calculations</em></p>
</div>

[🚀 Live Demo](https://settlelah.app) | [📹 Video Demo](#video-demo) | [📖 Documentation](#documentation) | [🛠 Installation](#installation)

## 📹 Video Demo

<div align="center">
  <a href="https://settlelah.app/Demo">
    <img src="https://raw.githubusercontent.com/Joctory/settlelah/main/public/assets/demo-holder.jpg" alt="SettleLah Demo Video" width="600"/>
    <br/>
    <img src="https://img.shields.io/badge/▶️%20Watch%20Demo-FF0000?style=for-the-badge&logo=youtube&logoColor=white" alt="Watch Demo"/>
  </a>
  <p><em>See SettleLah in action! 2-minute walkthrough of key features</em></p>
</div>

## 💡 The Problem & Solution

**The Challenge**: Colleagues constantly struggled with complex GST/service charge calculations during group meals in Singapore & Malaysia, leading to time-consuming manual work and calculation errors. Sound familiar? 😅

**The Solution**: Built a full-stack app solving real problems for Singapore & Malaysia's dining culture. SettleLah! automatically calculates GST and service charges while extracting receipt data through OCR technology—turning manual bill splitting into a seamless experience.

**The Result**: Now eating outside with friends is now very easy sia! 🎉

## 🌟 Key Features

### 💳 **Smart Bill Splitting**

- **OCR Receipt Scanning** via Mindee API - Upload receipts and extract itemized data automatically
- **Intelligent Item Distribution** - Drag-and-drop interface for assigning items to members
- **Dynamic Cost Calculation** - Real-time updates with service charges, taxes, and tips
- **Multi-currency Support** - Handle various currencies and exchange rates

### 🔐 **Enterprise-Grade Security**

- **Multi-factor Authentication** - 6-digit passcode + JWT token validation
- **Rate Limiting** - Configurable per-endpoint protection against abuse
- **CSRF Protection** - Complete protection against cross-site request forgery
- **Input Validation** - Comprehensive sanitization using Validator.js
- **Firestore Security Rules** - Database-level access control

### 👥 **Collaboration & Groups**

- **Saved Groups Management** - Persistent member groups for recurring bills
- **Real-time Collaboration** - Live updates as members interact with bills
- **Member Role Management** - Assign different permissions and responsibilities
- **History Tracking** - Complete audit trail of all transactions

### 🎨 **Modern UX/UI**

- **Progressive Web App** - Full PWA functionality with offline support
- **Responsive Design** - Mobile-first approach with touch-optimized interface
- **Dark/Light Mode** - Automatic theme switching based on system preferences
- **Accessibility** - WCAG 2.1 AA compliant with screen reader support

<div align="center">
  <img src="https://raw.githubusercontent.com/Joctory/settlelah/main/public/assets/settlelah-2.png" alt="SettleLah App Bill Page" width="600"/>
  <p><em>Easy understanding bill details for your friends and family to understand how much they should pay!</em></p>
</div>

## 🏗 Technical Architecture

### **Backend Stack**

- **Node.js** + **Express.js** - High-performance server with middleware architecture
- **Firebase Firestore** - NoSQL database with real-time synchronization
- **Firebase Authentication** - Secure user management and session handling
- **Multer** - File upload handling for receipt images
- **bcrypt** - Password hashing with salt rounds

### **Frontend Stack**

- **Vanilla JavaScript** - No framework dependencies for maximum performance
- **CSS Grid & Flexbox** - Modern layout techniques
- **Service Workers** - Offline functionality and caching strategies
- **Web APIs** - Camera, File System, Push Notifications

### **DevOps & Deployment**

- **Vercel** - Serverless deployment with edge functions
- **Firebase Emulators** - Local development environment
- **GitHub Actions** - CI/CD pipeline (ready for implementation)
- **ESLint + Prettier** - Code quality and formatting

### **Security Implementation**

```javascript
// Rate limiting configuration
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP",
  standardHeaders: true,
  legacyHeaders: false,
});

// CSRF protection
app.use(
  csrf({
    cookie: true,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  })
);
```

## 🚀 Quick Start

### Prerequisites

- Node.js 16+
- Firebase project with Firestore enabled
- Mindee account for OCR functionality

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/Joctory/settlelah.git
   cd settlelah
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your actual API keys and configuration
   ```

4. **Set up Firebase**

   ```bash
   npm run deploy-rules
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

### Environment Configuration

| Variable               | Description                     | Required |
| ---------------------- | ------------------------------- | -------- |
| `APP_PASSCODE`         | 6-digit authentication passcode | ✅       |
| `SETTLELAH_AUTH_TOKEN` | Secure API authentication token | ✅       |
| `FIREBASE_API_KEY`     | Firebase project API key        | ✅       |
| `MINDEE_API_KEY`       | Mindee OCR service API key      | ✅       |
| `SETTLELAH_DEV_MODE`   | Enable development mode         | ❌       |

## 🧪 Testing

```bash
# Run security tests with Firebase emulators
npm run test:security

# Run all tests
npm test

# Start Firebase emulators for local testing
firebase emulators:start
```

## 📦 Build & Deployment

```bash
# Build for production
npm run build

# Deploy to Vercel
vercel --prod

# Deploy Firebase rules only
npm run deploy-rules
```

## 🔧 Development

### Project Structure

```
├── api/                 # Vercel serverless functions
├── public/             # Static assets and client-side code
│   ├── assets/        # SVG icons and images
│   ├── icons/         # PWA icons
│   └── *.html         # Application pages
├── firestore.rules    # Database security rules
├── index.js           # Main Express server
├── firestore-adapter.js # Database abstraction layer
└── auth-helper.js     # Authentication utilities
```

### Key Scripts

- `npm run dev` - Development server with hot reload
- `npm run build` - Production build with minification
- `npm run test:security` - Firebase security rules testing
- `npm run dev:vercel` - Local Vercel development environment

## 🎯 Performance Optimizations

- **Code Splitting** - Lazy loading of non-critical JavaScript
- **Image Optimization** - WebP format with fallbacks
- **Caching Strategy** - Service worker with stale-while-revalidate
- **Bundle Analysis** - Terser for JavaScript minification
- **CSS Optimization** - CleanCSS for stylesheet compression

## 🔐 Security Features

- ✅ Content Security Policy (CSP) headers
- ✅ HTTP security headers via Helmet.js
- ✅ SQL injection prevention
- ✅ XSS protection with input sanitization
- ✅ CSRF token validation
- ✅ Rate limiting per endpoint
- ✅ Secure session management
- ✅ Environment variable protection

## 📊 Monitoring & Analytics

Ready for integration with:

- **Sentry** - Error tracking and performance monitoring
- **Google Analytics** - User behavior analysis
- **Firebase Analytics** - App-specific metrics
- **Vercel Analytics** - Performance insights

## 🤝 Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 About the Developer

Built by **Joel Lee** - Full-Stack Developer passionate about creating secure, user-centric web applications.

- **LinkedIn**: [Connect with me](https://www.linkedin.com/in/joellmk/)
- **Portfolio**: [View my other portfolio](https://joasisweb.com/)
- **Email**: [joellee1998@gmail.com](mailto:joellee1998@gmail.com)

---

⭐ **If you found this project helpful, please consider giving it a star!**
