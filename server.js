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

// 🛍 Fetch products from Shopify (optional endpoint)
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

// 💡 Upsell endpoint using past orders
app.get("/api/upsell", async (req, res) => {
  const { customer_id } = req.query;

  if (!customer_id) {
    return res.status(400).json({ error: "Missing customer_id" });
  }

  try {
    // Fetch last year of orders
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const dateQuery = oneYearAgo.toISOString();

    const ordersResponse = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2025-10/customers/${customer_id}/orders.json?status=any&created_at_min=${dateQuery}&limit=250`,
      {
        headers: {
          "X-Shopify-Access-Token": ADMIN_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const ordersData = await ordersResponse.json();
    const pastOrders = ordersData.orders || [];

    // Weighted scoring based on recency
    const productScores = {};
    const today = new Date();

    pastOrders.forEach(order => {
      const orderDate = new Date(order.created_at);
      const daysAgo = (today - orderDate) / (1000 * 60 * 60 * 24); // days since order
      order.line_items.forEach(item => {
        productScores[item.title] = (productScores[item.title] || 0) + 1 / (1 + daysAgo / 30);
      });
    });

    // Sort top 5 products
    const topProducts = Object.entries(productScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([title]) => title);

    // Seasonal suggestions (optional)
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
      recommended: [...season, ...topProducts],
    });
  } catch (err) {
    console.error("Upsell error:", err);
    res.status(500).json({ error: "Failed to generate upsell" });
  }
});

// Start the server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
