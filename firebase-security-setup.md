# Firebase Security Setup for SettleLah

This guide will help you implement Firebase Security Rules for your SettleLah application.

## 1. Deploy Firestore Security Rules

The `firestore.rules` file contains security rules that protect your bills data from unauthorized access.

### To deploy the rules:

1. Install Firebase CLI (if not already installed):

   ```
   npm install -g firebase-tools
   ```

2. Login to Firebase:

   ```
   firebase login
   ```

3. Initialize Firebase in your project directory (if not already done):

   ```
   firebase init
   ```

   - Select Firestore when prompted
   - Choose your Firebase project
   - When asked about security rules, specify `firestore.rules`

4. Deploy the rules:
   ```
   firebase deploy --only firestore:rules
   ```

## 2. Enhance Bill Data with Owner Information

To improve security, add ownership tracking to each bill. This requires modifying your code to include the user ID when creating bills.

### Modify the `/calculate` endpoint in `index.js`:

```javascript
app.post("/calculate", async (req, res) => {
  // Existing code...

  const billData = {
    members,
    settleMatter,
    dishes,
    totals,
    perPersonBreakdown,
    breakdown,
    taxProfile,
    timestamp: Date.now(),
    paynowName,
    paynowID,
    serviceChargeRate: `${parseFloat(serviceChargeValue || 10)}%`,
    gstRate: `${(gstRate * 100).toFixed(0)}%`,
    // Add ownership information
    createdBy: req.headers.authorization ? req.headers.authorization.split(" ")[1] : null,
    createdIP: req.ip || req.headers["x-forwarded-for"] || "unknown",
  };

  // Existing code...
});
```

### Update Firestore Rules for Owner-Based Access

After implementing this change, you can enhance your security rules to restrict deletion to only the owner:

```
// In firestore.rules, update the delete rule:
allow delete: if isAuthenticated() &&
               (resource.data.createdBy == request.auth.token ||
                resource.data.createdBy == null);
```

## 3. Rate Limiting Implementation Recommendation

To protect your API from abuse, consider implementing rate limiting. A simple approach is to use Express middleware:

1. Install the rate-limiting package:

   ```
   npm install express-rate-limit
   ```

2. Add rate limiting to sensitive endpoints in `index.js`:

   ```javascript
   const rateLimit = require("express-rate-limit");

   // Create limiter for bill creation
   const billCreateLimiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 20, // limit each IP to 20 requests per windowMs
     message: "Too many bills created, please try again later",
     standardHeaders: true,
     legacyHeaders: false,
   });

   // Apply to the calculate endpoint
   app.post("/calculate", billCreateLimiter, async (req, res) => {
     // Existing code...
   });
   ```

## 4. Test Your Security Rules

1. Use the Firebase Emulator Suite to test your rules:

   ```
   firebase emulators:start
   ```

2. Write tests for your security rules using the Firebase Rules Unit Testing framework.

## 5. Additional Security Recommendations

1. **Enable Firebase App Check**: Protects your backend resources from abuse.
2. **Implement Data Purging**: Automatically delete expired bills to comply with privacy regulations.
3. **Add Logging**: Track who's accessing your data to detect unusual patterns.

For further assistance or questions, please contact the development team.
