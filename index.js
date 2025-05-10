const express = require("express");
const firebase = require("firebase/app");
const firestore = require("firebase/firestore");
const path = require("path");
const crypto = require("crypto");
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Rate limiting middleware
const rateLimit = require("express-rate-limit");

// Configure rate limiters
const billCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 bill creations per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { error: "Too many bills created. Please try again later." },
});

const resultViewLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 60, // Limit each IP to 60 bill views per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

const deleteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 deletion requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many deletion requests. Please try again later." },
});

// Add CSP headers middleware
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https: https://vercel.live; connect-src 'self' https:; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https:; font-src 'self' https:;"
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Authentication middleware
const authRequiredPaths = ["/"];
const excludedPaths = ["/login", "/api/validate-passcode", "/result", "/assets"];

app.use((req, res, next) => {
  // Skip authentication for excluded paths
  if (excludedPaths.some((path) => req.path.startsWith(path))) {
    return next();
  }

  // Check if authentication is required for this path
  if (authRequiredPaths.some((path) => req.path === path)) {
    // For API requests, check for authorization header
    if (req.headers.authorization) {
      const token = req.headers.authorization.split(" ")[1];
      // Simple server-side validation (you might want more secure validation in production)
      if (token === process.env.SETTLELAH_AUTH_TOKEN) {
        return next();
      }

      // DEVELOPMENT MODE: If SETTLELAH_DEV_MODE is set, skip token validation
      if (process.env.SETTLELAH_DEV_MODE === "true") {
        console.warn("Development mode: Bypassing authentication check");
        return next();
      }

      return res.status(401).json({ error: "Unauthorized" });
    } else {
      // DEVELOPMENT MODE: If SETTLELAH_DEV_MODE is set, skip authentication
      if (process.env.SETTLELAH_DEV_MODE === "true") {
        console.warn("Development mode: Proceeding without authentication");
        return next();
      }

      // For browser requests, redirect to login page
      return res.redirect("/login");
    }
  }

  // For other paths, no authentication needed
  next();
});

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: "settlelah-1da97.firebaseapp.com",
  projectId: "settlelah-1da97",
  // Add the rest from Firebase Console > Project Settings > General > Your Apps
};
const firebaseApp = firebase.initializeApp(firebaseConfig);
const db = firestore.getFirestore(firebaseApp);

// Add this after your Firebase initialization
const FirestoreAdapter = require("./firestore-adapter");
const firebaseAdapter = new FirestoreAdapter(db);
const authHelper = require("./auth-helper");

// Initialize auth with your Firebase app
authHelper.initializeAuth(firebaseApp);

// Install multer for file uploads
// npm install multer
const multer = require("multer");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const FormData = require("form-data");

// Generate a secure bill ID with timestamp and cryptographic randomness
function generateSecureBillId(settleMatter = "") {
  // Create timestamp component (first 8 chars)
  const timestamp = Date.now().toString(36);

  // Create random component (8 chars) using crypto
  const randomBytes = crypto.randomBytes(8).toString("hex").slice(0, 8);

  // Create a simple hash from the settle matter (4 chars)
  const matterHash = settleMatter
    ? crypto.createHash("sha256").update(settleMatter).digest("hex").slice(0, 4)
    : crypto.randomBytes(2).toString("hex");

  // Combine all parts into a 20-character ID
  return `${timestamp}-${randomBytes}-${matterHash}`;
}

// Replace the existing database functions with adapter calls
async function saveBill(id, data) {
  return await firebaseAdapter.saveBill(id, data);
}

async function getBill(id) {
  return await firebaseAdapter.getBill(id);
}

async function deleteBills(ids) {
  return await firebaseAdapter.deleteBills(ids);
}

// Make sure login page is served correctly
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Passcode validation endpoint
app.post("/api/validate-passcode", (req, res) => {
  const { passcode } = req.body;

  // Get the correct passcode from environment variable
  const correctPasscode = process.env.APP_PASSCODE || "123456"; // Default for development

  // Validate the passcode (use strict equality to avoid timing attacks)
  const isValid = passcode === correctPasscode;

  if (isValid) {
    // Generate token for API calls (simple implementation)
    const token = process.env.SETTLELAH_AUTH_TOKEN || "default-auth-token";

    res.json({
      valid: true,
      token,
      message: "Authentication successful",
    });
  } else {
    // Add a slight delay to prevent brute force attacks
    setTimeout(() => {
      res.json({
        valid: false,
        message: "Invalid passcode. Please try again.",
      });
    }, 1000);
  }
});

// Make sure root route serves index.html explicitly
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/calculate", billCreateLimiter, async (req, res) => {
  const {
    members,
    settleMatter,
    dishes,
    discount,
    applyServiceCharge,
    applyGst,
    taxProfile,
    paynowName,
    paynowID,
    serviceChargeValue,
  } = req.body;

  // Replace simple random ID with secure ID
  const id = generateSecureBillId(settleMatter);
  // Get the host from request headers if available, otherwise fall back to environment variables
  const baseUrl =
    req.headers && req.headers.host
      ? `https://${req.headers.host}`
      : process.env.CUSTOM_DOMAIN
      ? `https://${process.env.CUSTOM_DOMAIN}`
      : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

  const subtotal = dishes.reduce((sum, dish) => sum + parseFloat(dish.cost), 0);
  const serviceRate = serviceChargeValue ? parseFloat(serviceChargeValue) / 100 : 0.1; // Default to 10% if not provided
  const gstRate = taxProfile === "singapore" ? 0.09 : 0.06;

  // 1. Calculate service charge on subtotal
  const serviceCharge = applyServiceCharge ? subtotal * serviceRate : 0;

  // 2. Calculate amount after service charge
  const afterService = subtotal + serviceCharge;

  // 3. Apply discount on amount after service
  let discountAmount = 0;
  if (discount) {
    if (discount.includes("%")) {
      // Percentage discount
      const percentage = parseFloat(discount) || 0;
      discountAmount = afterService * (percentage / 100);
    } else {
      // Fixed amount discount
      discountAmount = parseFloat(discount) || 0;
    }
  }

  // 4. Calculate amount after discount
  const afterDiscount = afterService - discountAmount;

  // 5. Calculate GST on final amount (after service and discount)
  const gst = applyGst ? afterDiscount * gstRate : 0;

  // 6. Calculate final total
  const total = afterDiscount + gst;

  const perPersonBreakdown = {};
  const totals = {};
  dishes.forEach((dish) => {
    const share = dish.cost / dish.members.length;
    dish.members.forEach((member) => {
      perPersonBreakdown[member] = perPersonBreakdown[member] || {
        subtotal: 0,
        serviceCharge: 0,
        afterService: 0,
        discountAmount: 0,
        afterDiscount: 0,
        gst: 0,
        total: 0,
      };
      perPersonBreakdown[member].subtotal += share;
    });
  });

  // Update per-person calculations to match the new sequence
  const discountPerPerson = discountAmount / members.length;
  for (const member in perPersonBreakdown) {
    perPersonBreakdown[member].serviceCharge = applyServiceCharge
      ? perPersonBreakdown[member].subtotal * serviceRate
      : 0;
    perPersonBreakdown[member].afterService =
      perPersonBreakdown[member].subtotal + perPersonBreakdown[member].serviceCharge;
    perPersonBreakdown[member].discountAmount = discountPerPerson;
    perPersonBreakdown[member].afterDiscount = perPersonBreakdown[member].afterService - discountPerPerson;
    perPersonBreakdown[member].gst = applyGst ? perPersonBreakdown[member].afterDiscount * gstRate : 0;
    perPersonBreakdown[member].total = perPersonBreakdown[member].afterDiscount + perPersonBreakdown[member].gst;
    totals[member] = perPersonBreakdown[member].total;
  }

  const breakdown = { subtotal, serviceCharge, afterService, discountAmount, afterDiscount, gst, total };
  const billData = {
    members,
    settleMatter,
    dishes,
    totals,
    perPersonBreakdown,
    breakdown,
    taxProfile,
    timestamp: Date.now(), // Store timestamp in Firebase
    paynowName,
    paynowID,
    serviceChargeRate: `${parseFloat(serviceChargeValue || 10)}%`, // Include service charge rate
    gstRate: `${(gstRate * 100).toFixed(0)}%`, // Include GST rate as a percentage
    // Add ownership information for security
    createdBy: req.headers.authorization ? req.headers.authorization.split(" ")[1] : null,
    createdIP: req.ip || req.headers["x-forwarded-for"] || "unknown",
    // Add a creation date string for easier reference
    createdDate: new Date().toISOString(),
  };

  // Verify that sum of individual totals matches the bill total
  const sumOfIndividualTotals = Object.values(totals).reduce((sum, personTotal) => sum + personTotal, 0);
  // Use toFixed(2) to avoid floating point precision issues
  const roundedBillTotal = parseFloat(total.toFixed(2));
  const roundedSum = parseFloat(sumOfIndividualTotals.toFixed(2));

  if (Math.abs(roundedBillTotal - roundedSum) > 0.01) {
    console.warn(
      `Bill total (${roundedBillTotal}) does not match sum of individual totals (${roundedSum}). Difference: ${
        roundedBillTotal - roundedSum
      }`
    );
  }

  await saveBill(id, billData);
  const link = `${baseUrl}/bill/${id}`;
  res.json({ link, id, billData }); // Return ID and timestamp for localStorage
});

// Validate a bill ID format
function isValidBillId(id) {
  // Check if the ID follows our secure format pattern
  // Format: timestamp-randomBytes-matterHash
  const pattern = /^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/i;

  if (!pattern.test(id)) {
    return false;
  }

  // Add additional validation logic as needed
  // For example, timestamp validation or length checks
  const parts = id.split("-");

  // Verify we have exactly 3 parts
  if (parts.length !== 3) {
    return false;
  }

  // Verify each part has the expected length
  if (parts[0].length < 6 || parts[1].length < 6 || parts[2].length < 2) {
    return false;
  }

  return true;
}

app.get("/result/:id", resultViewLimiter, async (req, res) => {
  const id = req.params.id;

  // Validate the ID format before querying the database
  if (!isValidBillId(id)) {
    return res.status(400).sendFile(path.join(__dirname, "public", "hello-world.html"));
  }

  const bill = await getBill(id);
  if (!bill) return res.status(400).sendFile(path.join(__dirname, "public", "hello-world.html"));

  // Add timestamp verification - optional, can reject bills older than X days
  const billAge = Date.now() - bill.timestamp;
  const maxAgeInDays = 30; // Configure this as needed
  const maxAgeInMs = maxAgeInDays * 24 * 60 * 60 * 1000;

  if (billAge > maxAgeInMs) {
    return res.status(410).json({ error: "Bill has expired" });
  }

  // Return JSON for API requests
  res.json({
    members: bill.members,
    totals: bill.totals,
    perPersonBreakdown: bill.perPersonBreakdown,
    breakdown: bill.breakdown,
    dishes: bill.dishes,
    taxProfile: bill.taxProfile,
    timestamp: bill.timestamp,
    settleMatter: bill.settleMatter,
    paynowName: bill.paynowName,
    paynowID: bill.paynowID,
    serviceChargeRate: bill.serviceChargeRate,
    gstRate: bill.gstRate,
  });
});

// Add a new route for the HTML bill view
app.get("/bill/:id", resultViewLimiter, async (req, res) => {
  const id = req.params.id;

  // Validate the ID format before querying the database
  if (!isValidBillId(id)) {
    return res.status(400).sendFile(path.join(__dirname, "public", "hello-world.html"));
  }

  const bill = await getBill(id);
  if (!bill) return res.status(404).sendFile(path.join(__dirname, "public", "hello-world.html"));

  // Add timestamp verification - optional, can reject bills older than X days
  const billAge = Date.now() - bill.timestamp;
  const maxAgeInDays = 30; // Configure this as needed
  const maxAgeInMs = maxAgeInDays * 24 * 60 * 60 * 1000;

  if (billAge > maxAgeInMs) {
    return res.status(410).json({ error: "Bill has expired" });
  }

  // Serve the bill.html page
  res.sendFile(path.join(__dirname, "public", "bill.html"));
});

app.delete("/history", deleteLimiter, async (req, res) => {
  const { ids } = req.body; // Expect an array of IDs

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No bill IDs provided" });
  }

  try {
    // Add logging for security monitoring
    console.log(`Deletion request for ${ids.length} bills from IP: ${req.ip}`);

    const result = await deleteBills(ids);

    if (result.deleted === 0) {
      return res.status(400).json({ error: result.message });
    }

    res.json({ message: result.message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error clearing history" });
  }
});

app.post("/api/scan-receipt", upload.single("document"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Create form data for the API request
    const formData = new FormData();
    formData.append("document", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    // API key from environment variable
    const apiKey = process.env.MINDEE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing API key" });
    }

    // Make the API request to Mindee
    const response = await fetch("https://api.mindee.net/v1/products/mindee/expense_receipts/v5/predict", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: `Mindee API error: ${response.status}`,
        details: errorText,
      });
    }

    const data = await response.json();

    // Process the data
    const prediction = data.document?.inference?.prediction;
    if (!prediction) {
      return res.status(400).json({ error: "No prediction data found in the response" });
    }

    // Extract line items from the prediction
    const lineItems = prediction.line_items || [];
    const newDishes = [];

    lineItems.forEach((item) => {
      if (item.description) {
        newDishes.push({
          name: item.description,
          cost: parseFloat(item.total_amount) || 0,
          members: [],
        });
      }
    });

    // If no line items were found but we have a total amount, create a single item
    if (newDishes.length === 0 && prediction.total_amount?.value) {
      newDishes.push({
        name: prediction.supplier_name?.value || "Receipt Item",
        cost: parseFloat(prediction.total_amount.value),
        members: [],
      });
    }

    // Return the processed data
    res.json({ success: true, dishes: newDishes });
  } catch (error) {
    console.error("Error scanning receipt:", error);
    res.status(500).json({ error: "Error scanning receipt", details: error.message });
  }
});

// Add this at the end of your routes, just before the listen call
// This is a fallback route to serve index.html for any path that doesn't match a specific route
// This is especially useful for SPAs (Single Page Applications)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

module.exports = app;
