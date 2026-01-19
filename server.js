const express = require("express");
const crypto = require("crypto");
const axios = require("axios");
require("dotenv").config();

const app = express();

// Shopify raw body for signature verification
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Convert Shopify Order → Palletforce JSON
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
        requestingDepot: process.env.PF_DEPOT || "121",
        consignmentNumber: String(order.order_number),
        CustomerAccountNumber: process.env.PF_ACCOUNT || "indi001",

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

        serviceName: process.env.PF_SERVICE || "A",
        customersUniqueReference: String(order.order_number),

        notifications: [
          {
            notificationType: "EMAIL",
            value: order.email
          }
        ],

        additionalDetails: { lines: [] }
      }
    ]
  };
}

app.post("/webhooks/order-paid", async (req, res) => {
  try {
    console.log("📦 Webhook received");

    const order = req.body;
    console.log("📝 Shopify Order:", order.order_number);

    const pfPayload = convertOrderToPalletforce(order);

    console.log("📤 Sending Payload:", JSON.stringify(pfPayload, null, 2));

    const response = await axios.post(
      "https://apiuat.palletforce.net/api/ExternalScanning/UploadManifest",
      pfPayload,
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
