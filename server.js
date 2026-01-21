require("dotenv").config();
const express = require("express");
const crypto = require("crypto");
const axios = require("axios");

const app = express();

// Capture raw body (Shopify requirement)
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  })
);

// Convert Shopify → Palletforce JSON
function convertOrderToPalletforce(order) {
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
      contactName: "Warehouse Team"
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
      contactName: shipping.name || ""
    },

    consignments: [
      {
        requestingDepot: "121",
        collectingDepot: "",
        deliveryDepot: "",
        trackingNumber: "",

        consignmentNumber: String(order.order_number),

        // IMPORTANT: PF confirmed space in account number
        CustomerAccountNumber: "indi 001",

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
          {
            noteName: "",
            value: ""
          }
        ],

        insuranceCode: "05",
        customerCharge: "",
        nonPalletforceConsignment: "",
        deliveryVehicleCode: "",
        consignmentType: "",
        hubIdentifyingCode: "",

        notifications: [
          {
            notificationType: "EMAIL",
            value: order.email
          }
        ],

        cartonCount: "",
        aSNFBABOLReferenceNumber: "",

        additionalDetails: {
          lines: [
            {
              fields: [
                {
                  fieldName: "",
                  value: ""
                }
              ]
            }
          ]
        },

        acceptedStatus: "N"
      }
    ]
  };
}

app.post("/webhooks/order-paid", async (req, res) => {
  try {
    console.log("📦 Webhook received", req.body.order_number);

    const order = req.body;
    const payload = convertOrderToPalletforce(order);

    console.log("📤 Sending:", JSON.stringify(payload, null, 2));

    const response = await axios.post(
      "https://apiuat.palletforce.net/api/ExternalScanning/UploadManifest",
      payload,
      { headers: { "Content-Type": "application/json" } }
    );

    console.log("🚚 PF Response:", response.data);

    res.status(200).send("OK");
  } catch (error) {
    console.log("🔥 FULL PF ERROR RAW ↓↓↓");

    // Print entire error object
    console.log(
      "🔥 ERROR OBJECT ↓↓↓",
      JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
    );

    // Print PF response
    if (error.response) {
      console.log(
        "🔥 ERROR RESPONSE ↓↓↓",
        JSON.stringify(error.response, Object.getOwnPropertyNames(error.response), 2)
      );
    }

    if (error.response?.data) {
      console.log(
        "🔥 ERROR RESPONSE DATA ↓↓↓",
        JSON.stringify(error.response.data, Object.getOwnPropertyNames(error.response.data), 2)
      );
    }

    // Print failed consignments fully
    if (error.response?.data?.failedConsignments) {
      console.log(
        "🔥 FAILED CONSIGNMENTS FULL ↓↓↓",
        JSON.stringify(error.response.data.failedConsignments, null, 2)
      );
    }

    // 🔥 MOST IMPORTANT — PRINT failureReasons as String (Render cannot collapse this)
    if (
      error.response?.data?.failedConsignments &&
      error.response.data.failedConsignments.length > 0
    ) {
      console.log(
        "🔥 FAILURE REASONS STRING ↓↓↓",
        String(error.response.data.failedConsignments[0].failureReasons)
      );
    }

    return res.status(500).send("ERROR");
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("🚀 Running on", PORT));
