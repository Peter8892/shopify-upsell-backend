// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const SHOPIFY_STORE = process.env.SHOPIFY_STORE; // e.g. royalwholesalecandy.myshopify.com
const ADMIN_TOKEN = process.env.ADMIN_TOKEN; // Private Admin API token

if (!SHOPIFY_STORE || !ADMIN_TOKEN) {
  console.error("❌ Missing SHOPIFY_STORE or ADMIN_TOKEN environment variable.");
  process.exit(1);
}

// --- Helper: fetch from Shopify API
async function fetchShopify(endpoint) {
  const url = `https://${SHOPIFY_STORE}/admin/api/2025-10/${endpoint}`;
  const res = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": ADMIN_TOKEN,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Shopify API error ${res.status}: ${url}`);
  return res.json();
}

// --- Health check
app.get("/healthz", (_, res) => res.json({ status: "ok" }));

// --- Upsell route
app.get("/api/upsell", async (req, res) => {
  const { customer_id } = req.query;
  if (!customer_id) {
    return res.status(400).json({ error: "Missing customer_id" });
  }

  try {
    // 1️⃣ Fetch customer orders (past year)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const orderData = await fetchShopify(
      `customers/${customer_id}/orders.json?status=any&created_at_min=${oneYearAgo.toISOString()}&limit=250`
    );

    const orders = orderData.orders || [];
    const today = new Date();
    const productScores = {};

    orders.forEach(order => {
      const daysAgo = (today - new Date(order.created_at)) / (1000 * 60 * 60 * 24);
      order.line_items.forEach(item => {
        const score = 1 / (1 + daysAgo / 30);
        productScores[item.product_id] = (productScores[item.product_id] || 0) + score;
      });
    });

    // 2️⃣ Top previously purchased products
    const topProductIds = Object.entries(productScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    let topProducts = [];
    if (topProductIds.length > 0) {
      const prodData = await fetchShopify(`products.json?ids=${topProductIds.join(",")}`);
      topProducts = prodData.products.map(p => ({
        id: p.id,
        title: p.title,
        image: p.image?.src,
        variant_id: p.variants?.[0]?.id,
      }));
    }

    // 3️⃣ Seasonal logic using TAGS
    const month = new Date().getMonth();
    let seasonalTag = null;
    if (month === 9) seasonalTag = "halloween";
    else if (month === 11) seasonalTag = "christmas";
    else if (month === 1) seasonalTag = "valentine";
    else if (month === 3) seasonalTag = "easter";

    let seasonalProducts = [];
    if (seasonalTag) {
      try {
        const seasonData = await fetchShopify(
          `products.json?limit=5&tag=${encodeURIComponent(seasonalTag)}`
        );
        seasonalProducts = seasonData.products.map(p => ({
          id: p.id,
          title: p.title,
          image: p.image?.src,
          variant_id: p.variants?.[0]?.id,
        }));
      } catch (err) {
        console.warn(`⚠️ No seasonal products found for tag: ${seasonalTag}`);
      }
    }

    // 4️⃣ Message
    const messages = [
      "Looks like it’s that time again! Would you like to restock?",
      "We noticed you love these — perfect timing for this season!",
      "Back by popular demand! These pair perfectly with your usual picks.",
      "Special treat alert 🍫 — your favorites are trending again!",
    ];
    const message =
      messages[Math.floor(Math.random() * messages.length)] +
      (seasonalProducts.length ? ` Check out our ${seasonalTag} picks!` : "");

    // ✅ Response
    res.json({
      message,
      recommended: [...seasonalProducts, ...topProducts],
    });
  } catch (err) {
    console.error("Upsell error:", err.message);
    res.status(500).json({ error: "Failed to generate upsell" });
  }
});

// --- Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Upsell backend running on port ${PORT}`));
