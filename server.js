const express = require("express");
const crypto = require("crypto");
const axios = require("axios");

const app = express();

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Convert Shopify order → Palletforce JSON
function convertOrder(order) {
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
      name: order.shipping_address?.name || "",
      streetAddress:
        `${order.shipping_address?.address1 || ""} ${order.shipping_address?.address2 || ""}`.trim(),
      location: "",
      town: order.shipping_address?.city || "",
      county: order.shipping_address?.province || "",
      postcode: order.shipping_address?.zip || "",
      countryCode: "GB",
      phoneNumber: order.shipping_address?.phone || "00000000000", // REQUIRED
      contactName: order.shipping_address?.name || "",
    },

    consignments: [
      {
        requestingDepot: "121",
        collectingDepot: "",
        deliveryDepot: "074", // WF6 → Depot 074
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
        weight: String(Math.ceil((order.total_weight || 10000) / 1000)), // safe fallback
        serviceName: "A", // ONLY ONE SERVICE ALLOWED

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
        deliveryVehicleCode: "1", // REQUIRED
        consignmentType: "",
        hubIdentifyingCode: "WF", // WF = West Yorkshire hub

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

app.post("/webhooks/order-paid", async (req, res) => {
  try {
    const order = req.body;
    console.log("📦 Webhook received", order.order_number);

    const payload = convertOrder(order);

    console.log("📤 Sending:", JSON.stringify(payload, null, 2));

    const pfRes = await axios.post(
      "https://apiuat.palletforce.net/api/ExternalScanning/UploadManifest",
      payload,
      { headers: { "Content-Type": "application/json" } }
    );

    console.log("🚚 PF Response:", pfRes.data);

    res.status(200).send("OK");
  } catch (error) {
    console.log("🔥 ERROR:", error.response?.data || error.message);
    res.status(500).send("ERROR");
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Running on ${PORT}`));
