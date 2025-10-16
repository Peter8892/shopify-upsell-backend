// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// ENV variables from Render
const SHOPIFY_STORE = process.env.SHOPIFY_STORE; // e.g. royalwholesalecandy.myshopify.com
const ADMIN_TOKEN = process.env.ADMIN_TOKEN; // your private access token

// 🩺 Health check endpoint
app.get("/healthz", (req, res) => {
  res.json({ status: "ok" });
});

// 🛍 Fetch products from Shopify
app.get("/api/products", async (req, res) => {
  try {
    const response = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2025-10/products.json?limit=5`,
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

// 💡 Dynamic Upsell Endpoint
app.get("/api/upsell", async (req, res) => {
  const { customer_id } = req.query;

  if (!customer_id) {
    return res.status(400).json({ error: "Missing customer_id" });
  }

  try {
    // Fetch last orders from Shopify
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

    // Extract product titles from last orders
    const productNames = pastOrders.flatMap((order) =>
      order.line_items.map((item) => item.title)
    );

    // Mock seasonal logic
    const month = new Date().getMonth();
    const seasonalSuggestions = [
      ["Candy Corn", "Pumpkin Spice Chocolate"], // Oct
      ["Gingerbread Fudge", "Peppermint Bark"], // Dec
      ["Valentine Hearts", "Strawberry Truffles"], // Feb
      ["Easter Eggs", "Jelly Beans"], // Apr
    ];

    const season = seasonalSuggestions[Math.floor((month % 12) / 3)] || [];
    const randomMsg = [
      "Looks like it’s that time again! Would you like to restock?",
      "We noticed you love these — perfect timing for this season!",
      "Back by popular demand! These pair perfectly with your usual picks.",
      "Special treat alert 🍫 — your favorites are trending again!",
    ];

    const message =
      randomMsg[Math.floor(Math.random() * randomMsg.length)] +
      (season.length ? ` Try our seasonal picks: ${season.join(", ")}.` : "");

    res.json({
      message,
      recommended: season.concat(productNames.slice(0, 2)),
    });
  } catch (err) {
    console.error("Upsell error:", err);
    res.status(500).json({ error: "Failed to generate upsell" });
  }
});

// Start the server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
