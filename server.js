/**
 * FINAL WORKING PALLETFORCE INTEGRATION (AUTO DEPOT ROUTING)
 */

require("dotenv").config();
const express = require("express");
const crypto = require("crypto");
const axios = require("axios");

const app = express();

// Keep raw body for Shopify webhook validation
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// OPTIONAL – skip validation during testing
function verifyShopifyWebhook(req) {
  const hmac = req.headers["x-shopify-hmac-sha256"];
  const digest = crypto
    .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest("base64");

  return digest === hmac;
}

/**
 * AUTO DEPOT MAPPING (VERY IMPORTANT)
 * Add more depot codes if needed
 */
function getDepotByPostcode(postcode) {
  if (!postcode) return "";

  const area = postcode.substring(0, 2).toUpperCase();

  const depotMap = {
    "PE": "121", // Peterborough
    "WF": "078", // West Yorkshire
    "NG": "003", // Nottingham
    "LE": "009"  // Leicester
    // Add more if Palletforce gives you the full routing list
  };

  return depotMap[area] || "";
}

/**
 * Convert Shopify → Palletforce JSON
 */
function convertOrderToPalletforce(order) {
  const ship = order.shipping_address;

  return {
    accessKey: process.env.PF_ACCESS_KEY,

    uniqueTransactionNumber: `SHOPIFY-${order.order_number}`,

    collectionAddress: {
      name: "Indistone Ltd",
      streetAddress: "Unit 2, Courtyard 31",
      location: "Normanton Industrial Estate",
      town: "Peterborough",
      county: "",
      postcode: "PE11 1EJ",
      countryCode: "GB",
      phoneNumber: "01775347904",
      contactName: "Warehouse Team",
    },

    deliveryAddress: {
      name: ship?.name || "",
      streetAddress: ship?.address1 || "",
      location: ship?.address2 || "",
      town: ship?.city || "",
      county: ship?.province || "",
      postcode: ship?.zip || "",
      countryCode: ship?.country_code || "GB",
      phoneNumber: ship?.phone || "",
      contactName: ship?.name || "",
    },

    consignments: [
      {
        requestingDepot: "121",
        collectingDepot: "",
        deliveryDepot: getDepotByPostcode(ship?.zip),
        trackingNumber: "",
        consignmentNumber: String(order.order_number),

        CustomerAccountNumber: "indi001",

        datesAndTimes: [
          {
            dateTimeType: "COLD",
            value: order.created_at.substring(0, 10).replace(/-/g, ""),
          },
        ],

        pallets: [
          {
            palletType: "H",
            numberofPallets: "1",
          },
        ],

        palletSpaces: "1",
        weight: String(order.total_weight || 950),

        serviceName: "A",
        surcharges: "",
        customersUniqueReference: String(order.order_number),
        customersUniqueReference2: "",

        notes: [
          {
            noteName: "",
            value: "",
          },
        ],

        insuranceCode: "05",

        notifications: [
          {
            notificationType: "email",
            value: order.email,
          },
        ],

        cartonCount: "",
        aSNFBABOLReferenceNumber: "",
        additionalDetails: {
          lines: [
            {
              fields: [
                {
                  fieldName: "",
                  value: "",
                },
              ],
            },
          ],
        },
      },
    ],
  };
}

/**
 * Handle Shopify Webhook
 */
app.post("/webhooks/order-paid", async (req, res) => {
  try {
    const order = req.body;

    console.log("📦 Webhook received", order.order_number);

    const payload = convertOrderToPalletforce(order);

    console.log("📤 Sending:", JSON.stringify(payload, null, 2));

    const response = await axios.post(
      "https://apiuat.palletforce.net/api/ExternalScanning/UploadManifest",
      payload,
      { headers: { "Content-Type": "application/json" } }
    );

    console.log("🚚 PF Response:", response.data);

    res.status(200).send("OK");
  } catch (err) {
    console.error("🔥 Palletforce Error:", err.response?.data || err);
    res.status(500).send("ERROR");
  }
});

/**
 * Start Server
 */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("🚀 Running on", PORT));
