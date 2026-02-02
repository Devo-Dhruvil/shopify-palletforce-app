const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ✅ CORRECT PALLETFORCE UAT ENDPOINT
const PALLETFORCE_URL =
  "https://apiuat.palletforce.net/api/ExternalScanning/UploadManifest";

// ----------------------
// Shopify Order Paid Webhook
// ----------------------
app.post("/webhooks/order-paid", async (req, res) => {
  try {
    const order = req.body;
    const orderId = order.id || order.order_number;

    console.log("🔥 WEBHOOK RECEIVED: ORDER PAID");
    console.log("Order ID:", orderId);

    // ----------------------
    // Mandatory delivery phone (Palletforce requirement)
    // ----------------------
    const deliveryPhone =
      order.shipping_address?.phone ||
      order.phone ||
      "07123456789";

    // ----------------------
    // Build Palletforce Manifest (ONLY ALLOWED FIELDS)
    // ----------------------
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
          requestingDepot: "121",
          consignmentNumber: String(orderId),
          CustomerAccountNumber: "indi 001",

          datesAndTimes: [
            {
              dateTimeType: "COLD",
              value: new Date(order.created_at)
                .toISOString()
                .slice(0, 10)
                .replace(/-/g, "")
            }
          ],

          pallets: [
            {
              palletType: "H",
              numberofPallets: "1"
            }
          ],

          palletSpaces: "1",
          weight: String(
            Math.max(1, Math.ceil((order.total_weight || 5000) / 1000))
          ),

          serviceName: "A",
          customersUniqueReference: String(orderId),

          insuranceCode: "05",

          notifications: [
            {
              notificationType: "email",
              value: order.email || "devodhruvil@gmail.com"
            }
          ],

          additionalDetails: {
            lines: []
          }
        }
      ]
    };

    console.log("📤 Sending Manifest to Palletforce");
    console.log(JSON.stringify(manifest, null, 2));

    // ----------------------
    // Send to Palletforce
    // ----------------------
    const response = await axios.post(PALLETFORCE_URL, manifest, {
      headers: { "Content-Type": "application/json" },
      timeout: 15000
    });

    console.log("🚚 Palletforce Response:", response.data);

    res.status(200).send("OK");
  } catch (error) {
    console.error("❌ ERROR:",
      error.response?.data || error.message
    );
    res.status(500).send("ERROR");
  }
});

// ----------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
