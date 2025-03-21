const express = require("express");
const { kv } = require("@vercel/kv");
const app = express();
app.use(express.json());
app.use(express.static("public"));

async function saveBill(id, data) {
  await kv.set(`bill:${id}`, JSON.stringify(data));
}

async function getBill(id) {
  return await kv.get(`bill:${id}`);
}

app.post("/calculate", async (req, res) => {
  const { members, dishes, discount, applyServiceCharge, applyGst, taxProfile } = req.body;
  const id = Math.random().toString(36).substring(2, 8);
  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";

  let total = dishes.reduce((sum, dish) => sum + dish.cost, 0);
  const discountAmount = parseFloat(discount) || 0;
  total -= discountAmount;

  const serviceRate = 0.1;
  const gstRate = taxProfile === "singapore" ? 0.09 : 0.06;
  const serviceCharge = applyServiceCharge ? total * serviceRate : 0;
  const gst = applyGst ? total * gstRate : 0;
  total += serviceCharge + gst;

  const split = {};
  dishes.forEach((dish) => {
    const share = dish.cost / dish.members.length;
    dish.members.forEach((member) => {
      split[member] = (split[member] || 0) + share;
    });
  });

  const billData = { members, dishes, total, split, discount, serviceCharge, gst };
  await saveBill(id, billData);
  const link = `${baseUrl}/result/${id}`;
  res.json({ link });
});

app.get("/result/:id", async (req, res) => {
  const billData = await getBill(req.params.id);
  if (!billData) return res.status(404).send("Bill not found");
  const { total, split, dishes, serviceCharge, gst } = JSON.parse(billData);

  let html = `
    <h1>Bill Split Result</h1>
    <h2>Total: $${total.toFixed(2)}</h2>
    ${serviceCharge ? `<p>Service Charge: $${serviceCharge.toFixed(2)}</p>` : ""}
    ${gst ? `<p>GST: $${gst.toFixed(2)}</p>` : ""}
    <h3>Per Person:</h3>
    <ul>
  `;
  for (const [member, amount] of Object.entries(split)) {
    html += `<li>${member}: $${amount.toFixed(2)}</li>`;
  }
  html += `
    </ul>
    <h3>Dishes:</h3>
    <ul>
  `;
  dishes.forEach((dish) => {
    html += `<li>${dish.name}: $${dish.cost.toFixed(2)} (split: ${dish.members.join(", ")})</li>`;
  });
  html += `
    </ul>
    <a href="/">Back to Home</a>
  `;
  res.send(html);
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
