import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// ================= FIXED COLLECTION ADDRESS =================
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

// ================= SAFE DELIVERY ADDRESS BUILDER =================
function buildDeliveryAddress(order) {
  const sa = order.shipping_address || {};

  const town =
    sa.city && sa.city.trim().length > 2
      ? sa.city.trim()
      : "Normanton";

  // 🔥 FORCE correct postcode for Normanton
  let postcode = "WF6 1JU";
  if (town.toLowerCase() !== "normanton") {
    postcode =
      sa.zip && sa.zip.trim().length >= 5
        ? sa.zip.trim()
        : "WF6 1JU";
  }

  const phone =
    sa.phone && sa.phone.replace(/\D/g, "").length >= 10
      ? sa.phone
      : "01775347904";

  return {
    name: sa.name || "Customer",
    streetAddress:
      sa.address1 && sa.address1.trim().length > 3
        ? sa.address1
        : "Unit 1 Industrial Estate",
    location: sa.address2 || "Industrial Estate",
    town: town,
    county: "",
    postcode: postcode,
    countryCode: "GB",
    phoneNumber: phone,
    contactName: sa.name || "Customer"
  };
}


// ================= WEBHOOK =================
app.post("/webhooks/order-paid", async (req, res) => {
  try {
    const order = req.body;
    const orderNumber = order.order_number || Date.now();

    console.log("📦 Webhook received", orderNumber);

    // ================= PALLETFORCE MANIFEST (STRICT) =================
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
          weight: "950",
          serviceName: "A",

          customersUniqueReference: String(orderNumber),
          notes: [],
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
  } catch (error) {
    console.error("🔥 ERROR:", error);
    res.status(500).send("ERROR");
  }
});

// ================= START SERVER =================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
