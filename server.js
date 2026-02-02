import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

// 🔑 Palletforce endpoint (LIVE)
const PALLETFORCE_URL =
  "https://api.palletforce.com/CustomerManifest/UploadManifest";

const ACCESS_KEY = "6O3tb+LpAM";

// Health check
app.get("/", (_, res) => {
  res.send("✅ Palletforce Manifest Service Running");
});

app.post("/webhook", async (req, res) => {
  try {
    const order = req.body;
    const orderId = order.id;

    console.log("📦 Webhook received", orderId);

    // ---- SAFE DELIVERY PHONE (MANDATORY) ----
    const deliveryPhone =
      order.shipping_address?.phone ||
      order.customer?.phone ||
      "01775347904"; // fallback REQUIRED

    // ---- BUILD MANIFEST (STRICTLY PER SPEC) ----
    const manifest = {
      accessKey: ACCESS_KEY,
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
        streetAddress:
          order.shipping_address?.address1 || "Unknown Street",
        location: order.shipping_address?.address2 || "",
        town: order.shipping_address?.city || "Unknown",
        county: order.shipping_address?.province || "",
        postcode: order.shipping_address?.zip || "UNKNOWN",
        countryCode: "GB",
        phoneNumber: deliveryPhone,
        contactName: order.shipping_address?.name || "Customer"
      },

      consignments: [
        {
          requestingDepot: "121",
          consignmentNumber: String(orderId),
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

          // ⚠️ MAX 4 DIGITS (KG)
          weight: "950",

          // ✅ EXACTLY ONE SERVICE
          serviceName: "A",

          customersUniqueReference: String(orderId),

          insuranceCode: "05",

          notifications: [
            {
              notificationType: "EMAIL",
              value: order.email || "devodhruvil@gmail.com"
            }
          ],

          additionalDetails: {
            lines: []
          }
        }
      ]
    };

    console.log("📤 Sending Manifest:\n", JSON.stringify(manifest, null, 2));

    const response = await axios.post(PALLETFORCE_URL, manifest, {
      headers: { "Content-Type": "application/json" }
    });

    console.log("🚚 Palletforce Response:", response.data);

    res.status(200).json({
      ok: true,
      palletforce: response.data
    });
  } catch (err) {
    console.error("❌ Palletforce Error:", err?.response?.data || err.message);
    res.status(500).json({
      error: err?.response?.data || err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Running on port ${PORT}`);
});
