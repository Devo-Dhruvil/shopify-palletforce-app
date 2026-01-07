const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();

// Shopify sends JSON
app.use(bodyParser.json());

// Health check (optional)
app.get("/", (req, res) => {
  res.send("Shopify → Palletforce service running");
});

// Shopify ORDER PAID webhook
app.post("/webhooks/order-paid", async (req, res) => {
  try {
    console.log("📦 Shopify order webhook received");

    const order = req.body;

    if (!order || !order.order_number) {
      console.error("❌ Invalid order payload");
      return res.status(400).send("Invalid order");
    }

    console.log("🧾 Order Number:", order.order_number);

    const shipping = order.shipping_address || {};

    // Build Palletforce payload
    const payload = {
      uniqueTransactionNumber: `SHOPIFY-${order.order_number}`,
      collectionAddress: {
        name: "YOUR COMPANY NAME",
        streetAddress: "WAREHOUSE ADDRESS",
        town: "CITY",
        postcode: "POSTCODE",
        countryCode: "GB",
        phoneNumber: "0000000000",
        contactName: "Warehouse"
      },
      deliveryAddress: {
        name: shipping.name || "Customer",
        streetAddress: shipping.address1 || "",
        town: shipping.city || "",
        postcode: shipping.zip || "",
        countryCode: shipping.country_code || "GB",
        phoneNumber: shipping.phone || "0000000000",
        contactName: shipping.name || "Customer"
      },
      consignments: [
        {
          requestingDepot: "075",
          consignmentNumber: order.order_number.toString(),
          CustomerAccountNumber: "YOUR_PF_ACCOUNT",
          datesAndTimes: [
            {
              dateTimeType: "COLD",
              value: order.created_at
                ? order.created_at.substring(0, 10).replace(/-/g, "")
                : ""
            }
          ],
          pallets: [
            {
              palletType: "H",
              numberofPallets: "1"
            }
          ],
          palletSpaces: "1",
          weight: Math.max(
            1,
            Math.ceil((order.total_weight || 1000) / 1000)
          ).toString(),
          serviceName: "A",
          customersUniqueReference: order.order_number.toString(),
          insuranceCode: "05",
          acceptedStatus: "Y"
        }
      ]
    };

    console.log("➡️ Sending manifest to Palletforce...");

    const response = await axios.post(
      process.env.PF_UPLOAD_URL,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "AccessKey": process.env.PF_ACCESS_KEY
        },
        timeout: 15000
      }
    );

    console.log("✅ Palletforce response status:", response.status);
    console.log("📨 Palletforce response data:", response.data);

    res.status(200).send("OK");
  } catch (error) {
    console.error("❌ Palletforce API error");

    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    } else {
      console.error(error.message);
    }

    res.status(500).send("Error");
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
