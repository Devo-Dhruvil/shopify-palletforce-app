const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

// ===============================
// CONFIG
// ===============================
const PALLETFORCE_URL =
  "https://apiuat.palletforce.net/api/ExternalScanning/UploadManifest";

const PALLETFORCE_CUSTOMER_ACCOUNT = "indi 001";

// ===============================
// 3️⃣ PALLET CALCULATION (FINAL)
// ===============================
const PALLET_SIZE = 20;
const FULL_WEIGHT = 1250;
const HALF_WEIGHT = 500;

let fullPallets = 0;
let halfPallets = 0;

const ratio = totalCoverage / PALLET_SIZE;
const integerPart = Math.floor(ratio);
const decimalPart = ratio - integerPart;

if (ratio <= 0.5) {
  // ≤ 10m²
  halfPallets = 1;
} else if (ratio < 1) {
  // >10 and <20 → FULL
  fullPallets = 1;
} else {
  fullPallets = integerPart;

  if (decimalPart >= 0.6) {
    // round UP to full pallet
    fullPallets += 1;
  } else if (decimalPart > 0) {
    // small remainder → half pallet
    halfPallets = 1;
  }
}

const palletSpaces = fullPallets + halfPallets;

const weightKg =
  fullPallets * FULL_WEIGHT +
  halfPallets * HALF_WEIGHT;

// ===============================
// 4️⃣ PALLET ARRAY
// ===============================
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
    numberofPallets: String(halfPallets),
  });
}

console.log("🧱 Pallets:", pallets);
console.log("📦 Pallet spaces:", palletSpaces);
console.log("⚖️ Total weight:", weightKg);


// ===============================
// WEBHOOK: ORDER PAID
// ===============================
app.post("/webhooks/order-paid", async (req, res) => {
  try {
    const order = req.body;
    const orderId = order.id;
    const orderIdStr = String(orderId);

    console.log("🔥 WEBHOOK RECEIVED: ORDER PAID");
    console.log("Order ID:", orderIdStr);

    // ===============================
    // SERVICE NAME (B / D)
    // ===============================
    let serviceName = "B";
    const shippingPrice = Number(order.shipping_lines?.[0]?.price || 0);
    if (shippingPrice === 0) serviceName = "D";

    console.log("🚚 Shipping price:", shippingPrice);
    console.log("📦 Palletforce serviceName:", serviceName);

    // ===============================
    // DELIVERY PHONE
    // ===============================
    const deliveryPhone =
      order.shipping_address?.phone ||
      order.phone ||
      "07123456789";

    // ===============================
    // NOTIFICATIONS
    // ===============================
    let notifications = [];
    if (order.email) {
      notifications.push({ notificationType: "email", value: order.email });
    } else if (deliveryPhone) {
      notifications.push({ notificationType: "SMS", value: deliveryPhone });
    } else {
      notifications.push({
        notificationType: "email",
        value: "devodhruvil@gmail.com",
      });
    }

    console.log("📨 Notifications:", notifications);

 // ===============================
// 2️⃣ TOTAL COVERAGE (FIXED)
// ===============================
let totalCoverage = 0;

for (const item of order.line_items || []) {
  const qty = Number(item.quantity || 1);
  let coveragePerUnit = 0;

  // 1️⃣ Check line item properties
  const coverageProp = item.properties?.find(p =>
    p.name?.toLowerCase().includes("coverage")
  );

  if (coverageProp && coverageProp.value) {
    coveragePerUnit = parseFloat(coverageProp.value);
  }

  // 2️⃣ Fallback: variant title (e.g. "10.08m²", "19.5m2")
  if (!coveragePerUnit && item.variant_title) {
    const match = item.variant_title.match(/([\d.]+)\s?m²|m2/i);
    if (match) {
      coveragePerUnit = parseFloat(match[1]);
    }
  }

  // 3️⃣ Final safety fallback
  if (!coveragePerUnit) {
    console.warn(
      `⚠️ No coverage found for item "${item.title}", qty ${qty}`
    );
    continue;
  }

  const lineCoverage = coveragePerUnit * qty;
  totalCoverage += lineCoverage;

  console.log(
    `🧮 ${item.title}: ${coveragePerUnit}m² × ${qty} = ${lineCoverage}m²`
  );
}

// Round to 2 decimals (important)
totalCoverage = Math.round(totalCoverage * 100) / 100;

console.log(`📐 Total coverage: ${totalCoverage} m²`);


    // ===============================
    // PALLETS & WEIGHT
    // ===============================
    const { pallets, palletSpaces, weight } =
      calculatePalletsAndWeight(totalCoverage);

    console.log("🧱 Pallets:", pallets);
    console.log("📦 Pallet spaces:", palletSpaces);
    console.log("⚖️ Total weight:", weight);

    // ===============================
    // MANIFEST
    // ===============================
    const consignmentNumber = orderIdStr.slice(-7);

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

          consignmentNumber: consignmentNumber,
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

          pallets,
          palletSpaces: String(palletSpaces),
          weight: String(weight),
          serviceName,

          customersUniqueReference: orderIdStr,
          insuranceCode: "05",

          notes: [
            {
              noteName: "NOTE1",
              value: `Shopify order ${orderIdStr} | ${totalCoverage}m²`,
            },
          ],

          notifications,
          surcharges: "",
          customerCharge: "",
          nonPalletforceConsignment: "",
          deliveryVehicleCode: "",
          consignmentType: "",
          hubIdentifyingCode: "",
          cartonCount: "",
          aSNFBABOLReferenceNumber: "",
          additionalDetails: { lines: [] },
        },
      ],
    };

    console.log("📤 Sending Manifest to Palletforce");
    console.log(JSON.stringify(manifest, null, 2));

    const response = await axios.post(PALLETFORCE_URL, manifest, {
      headers: { "Content-Type": "application/json" },
      timeout: 20000,
    });

    console.log("🚚 Palletforce Response:", response.data);

    // ===============================
    // SAVE TRACKING TO SHOPIFY
    // ===============================
    if (
      response.data?.success === true &&
      response.data.successfulTrackingCodes?.length
    ) {
      await saveTrackingToShopify(
        orderId,
        response.data.successfulTrackingCodes[0]
      );
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ ERROR:", err.response?.data || err.message);
    res.status(500).send("ERROR");
  }
});

// ===============================
// SAVE TRACKING TO SHOPIFY
// ===============================
async function saveTrackingToShopify(orderId, trackingNumber) {
  const baseUrl = `https://${process.env.SHOPIFY_SHOP}/admin/api/2024-01`;

  const foRes = await axios.get(
    `${baseUrl}/orders/${orderId}/fulfillment_orders.json`,
    {
      headers: {
        "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
      },
    }
  );

  const fulfillmentOrder = foRes.data.fulfillment_orders?.find(
    fo => fo.status === "open"
  );

  if (!fulfillmentOrder) {
    console.log("⚠️ No open fulfillment order — skipping Shopify update");
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
        "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
    }
  );

  console.log("✅ Tracking saved to Shopify:", trackingNumber);
}

// ===============================
app.listen(process.env.PORT || 10000, () =>
  console.log("🚀 Server running")
);
