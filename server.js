const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();

/**
 * REQUIRED: Raw body for Shopify webhook verification
 */
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

/**
 * Verify Shopify Webhook
 */
function verifyShopifyWebhook(req) {
  const hmac = req.headers["x-shopify-hmac-sha256"];
  const digest = crypto
    .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest("base64");

  return digest === hmac;
}

app.post("/webhooks/order-paid", async (req, res) => {
  try {
    console.log("📦 Webhook received");

    // if (!verifyShopifyWebhook(req)) {
    //   console.log("❌ Invalid webhook signature");
    //   return res.status(401).send("Invalid signature");
    // }

    // TEMP: Disable signature check for testing
console.log("⚠️ Signature check skipped (testing mode)");


    const order = req.body;
    console.log("✅ Order:", order.order_number);

    const payload = {
      accessKey: process.env.PF_ACCESS_KEY,
      uniqueTransactionNumber: `SHOPIFY-${order.order_number}`,

      collectionAddress: {
        name: "YOUR COMPANY NAME",
        streetAddress: "WAREHOUSE ADDRESS",
        town: "CITY",
        postcode: "POSTCODE",
        countryCode: "GB",
        phoneNumber: "0000000000",
        contactName: "Warehouse",
      },

      deliveryAddress: {
        name: order.shipping_address.name,
        streetAddress: order.shipping_address.address1,
        town: order.shipping_address.city,
        postcode: order.shipping_address.zip,
        countryCode: order.shipping_address.country_code,
        phoneNumber: order.shipping_address.phone || "000000000",
        contactName: order.shipping_address.name,
      },

      consignments: [
        {
          requestingDepot: "075",
          consignmentNumber: order.order_number.toString(),
          CustomerAccountNumber: "YOUR_PF_ACCOUNT",
          datesAndTimes: [
            {
              dateTimeType: "COLD",
              value: order.created_at.substring(0, 10).replace(/-/g, ""),
            },
          ],
          pallets: [{ palletType: "H", numberofPallets: "1" }],
          palletSpaces: "1",
          weight: Math.ceil(order.total_weight / 1000).toString(),
          serviceName: "A",
          customersUniqueReference: order.order_number.toString(),
          insuranceCode: "05",
          acceptedStatus: "Y",
        },
      ],
    };

    const pfResponse = await axios.post(
      "https://apiuat.palletforce.net/api/ExternalScanning/UploadManifest",
      payload,
      { headers: { "Content-Type": "application/json" } }
    );

    console.log("🚚 Palletforce response:", pfResponse.data);

    res.status(200).send("OK");
  } catch (error) {
    console.error("🔥 Error:", error.response?.data || error.message);
    res.status(500).send("Error");
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running on port", PORT));
