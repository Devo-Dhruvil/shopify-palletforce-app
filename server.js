const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();

// Parse JSON body from Shopify
app.use(express.json());

// Palletforce UAT UploadManifest endpoint
const PALLETFORCE_URL =
  "https://apiuat.palletforce.net/api/ExternalScanning/UploadManifest";

// Replace with the exact account number Palletforce gave you (no extra spaces)
const PALLETFORCE_CUSTOMER_ACCOUNT = "indi 001"; // example – confirm with Palletforce

// Shopify order paid webhook
app.post("/webhooks/order-paid", async (req, res) => {
  try {
    const order = req.body;
    const orderId = order.id || order.order_number;

    console.log("🔥 WEBHOOK RECEIVED: ORDER PAID");
    console.log("Order ID:", orderId);

    // Delivery phone – must not be blank, Palletforce requires phoneNumber
    const deliveryPhone =
      order.shipping_address?.phone ||
      order.phone ||
      "07123456789";

    // Use Shopify total_weight (grams) → kg, minimum 1kg
    const totalWeightGrams = order.total_weight || 5000; // fallback 5kg
    const weightKg = Math.max(1, Math.ceil(totalWeightGrams / 1000));

    const manifest = {
      accessKey: process.env.PF_ACCESS_KEY,
      uniqueTransactionNumber: `SHOPIFY-${orderId}`,

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
        name: order.shipping_address?.name || "Customer",
        streetAddress: order.shipping_address?.address1 || "Address",
        location: order.shipping_address?.address2 || "",
        town: order.shipping_address?.city || "Town",
        county: order.shipping_address?.province || "",
        postcode: order.shipping_address?.zip || "POSTCODE",
        countryCode: order.shipping_address?.country_code || "GB",
        phoneNumber: deliveryPhone,
        contactName: order.shipping_address?.name || "Customer"
      },

      consignments: [
        {
          requestingDepot: "121", // from Palletforce “Customer Details” page
          // leave collectingDepot, deliveryDepot, trackingNumber blank so Alliance allocates them
          collectingDepot: "",
          deliveryDepot: "",
          trackingNumber: "",

          consignmentNumber: String(orderId),
          CustomerAccountNumber: PALLETFORCE_CUSTOMER_ACCOUNT,

          datesAndTimes: [
            {
              dateTimeType: "COLD",
              value: new Date(order.created_at || new Date())
                .toISOString()
                .slice(0, 10)
                .replace(/-/g, "") // YYYYMMDD
            }
          ],

          pallets: [
            {
              palletType: "H", // Half pallet
              numberofPallets: "1"
            }
          ],

          palletSpaces: "1",

          // Weight in kilos, rounded up
          weight: String(weightKg),

          // Service A = 24hr (see spec)
          serviceName: "A",

          // Optional, but useful: Shopify order reference
          customersUniqueReference: String(orderId),
          customersUniqueReference2: "",

          // Insurance code – confirm with Palletforce if different for you
          insuranceCode: "05",

          // Notifications – type must be one of EMAIL / SMS / TWITTER (spec)
       
          // Optional extra fields, left blank
          surcharges: "",
          customerCharge: "",
          nonPalletforceConsignment: "",
          deliveryVehicleCode: "",
          consignmentType: "",
          hubIdentifyingCode: "",
          cartonCount: "",
          aSNFBABOLReferenceNumber: "",
          additionalDetails: {
            lines: []
          }
          // acceptedStatus left blank → treated as accepted according to spec
        }
      ]
    };

    console.log("📤 Sending Manifest to Palletforce");
    console.log(JSON.stringify(manifest, null, 2));

    const response = await axios.post(PALLETFORCE_URL, manifest, {
      headers: { "Content-Type": "application/json" },
      timeout: 15000
    });

    console.log("🚚 Palletforce Response:", response.data);
    res.status(200).send("OK");
  } catch (error) {
    console.error(
      "❌ ERROR:",
      error.response?.data || error.message
    );
    res.status(500).send("ERROR");
  }
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
