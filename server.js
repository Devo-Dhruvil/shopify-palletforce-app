const express = require("express");
const crypto = require("crypto");
const axios = require("axios");

require("dotenv").config();

const app = express();

// Capture raw body for signature validation
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Verify Shopify Signature (disabled during testing)
function verifyShopifyWebhook(req) {
  const hmac = req.headers["x-shopify-hmac-sha256"];

  const digest = crypto
    .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest("base64");

  return digest === hmac;
}

// Convert Shopfiy → Palletforce JSON
function convertToPalletforce(order) {
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
        requestingDepot: "121",
        collectingDepot: "",
        deliveryDepot: "",
        trackingNumber: "",
        consignmentNumber: `${order.order_number}`,

        CustomerAccountNumber: "indi001",

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
        weight: String(Math.ceil((order.total_weight || 1000) / 1000)),

        serviceName: "A",

        surcharges: "",
        customersUniqueReference: `${order.order_number}`,
        customersUniqueReference2: "",

        notes: [
          { noteName: "NOTE1", value: "" }
        ],

        insuranceCode: "05",
        customerCharge: "",
        nonPalletforceConsignment: "",
        deliveryVehicleCode: "",
        consignmentType: "",
        hubIdentifyingCode: "",

        notifications: [
          { notificationType: "EMAIL", value: order.email }
        ],

        cartonCount: "",
        aSNFBABOLReferenceNumber: "",
        additionalDetails: { lines: [] },

        acceptedStatus: "N"
      }
    ]
  };
}

app.post("/webhooks/order-paid", async (req, res) => {
  try {
    console.log("📦 Webhook received");
    console.log("⚠️ Signature check skipped (testing)");

    const order = req.body;
    console.log("Order:", order.order_number);

    const payload = convertToPalletforce(order);

    console.log("📤 Sending to Palletforce:");
    console.log(JSON.stringify(payload, null, 2));

    const resp = await axios.post(
      "https://apiuat.palletforce.net/api/ExternalScanning/UploadManifest",
      payload,
      { headers: { "Content-Type": "application/json" } }
    );

    console.log("🚚 PF Response:", resp.data);

    res.status(200).send("OK");
  } catch (e) {
    console.error("🔥 ERROR:", e.response?.data || e.message);
    res.status(500).send("ERROR");
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("🚀 Server running on port", PORT));
