// server.js
require("dotenv").config();

const express = require("express");
const crypto = require("crypto");
const axios = require("axios");

const app = express();

// Capture raw body for Shopify signature
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  })
);

// Convert Shopify Order → Palletforce JSON
function convertOrderToPalletforce(order) {
  // --- FIX: Split address correctly ---
  const shipping = order.shipping_address || {};
  const street = shipping.address1 || "";
  const town = shipping.city || "";
  const county = shipping.province || "";
  const postcode = shipping.zip || "";

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
      name: shipping.name || "",
      streetAddress: street,        // FIXED
      location: shipping.address2 || "",
      town: town,                   // FIXED
      county: county,
      postcode: postcode,
      countryCode: shipping.country_code || "GB",
      phoneNumber: shipping.phone || "",
      contactName: shipping.name || ""
    },

    consignments: [
      {
        requestingDepot: "121",
        collectingDepot: "121",
        deliveryDepot: "003",

        // FIXED: Palletforce requires a tracking number (not empty string)
        trackingNumber: `TRK-${order.order_number}`,

        consignmentNumber: String(order.order_number),
        CustomerAccountNumber: "indi001",

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

        // FIXED: Shopify weight is in grams → PF expects kg
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
        }
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

    // SEND TO PALLETFORCE
    const response = await axios.post(
      "https://apiuat.palletforce.net/api/ExternalScanning/UploadManifest",
      payload,
      { headers: { "Content-Type": "application/json" } }
    );

    console.log("🚚 PF Response:", response.data);
    res.status(200).send("OK");

  } catch (error) {
    console.error(
      "🔥 ERROR:",
      error.response?.data || error.message || error
    );
    res.status(500).send("ERROR");
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("🚀 Server running on port", PORT));
