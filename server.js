require("dotenv").config();
const express = require("express");
const crypto = require("crypto");
const axios = require("axios");

const app = express();

// Shopify raw body for verifying webhook
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Convert Shopify order → Palletforce JSON
function convertOrderToPF(order) {
  // Extract shipping address safely
  const s = order.shipping_address || {};

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
      name: s.name || "",
      streetAddress: s.address1 || "Unit 2 Courtyard 31",
      location: s.address2 || "Industrial Estate",
      town: s.city || "Normanton",
      county: "",
      postcode: s.zip || "",
      countryCode: "GB",
      phoneNumber: s.phone || "01775347904",
      contactName: s.name || "",
    },

    consignments: [
      {
        requestingDepot: "121",
        collectingDepot: "",
        deliveryDepot: "074",       // WF6 1JU → Depot 074
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
        weight: String(Math.ceil((order.total_weight || 950000) / 1000)),

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

        customerCharge: "",
        nonPalletforceConsignment: "",
        deliveryVehicleCode: "1",
        consignmentType: "",
        hubIdentifyingCode: "WF",    // WF postcode → WF hub

        notifications: [
          {
            notificationType: "email",
            value: order.email || "devodhruvil@gmail.com",
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

// Webhook endpoint
app.post("/webhooks/order-paid", async (req, res) => {
  try {
    const order = req.body;

    console.log("📦 Webhook received", order.order_number);

    const pfPayload = convertOrderToPF(order);

    console.log("📤 Sending:", JSON.stringify(pfPayload, null, 2));

    const response = await axios.post(
      "https://apiuat.palletforce.net/api/ExternalScanning/UploadManifest",
      pfPayload,
      { headers: { "Content-Type": "application/json" } }
    );

    console.log("🚚 PF Response:", response.data);

    res.status(200).send("OK");
  } catch (err) {
    console.error("🔥 Palletforce ERROR:", err.response?.data || err.message);
    res.status(500).send("ERROR");
  }
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("🚀 Running on", PORT));
