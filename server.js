const express = require("express");
const crypto = require("crypto");
const axios = require("axios");
require("dotenv").config();

const app = express();

// Shopify raw body parser (required for signature verification)
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Convert Shopify → Palletforce JSON
function convertOrderToPF(order) {
  const shipping = order.shipping_address || {};

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
      name: shipping.name || "",
      streetAddress: shipping.address1 || "",
      location: shipping.address2 || "",
      town: shipping.city || "",
      county: shipping.province || "",
      postcode: shipping.zip || "",
      countryCode: shipping.country_code || "GB",
      phoneNumber: shipping.phone || "",
      contactName: shipping.name || "",
    },

    consignments: [
      {
        requestingDepot: "121",
        collectingDepot: "",
        deliveryDepot: "",

        trackingNumber: "",
        consignmentNumber: String(order.order_number),

        CustomerAccountNumber: "indi001", // FIXED - must match support example

        datesAndTimes: [
          {
            dateTimeType: "COLD",
            value: order.created_at.substring(0, 10).replace(/-/g, ""), // YYYYMMDD
          },
        ],

        pallets: [
          {
            palletType: "H",
            numberofPallets: "1",
          },
        ],

        palletSpaces: "1",

        // Minimum pallet weight must be 950 (Palletforce rule)
        weight: "950",

        // MUST BE ONLY ONE SERVICE
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
        deliveryVehicleCode: "",
        consignmentType: "",
        hubIdentifyingCode: "",

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

        // DO NOT SEND acceptedStatus → Palletforce blocks it
      },
    ],
  };
}

app.post("/webhooks/order-paid", async (req, res) => {
  try {
    console.log("📦 Webhook received", req.body.order_number);

    const order = req.body;
    const payload = convertOrderToPF(order);

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

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("🚀 Running on", PORT));
