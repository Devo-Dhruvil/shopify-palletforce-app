import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// ================= COLLECTION ADDRESS =================
const COLLECTION_ADDRESS = {
  name: "Indistone Ltd",
  streetAddress: "Unit 2, Courtyard 31",
  location: "Normanton Industrial Estate",
  town: "Peterborough",
  county: "",
  postcode: "PE11 1EJ",
  countryCode: "GB",
  phoneNumber: "01775347904",
  contactName: "Warehouse Team"
};

// ================= DELIVERY ADDRESS =================
function buildDeliveryAddress(order) {
  return {
    name: order.shipping_address?.name || "Customer",
    streetAddress: order.shipping_address?.address1 || "Street",
    location: order.shipping_address?.address2 || "",
    town: order.shipping_address?.city || "",
    county: order.shipping_address?.province || "",
    postcode: order.shipping_address?.zip || "",
    countryCode: order.shipping_address?.country_code || "GB",
    phoneNumber: order.shipping_address?.phone || "0000000000",
    contactName: order.shipping_address?.name || "Customer"
  };
}

// ================= WEBHOOK =================
app.post("/webhooks/order-paid", async (req, res) => {
  try {
    const order = req.body;
    const orderNumber = order.order_number || Date.now();

    console.log("📦 Webhook received", orderNumber);

    // ================= MANIFEST PAYLOAD (STRICT) =================
    const payload = {
      accessKey: "6O3tb+LpAM",
      uniqueTransactionNumber: `SHOPIFY-${orderNumber}`,

      collectionAddress: COLLECTION_ADDRESS,
      deliveryAddress: buildDeliveryAddress(order),

      consignments: [
        {
          requestingDepot: "121",
          consignmentNumber: String(orderNumber),
          CustomerAccountNumber: "indi001",

          datesAndTimes: [
            {
              dateTimeType: "COLD",
              value: order.created_at
                .substring(0, 10)
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
          weight: String(Math.max(1, Math.ceil((order.total_weight || 950) / 1000))),
          serviceName: "A",

          customersUniqueReference: String(orderNumber),

          notes: [],
          insuranceCode: "05",

          notifications: [
            {
              notificationType: "email",
              value: order.email || "test@example.com"
            }
          ],

          additionalDetails: {
            lines: []
          }
        }
      ]
    };

    console.log("📤 Sending Manifest:\n", JSON.stringify(payload, null, 2));

    const response = await fetch(
      "https://apiuat.palletforce.net/api/ExternalScanning/UploadManifest",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();
    console.log("🚚 Palletforce Response:", data);

    res.status(200).send("OK");
  } catch (err) {
    console.error("🔥 Error:", err);
    res.status(500).send("ERROR");
  }
});

// ================= START SERVER =================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
