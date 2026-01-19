// server.js
require("dotenv").config();

const express = require("express");
const crypto = require("crypto");
const axios = require("axios");

const app = express();

// Allow Shopify raw body
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  })
);

// Shopify signature (disabled for testing)
function verifyShopifyWebhook(req) {
  const hmac = req.headers["x-shopify-hmac-sha256"];
  const digest = crypto
    .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest("base64");
  return digest === hmac;
}

// Convert order → PF JSON
function convertOrderToPalletforce(order) {
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
      contactName: "Warehouse Team"
    },

    deliveryAddress: {
      name: order.shipping_address?.name || "",
      streetAddress: order.shipping_address?.address1 || "",
      location: order.shipping_address?.address2 || "",
      town: order.shipping_address?.city || "",
      county: order.shipping_address?.province || "",
      postcode: order.shipping_address?.zip || "",
      countryCode: order.shipping_address?.country_code || "GB",
      phoneNumber: order.shipping_address?.phone || "",
      contactName: order.shipping_address?.name || ""
    },

    consignments: [
      {
        requestingDepot: "121",          // REQUIRED
        collectingDepot: "121",          // REQUIRED
        deliveryDepot: "003",            // REQUIRED
        trackingNumber: "",
        consignmentNumber: String(order.order_number),
        CustomerAccountNumber: "indi001",

        // REQUIRED FIELDS (missing earlier)
        consignmentType: "NORMAL",
        hubIdentifyingCode: "NG",
        deliveryVehicleCode: "1",

        datesAndTimes: [
          {
            dateTimeType: "COLD",
            value: order.created_at.substring(0, 10).replace(/-/g, "")
          }
        ],

        pallets: [
          {
            palletType: "H",
            numberofPallets: "1"
          }
        ],

        palletSpaces: "1",
        weight: String(Math.ceil((order.total_weight || 10000) / 1000)),
        serviceName: "A",

        surcharges: "",
        customersUniqueReference: String(order.order_number),
        customersUniqueReference2: "",

        notes: [
          { noteName: "NOTE1", value: "" }
        ],

        insuranceCode: "05",

        notifications: [
          {
            notificationType: "EMAIL",
            value: order.email
          }
        ],

        additionalDetails: {
          lines: []
        },

       // acceptedStatus: "Y"   // REQUIRED
      }
    ]
  };
}

app.post("/webhooks/order-paid", async (req, res) => {
  try {
    console.log("📦 Webhook received");
    console.log("📝 Shopify Order:", req.body.order_number);

    const order = req.body;

    const payload = convertOrderToPalletforce(order);

    console.log("📤 Sending Payload:", JSON.stringify(payload, null, 2));

    const response = await axios.post(
      "https://apiuat.palletforce.net/api/ExternalScanning/UploadManifest",
      payload,
      { headers: { "Content-Type": "application/json" } }
    );

    console.log("🚚 PF Response:", response.data);

    res.status(200).send("OK");
  } catch (error) {
    console.error("🔥 ERROR:", error.response?.data || error.message);
    res.status(500).send("ERROR");
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("🚀 Server running on port", PORT));
