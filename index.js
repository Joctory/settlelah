const express = require("express");
const { initializeApp } = require("firebase/app");
const { getFirestore, doc, setDoc, getDoc, deleteDoc, writeBatch } = require("firebase/firestore");
const app = express();
app.use(express.json());
app.use(express.static("public"));

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: "settlelah-1da97.firebaseapp.com",
  projectId: "settlelah-1da97",
  // Add the rest from Firebase Console > Project Settings > General > Your Apps
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Install multer for file uploads
// npm install multer
const multer = require("multer");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const FormData = require("form-data");

async function saveBill(id, data) {
  await setDoc(doc(db, "bills", id), data);
}

async function getBill(id) {
  const billDoc = await getDoc(doc(db, "bills", id));
  return billDoc.exists() ? billDoc.data() : null;
}

async function deleteBills(ids) {
  const batch = writeBatch(db);
  ids.forEach((id) => {
    const billRef = doc(db, "bills", id);
    batch.delete(billRef);
  });
  await batch.commit();
}

app.post("/calculate", async (req, res) => {
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
  const id = Math.random().toString(36).substring(2, 8);
  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";

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
  const link = `${baseUrl}/result/${id}`;
  res.json({ link, id, billData }); // Return ID and timestamp for localStorage
});

app.get("/result/:id", async (req, res) => {
  const bill = await getBill(req.params.id);
  if (!bill) return res.status(404).json({ error: "Bill not found" });

  // Check if the client is requesting HTML (browser) or JSON (API)
  const acceptsHtml = req.accepts(["html", "json"]) === "html";

  if (acceptsHtml) {
    // Serve the result.html page for browser requests
    res.sendFile("result.html", { root: "./public" });
  } else {
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
    });
  }
});

app.delete("/history", async (req, res) => {
  const { ids } = req.body; // Expect an array of IDs
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).send("No bill IDs provided");
  }
  try {
    await deleteBills(ids);
    res.send("History cleared from Firebase");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error clearing history");
  }
});

app.post("/api/scan-receipt", upload.single("document"), async (req, res) => {
  // try {
  //   if (!req.file) {
  //     return res.status(400).json({ error: "No file uploaded" });
  //   }

  //   // Create form data for the API request
  //   const formData = new FormData();
  //   formData.append("document", req.file.buffer, {
  //     filename: req.file.originalname,
  //     contentType: req.file.mimetype,
  //   });

  //   // API key from environment variable
  //   const apiKey = process.env.MINDEE_API_KEY;
  //   if (!apiKey) {
  //     return res.status(500).json({ error: "Missing API key" });
  //   }

  //   // Make the API request to Mindee
  //   const response = await fetch("https://api.mindee.net/v1/products/mindee/expense_receipts/v5/predict", {
  //     method: "POST",
  //     headers: {
  //       Authorization: `Token ${apiKey}`,
  //     },
  //     body: formData,
  //   });

  //   if (!response.ok) {
  //     const errorText = await response.text();
  //     return res.status(response.status).json({
  //       error: `Mindee API error: ${response.status}`,
  //       details: errorText,
  //     });
  //   }

  //   const data = await response.json();

  //   // Process the data
  //   const prediction = data.document?.inference?.prediction;
  //   if (!prediction) {
  //     return res.status(400).json({ error: "No prediction data found in the response" });
  //   }

  //   // Extract line items from the prediction
  //   const lineItems = prediction.line_items || [];
  //   const newDishes = [];

  //   lineItems.forEach((item) => {
  //     if (item.description) {
  //       newDishes.push({
  //         name: item.description,
  //         cost: parseFloat(item.total_amount) || 0,
  //         members: [],
  //       });
  //     }
  //   });

  //   // If no line items were found but we have a total amount, create a single item
  //   if (newDishes.length === 0 && prediction.total_amount?.value) {
  //     newDishes.push({
  //       name: prediction.supplier_name?.value || "Receipt Item",
  //       cost: parseFloat(prediction.total_amount.value),
  //       members: [],
  //     });
  //   }

  //   // Return the processed data
  //   res.json({ success: true, dishes: newDishes });
  // } catch (error) {
  //   console.error("Error scanning receipt:", error);
  //   res.status(500).json({ error: "Error scanning receipt", details: error.message });
  // }
  res.json({ success: true, dishes: [{ name: "test", cost: 10, members: [] }] });
});

// app.listen(3000, () => console.log("Server running on http://localhost:3000"));
module.exports = app;
