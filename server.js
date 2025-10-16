// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// ====== Environment Variables ======
// Set these in Render → Settings → Environment Variables
const SHOPIFY_STORE = process.env.SHOPIFY_STORE; // e.g., royalwholesalecandy.myshopify.com
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;     // Shopify Admin API private token

// ====== Health Check ======
app.get("/healthz", (req, res) => {
  res.json({ status: "ok" });
});

// ====== Fetch Products (optional) ======
app.get("/api/products", async (req, res) => {
  try {
    const response = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2025-10/products.json?limit=10`,
      {
        headers: {
          "X-Shopify-Access-Token": ADMIN_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();
    res.json(data.products || []);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// ====== Dynamic Upsell Endpoint ======
app.get("/api/upsell", async (req, res) => {
  const { customer_id } = req.query;

  if (!customer_id) {
    return res.status(400).json({ error: "Missing customer_id" });
  }

  try {
    // 1️⃣ Fetch last 3 orders from Shopify
    const orderResponse = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2025-10/customers/${customer_id}/orders.json?status=any&limit=3`,
      {
        headers: {
          "X-Shopify-Access-Token": ADMIN_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const ordersData = await orderResponse.json();
    const pastOrders = ordersData.orders || [];

    // 2️⃣ Extract product names from last orders
    const purchasedProducts = pastOrders.flatMap(order =>
      order.line_items.map(item => item.title)
    );

    // 3️⃣ Seasonal suggestions based on month
    const month = new Date().getMonth(); // 0 = Jan, 11 = Dec
    const seasonalRecommendations = {
      0: ["Winter Chocolate Mix", "Hot Cocoa Bombs"],         // Jan
      1: ["Valentine Hearts", "Strawberry Truffles"],         // Feb
      2: ["Spring Gummies", "Chocolate Carrots"],            // Mar
      3: ["Easter Eggs", "Jelly Beans"],                     // Apr
      4: ["Mother's Day Chocolate Box", "Fruit Chews"],      // May
      5: ["Summer Gummies", "Ice Cream Candy"],              // Jun
      6: ["Patriotic Candies", "Berry Gummies"],             // Jul
      7: ["Back to School Snacks", "Fun Size Chocolates"],   // Aug
      8: ["Autumn Fudge", "Pumpkin Spice Treats"],           // Sep
      9: ["Candy Corn", "Pumpkin Spice Chocolate"],          // Oct
      10: ["Halloween Treats", "Chocolate Skeletons"],       // Nov
      11: ["Gingerbread Fudge", "Peppermint Bark"],          // Dec
    };

    const seasonal = seasonalRecommendations[month] || [];

    // 4️⃣ Random upsell message templates
    const messages = [
      "Looks like it’s that time again! Would you like to restock?",
      "We noticed you love these — perfect timing for this season!",
      "Back by popular demand! These pair perfectly with your usual picks.",
      "Special treat alert 🍫 — your favorites are trending again!",
      "Seasonal specials you might enjoy!",
      "Your favorites + our seasonal picks = perfect combo!",
    ];

    const message = messages[Math.floor(Math.random() * messages.length)] +
      (seasonal.length ? ` Try our seasonal picks: ${seasonal.join(", ")}.` : "");

    // 5️⃣ Combine purchased products + seasonal for recommendation
    const recommended = [...new Set([...seasonal, ...purchasedProducts.slice(0, 3)])];

    res.json({ message, recommended });
  } catch (err) {
    console.error("Upsell error:", err);
    res.status(500).json({ error: "Failed to generate upsell" });
  }
});

// ====== Start Server ======
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
