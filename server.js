import express from "express";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 10000;

// IMPORTANT: body parser MUST be before routes
app.use(express.json());

// ✅ Health check
app.get("/", (req, res) => {
  res.send("Shopify → Palletforce webhook is running");
});

// ✅ THIS MUST MATCH SHOPIFY URL EXACTLY
app.post("/webhooks/order-paid", async (req, res) => {
  try {
    console.log("🔥 WEBHOOK RECEIVED: ORDER PAID");
    console.log("Order ID:", req.body.id);

    const order = req.body;

    // =========================
    // Build Palletforce Manifest
    // =========================
    const manifest = {
      accessKey: "6O3tb+LpAM",
      uniqueTransactionNumber: `SHOPIFY-${order.id}`,

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
        streetAddress: order.shipping_address?.address1 || "N/A",
        location: order.shipping_address?.address2 || "",
        town: order.shipping_address?.city || "N/A",
        county: order.shipping_address?.province || "",
        postcode: order.shipping_address?.zip || "N/A",
        countryCode: "GB",
        phoneNumber: order.shipping_address?.phone || "0000000000", // 🔴 REQUIRED
        contactName: order.shipping_address?.name || "Customer"
      },

      consignments: [
        {
          requestingDepot: "121",
          consignmentNumber: String(order.id),
          CustomerAccountNumber: "indi001",

          datesAndTimes: [
            {
              dateTimeType: "COLD",
              value: new Date().toISOString().slice(0, 10).replace(/-/g, "")
            }
          ],

          pallets: [
            {
              palletType: "H",
              numberofPallets: "1"
            }
          ],

          palletSpaces: "1",
          weight: "950",
          serviceName: "A",
          customersUniqueReference: String(order.id),
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

    // ✅ Palletforce endpoint (UPLOAD MANIFEST)
    const PF_URL =
      "https://apiuat.palletforce.net/api/ExternalScanning/UploadManifest";

    const pfResponse = await axios.post(PF_URL, manifest, {
      headers: { "Content-Type": "application/json" }
    });

    console.log("🚚 Palletforce Response:", pfResponse.data);

    res.status(200).send("OK");
  } catch (error) {
    console.error("❌ ERROR:", error.response?.data || error.message);
    res.status(500).send("Error");
  }
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
