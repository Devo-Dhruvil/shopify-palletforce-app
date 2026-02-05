const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

// Palletforce UAT UploadManifest endpoint
const PALLETFORCE_URL =
  "https://apiuat.palletforce.net/api/ExternalScanning/UploadManifest";

// Exact customer account number from Palletforce
const PALLETFORCE_CUSTOMER_ACCOUNT = "indi 001";

/**
 * 🧮 Calculate pallets + weight from total coverage
 */
function calculatePalletsFromCoverage(totalCoverage) {
  const FULL_PALLET_COVERAGE = 10;
  const FULL_PALLET_WEIGHT = 1250;
  const HALF_PALLET_WEIGHT = 500;

  const fullPallets = Math.floor(totalCoverage / FULL_PALLET_COVERAGE);
  const remainder = totalCoverage % FULL_PALLET_COVERAGE;
  const halfPallets = remainder > 0 ? 1 : 0;

  const pallets = [];
  if (fullPallets > 0) {
    pallets.push({
      palletType: "F",
      numberofPallets: String(fullPallets),
    });
  }

  if (halfPallets > 0) {
    pallets.push({
      palletType: "H",
      numberofPallets: "1",
    });
  }

  const palletSpaces = fullPallets + halfPallets;
  const totalWeight =
    fullPallets * FULL_PALLET_WEIGHT +
    halfPallets * HALF_PALLET_WEIGHT;

  return {
    pallets,
    palletSpaces: String(palletSpaces),
    weight: String(totalWeight),
  };
}

// Shopify order paid webhook
app.post("/webhooks/order-paid", async (req, res) => {
  try {
    const order = req.body;

    console.log("🔥 WEBHOOK RECEIVED: ORDER PAID");
    console.log("Order ID:", order.id);

    /**
     * 🚚 Service Name logic
     */
    let serviceName = "B"; // Paid by default
    const shippingLine = order.shipping_lines?.[0];
    const shippingPrice = Number(shippingLine?.price || 0);

    if (shippingPrice === 0) {
      serviceName = "D"; // FREE shipping
    }

    console.log("🚚 Shipping price:", shippingPrice);
    console.log("📦 Palletforce serviceName:", serviceName);

    /**
     * 📐 TOTAL COVERAGE CALCULATION
     * Reads "Coverage: 15.5m²" from product title / variant title
     */
    let totalCoverage = 0;

    for (const item of order.line_items || []) {
      const text =
        item.variant_title ||
        item.title ||
        "";

      const match = text.match(/([\d.]+)\s?m²/i);
      if (match) {
        totalCoverage += Number(match[1]) * item.quantity;
      }
    }

    if (totalCoverage === 0) {
      // Fallback safety
      totalCoverage = 10;
    }

    console.log("📐 Total coverage:", totalCoverage, "m²");

    const palletData = calculatePalletsFromCoverage(totalCoverage);

    /**
     * 🧾 Order basics
     */
    const orderIdStr = String(order.id);
    const consignmentNumber = orderIdStr.slice(-7);

    const deliveryPhone =
      order.shipping_address?.phone ||
      order.phone ||
      "07123456789";

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
        contactName: "Warehouse Team",
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
        contactName: order.shipping_address?.name || "Customer",
      },

      consignments: [
        {
          requestingDepot: "121",
          collectingDepot: "",
          deliveryDepot: "",
          trackingNumber: "",
          consignmentNumber,
          CustomerAccountNumber: PALLETFORCE_CUSTOMER_ACCOUNT,

          datesAndTimes: [
            {
              dateTimeType: "COLD",
              value: new Date(order.created_at)
                .toISOString()
                .slice(0, 10)
                .replace(/-/g, ""),
            },
          ],

          pallets: palletData.pallets,
          palletSpaces: palletData.palletSpaces,
          weight: palletData.weight,

          serviceName,

          customersUniqueReference: orderIdStr,
          customersUniqueReference2: "",
          insuranceCode: "05",

          notes: [
            {
              noteName: "NOTE1",
              value: noteValue,
            },
          ],

          notifications: [
            {
              notificationType: "email",
              value: order.email || deliveryPhone,
            },
          ],

          additionalDetails: { lines: [] },
        },
      ],
    };

    console.log("📤 Sending Manifest to Palletforce");
    console.log(JSON.stringify(manifest, null, 2));

    const response = await axios.post(PALLETFORCE_URL, manifest, {
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
    });

    console.log("🚚 Palletforce Response:", response.data);

    if (
      response.data?.success &&
      response.data.successfulTrackingCodes?.length
    ) {
      await saveTrackingToShopify(
        order.id,
        response.data.successfulTrackingCodes[0]
      );
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("❌ ERROR:", error.response?.data || error.message);
    res.status(500).send("ERROR");
  }
});

// Shopify fulfillment save
async function saveTrackingToShopify(orderId, trackingNumber) {
  const baseUrl = `https://${process.env.SHOPIFY_SHOP}/admin/api/2024-01`;

  const foRes = await axios.get(
    `${baseUrl}/orders/${orderId}/fulfillment_orders.json`,
    {
      headers: {
        "X-Shopify-Access-Token":
          process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
      },
    }
  );

  const fulfillmentOrder = foRes.data.fulfillment_orders?.find(
    (fo) => fo.status === "open"
  );

  if (!fulfillmentOrder) {
    console.log("⚠️ No open fulfillment order");
    return;
  }

  await axios.post(
    `${baseUrl}/fulfillments.json`,
    {
      fulfillment: {
        line_items_by_fulfillment_order: [
          { fulfillment_order_id: fulfillmentOrder.id },
        ],
        tracking_info: {
          number: trackingNumber,
          company: "Palletforce",
          url: `https://www.palletforce.com/track/?tracking=${trackingNumber}`,
        },
        notify_customer: true,
      },
    },
    {
      headers: {
        "X-Shopify-Access-Token":
          process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
    }
  );

  console.log("✅ Tracking saved to Shopify:", trackingNumber);
}

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log("🚀 Server running on port", PORT)
);
