import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// ===============================
// CONFIG
// ===============================
const PORT = process.env.PORT || 10000;

// ⚠️ USE THIS URL (UAT or LIVE – confirmed working)
const PALLETFORCE_URL =
  "https://apiuat.palletforce.net/api/ExternalScanning/UploadManifest";

// ===============================
// WEBHOOK ENDPOINT
// ===============================
app.post("/webhooks/order-paid", async (req, res) => {
  try {
    const order = req.body;

    console.log("🔥 WEBHOOK RECEIVED: ORDER PAID");
    console.log("Order ID:", order.id);

    const today = new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");

    // ===============================
    // BUILD PALLETFORCE MANIFEST
    // ===============================
    const manifest = {
      accessKey: process.env.PF_ACCESS_KEY || "6O3tb+LpAM",

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
        contactName: "Warehouse Team",
      },

      deliveryAddress: {
        name: order.shipping_address?.name || "Customer",
        streetAddress:
          order.shipping_address?.address1 || "Unknown Address",
        location: order.shipping_address?.address2 || "",
        town: order.shipping_address?.city || "",
        county: order.shipping_address?.province || "",
        postcode: order.shipping_address?.zip || "",
        countryCode: order.shipping_address?.country_code || "GB",

        // 🚨 MUST BE REAL – NOT 0000000000
        phoneNumber:
          order.shipping_address?.phone || "07123456789",

        contactName: order.shipping_address?.name || "Customer",
      },

      consignments: [
        {
          requestingDepot: "121",
          collectingDepot: "",
          deliveryDepot: "",
          trackingNumber: "",

          consignmentNumber: String(order.id),
          CustomerAccountNumber: "indi001",

          datesAndTimes: [
            {
              dateTimeType: "COLD",
              value: today,
            },
          ],

          pallets: [
            {
              palletType: "F",
              numberofPallets: "1",
            },
          ],

          palletSpaces: "1",

          // weight must be reasonable (kg)
          weight: "500",

          serviceName: "B",
          surcharges: "",

          customersUniqueReference: String(order.id),
          customersUniqueReference2: "",

          // 🚨 MUST EXIST (even if empty)
          notes: [
            {
              noteName: "NOTE1",
              value: "PLEASE CALL PRIOR TO DELIVERY",
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
              value: order.email || "devodhruvil@gmail.com",
            },
          ],

          cartonCount: "",
          aSNFBABOLReferenceNumber: "",

          additionalDetails: {
            lines: [],
          },

          // 🚨 MUST BE "N"
          acceptedStatus: "N",
        },
      ],
    };

    console.log("📤 Sending Manifest to Palletforce");
    console.log(JSON.stringify(manifest, null, 2));

    // ===============================
    // SEND TO PALLETFORCE
    // ===============================
    const response = await axios.post(
      PALLETFORCE_URL,
      manifest,
      { headers: { "Content-Type": "application/json" } }
    );

    console.log("🚚 Palletforce Response:", response.data);

    res.status(200).send("OK");
  } catch (error) {
    console.error("❌ ERROR:", error.response?.data || error.message);
    res.status(500).send("ERROR");
  }
});

// ===============================
app.listen(PORT, () => {
  console.log(`🚀 Running on port ${PORT}`);
});
