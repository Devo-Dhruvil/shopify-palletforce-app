const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();

// Parse JSON body from Shopify
app.use(express.json());

// Palletforce UAT UploadManifest endpoint
const PALLETFORCE_URL =
  "https://apiuat.palletforce.net/api/ExternalScanning/UploadManifest";

// Exact customer account number from Palletforce (with space)
const PALLETFORCE_CUSTOMER_ACCOUNT = "indi 001";

// Shopify order paid webhook
app.post("/webhooks/order-paid", async (req, res) => {
  try {
    const order = req.body;
    const orderId = order.id || order.order_number;
    const orderIdStr = String(orderId);

    console.log("🔥 WEBHOOK RECEIVED: ORDER PAID");
    console.log("Order ID:", orderIdStr);

    // Consignment number must be max 7 chars (per spec)
    const consignmentNumber = orderIdStr.slice(-7);

    // Delivery phone – must not be blank, Palletforce requires phoneNumber
    const deliveryPhone =
      order.shipping_address?.phone ||
      order.phone ||
      "07123456789";

    // Use Shopify total_weight (grams) → kg, minimum 1kg
    const totalWeightGrams = order.total_weight || 5000; // fallback 5kg
    const weightKg = Math.max(1, Math.ceil(totalWeightGrams / 1000));

    // Build a simple NOTE1 line (you can change the text as you like)
    const noteValue = `Shopify order ${orderIdStr}`;

    const manifest = {
      accessKey: process.env.PF_ACCESS_KEY,
      uniqueTransactionNumber: `SHOPIFY-${orderIdStr}`,

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
          requestingDepot: "121",

          collectingDepot: "",
          deliveryDepot: "",
          trackingNumber: "",

          consignmentNumber: consignmentNumber,
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
              palletType: "H",
              numberofPallets: "1"
            }
          ],

          palletSpaces: "1",
          weight: String(weightKg),
          serviceName: "A",

          customersUniqueReference: orderIdStr,
          customersUniqueReference2: "",

          insuranceCode: "05",

          // ✅ Notes – use valid noteName values (NOTE1–NOTE4)
          notes: [
            {
              noteName: "NOTE1",
              value: noteValue
            }
          ],

          // ✅ Notifications – type must be EMAIL / SMS / TWITTER (upper‑case)
          notifications: [
            {
              notificationType: "email",
              value: order.email || deliveryPhone || "devodhruvil@gmail.com"
            }
          ],

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
