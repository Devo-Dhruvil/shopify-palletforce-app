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

// VERIFY SHOPIFY WEBHOOK SIGNATURE (Enable later)
function verifyShopifyWebhook(req) {
  const hmac = req.headers["x-shopify-hmac-sha256"];
  const digest = crypto
    .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest("base64");

  return digest === hmac;
}

// Convert Shopify order → Palletforce Manifest JSON
function convertOrderToPalletforce(order) {
  return {
    accessKey: process.env.PF_ACCESS_KEY, // OK

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

        collectingDepot: "",
        deliveryDepot: "",
        trackingNumber: "",
        consignmentNumber: String(order.order_number),

        CustomerAccountNumber: process.env.PF_ACCOUNT || "000000",

        datesAndTimes: [
          {
            dateTimeType: "COLD",
            value: order.created_at.substring(0, 10).replace(/-/g, "") // YYYYMMDD
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
        serviceName: process.env.PF_SERVICE || "A",

        surcharges: "",
        customersUniqueReference: String(order.order_number),
        customersUniqueReference2: "",
        
        notes: [
          { noteName: "NOTE1", value: "" },
          { noteName: "NOTE2", value: "" },
          { noteName: "NOTE3", value: "" },
          { noteName: "NOTE4", value: "" }
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
        additionalDetails: { lines: [] },
        acceptedStatus: "N"
      }
    ]
  };
}

app.post("/webhooks/order-paid", async (req, res) => {
  try {
    console.log("📦 Webhook received");

    // Skip Shopify signature check during testing
    console.log("⚠️ Skipping signature check (testing mode)");

    const order = req.body;
    console.log("📝 Shopify Order:", order.order_number);

    // Convert to PF JSON
    const pfPayload = convertOrderToPalletforce(order);

    console.log("📤 Sending Palletforce Payload:\n", JSON.stringify(pfPayload, null, 2));

    const response = await axios.post(
      "https://apiuat.palletforce.net/api/ExternalScanning/UploadManifest",
      pfPayload,
      { headers: { "Content-Type": "application/json" } }
    );

    console.log("🚚 Palletforce Response:", response.data);

    res.status(200).send("OK");
  } catch (error) {
    console.error("🔥 ERROR:", error.response?.data || error.message);
    res.status(500).send("ERROR");
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("🚀 Server running on port", PORT));
