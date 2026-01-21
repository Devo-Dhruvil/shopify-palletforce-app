require("dotenv").config();
const express = require("express");
const axios = require("axios");
const app = express();

// Receive raw body for Shopify (if needed later)
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Convert Shopify order → Palletforce payload
function convertToPalletforce(order) {
  return {
    accessKey: process.env.PF_ACCESS_KEY || "6O3tb+LpAM",

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
      name: order.shipping_address?.name || "",
      streetAddress:
        `${order.shipping_address?.address1 || ""} ${order.shipping_address?.address2 || ""}`.trim(),
      location: "",
      town: order.shipping_address?.city || "",
      county: order.shipping_address?.province || "",
      postcode: order.shipping_address?.zip || "",
      countryCode: order.shipping_address?.country_code || "GB",
      phoneNumber: order.shipping_address?.phone || "",
      contactName: order.shipping_address?.name || "",
    },

    consignments: [
      {
        requestingDepot: "121",
        collectingDepot: "",
        deliveryDepot: "",

        trackingNumber: "",
        consignmentNumber: String(order.order_number),

        // MOST IMPORTANT LINE (FIXED)
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

        // If Shopify weight not available → default 950
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

        // Notification must use lowercase "email"
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

// MAIN WEBHOOK ENDPOINT
app.post("/webhooks/order-paid", async (req, res) => {
  try {
    const order = req.body;

    console.log(`📦 Webhook received ${order.order_number}`);

    const payload = convertToPalletforce(order);

    console.log("📤 Sending:", JSON.stringify(payload, null, 2));

    const response = await axios.post(
      "https://apiuat.palletforce.net/api/ExternalScanning/UploadManifest",
      payload,
      { headers: { "Content-Type": "application/json" } }
    );

    console.log("🚚 PF Response:", response.data);

    res.status(200).send("OK");
  } catch (err) {
    console.error("🔥 ERROR:", err.response?.data || err.message);
    res.status(500).send("ERROR");
  }
});

// START SERVER
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🚀 Running on", PORT);
});
