const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

// ===============================
// SHOPIFY API
// ===============================
const shopify = axios.create({
  baseURL: `https://${process.env.SHOPIFY_SHOP}/admin/api/2024-01`,
  headers: {
    "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
    "Content-Type": "application/json"
  }
});

// ===============================
// CONFIG
// ===============================
const PALLETFORCE_URL =
  "https://apiuat.palletforce.net/api/ExternalScanning/UploadManifest";

const PALLETFORCE_CUSTOMER_ACCOUNT = "indi 001";

// ===============================
// GET VARIANT WEIGHT
// ===============================
async function getVariantWeight(variantId) {
  try {

    const res = await shopify.get(
      `/variants/${variantId}/metafields.json`
    );

    const metafield = res.data.metafields.find(
      m => m.namespace === "custom" && m.key === "product_weight"
    );

    if (!metafield) return 0;

    let value = metafield.value;

    if (value.startsWith("{")) {
      const parsed = JSON.parse(value);
      return Number(parsed.value) || 0;
    }

    return Number(value) || 0;

  } catch (err) {

    console.error("Metafield error:", err.message);

    return 0;
  }
}

// ===============================
// PALLET CALCULATION
// ===============================
function calculatePalletsAndWeight(totalWeight) {

  let pallets = [];
  let palletSpaces = 0;

  let remainingWeight = totalWeight;

  // FULL pallets
  const fullPallets = Math.floor(remainingWeight / 1250);

  if (fullPallets > 0) {

    pallets.push({
      palletType: "F",
      numberofPallets: String(fullPallets)
    });

    palletSpaces += fullPallets;

    remainingWeight -= fullPallets * 1250;
  }

  // Remaining weight
  if (remainingWeight > 0) {

    if (remainingWeight <= 250) {

      pallets.push({
        palletType: "Q",
        numberofPallets: "1"
      });

      palletSpaces += 0.25;

    } else if (remainingWeight <= 500) {

      pallets.push({
        palletType: "H",
        numberofPallets: "1"
      });

      palletSpaces += 0.5;

    } else {

      pallets.push({
        palletType: "F",
        numberofPallets: "1"
      });

      palletSpaces += 1;
    }
  }

  return {
    pallets,
    palletSpaces,
    weight: totalWeight
  };
}



// ===============================
// WEBHOOK
// ===============================
app.post("/webhooks/order-paid", async (req, res) => {

  try {

   const order = req.body;
    const orderId = order.id; // keep for Shopify API
    const orderNumber = order.order_number; // use for Palletforce
    const orderNumberStr = String(orderNumber);

    console.log("🔥 WEBHOOK RECEIVED: ORDER PAID");
    console.log("Order Number:", orderNumber);

    // ===============================
   // SERVICE NAME (B / D)
    // ===============================
    let serviceName = "B";

    const shippingPrice =
      Number(order.shipping_lines?.[0]?.price || 0);

    if (shippingPrice === 0) serviceName = "D";

    console.log("🚚 Shipping price:", shippingPrice);
    console.log("📦 Service:", serviceName);

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
      notifications.push({ notificationType: "EMAIL", value: order.email });
    } else if (deliveryPhone) {
      notifications.push({ notificationType: "SMS", value: deliveryPhone });
    } else {
      notifications.push({
        notificationType: "EMAIL",
        value: "devodhruvil@gmail.com",
      });
    }

    console.log("📨 Notifications:", notifications);

    // ===============================
    // TOTAL ORDER WEIGHT
    // ===============================
    let totalWeight = 0;

    for (const item of order.line_items || []) {

      const qty = Number(item.quantity || 1);

      let weightPerUnit =
        await getVariantWeight(item.variant_id);

      if (!weightPerUnit || isNaN(weightPerUnit)) {
        weightPerUnit = 0;
      }

      const lineWeight = weightPerUnit * qty;

      totalWeight += lineWeight;

      console.log(
        `⚖️ ${item.title}: ${weightPerUnit}kg × ${qty} = ${lineWeight}kg`
      );
    }

    totalWeight = Math.round(totalWeight);

    console.log("📦 Total Order Weight:", totalWeight);

    // ===============================
    // PALLET LOGIC
    // ===============================
    const { pallets, palletSpaces, weight } =
      calculatePalletsAndWeight(totalWeight);

    console.log("🧱 Pallets:", pallets);
    console.log("📦 Pallet spaces:", palletSpaces);
    console.log("⚖️ Weight:", weight);

    // ===============================
    // CONSIGNMENT NUMBER
    // ===============================
    const consignmentNumber = orderNumber;

    // ===============================
    // MANIFEST
    // ===============================
    const manifest = {

      accessKey: process.env.PF_ACCESS_KEY,

      uniqueTransactionNumber: `SHOPIFY-${orderNumber}`,

      collectionAddress: {
        name: "Indi Stone Ltd",
        streetAddress: "Blue House Farm Yard",
        location: "Deeping St Nicholas",
        town: "Peterborough",
        postcode: "PE11 3DH",
        countryCode: "GB",
        phoneNumber: "01775347904",
        contactName: "Warehouse Team"
      },

      deliveryAddress: {
         name: order.shipping_address?.name || "Customer",
        streetAddress: order.shipping_address?.address1 || "",
        location: order.shipping_address?.address2 || "",
        town: order.shipping_address?.city || "",
        county: order.shipping_address?.province || "",
        postcode: order.shipping_address?.zip || "",
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
                .replace(/-/g, "")
            }
          ],

          pallets,
          palletSpaces: String(palletSpaces),
          weight: String(weight),
          serviceName,
          
          customersUniqueReference: orderNumberStr,
          insuranceCode: "05",

          notes: [
            {
              noteName: "NOTE1",
              value: "PLEASE CALL PRIOR TO DELIVERY"
            }
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
        }
      ]
    };

    console.log("📤 Sending Manifest to Palletforce");
    console.log(JSON.stringify(manifest, null, 2));

    const response = await axios.post(PALLETFORCE_URL, manifest, {
      headers: { "Content-Type": "application/json" },
      timeout: 20000,
    });

    console.log("🚚 Palletforce Response:", response.data);


     // ===============================
    // 8️⃣ SAVE TRACKING TO SHOPIFY
    // ===============================
    // if (
    //   response.data?.success === true &&
    //   response.data.successfulTrackingCodes?.length
    // ) {
    //   await saveTrackingToShopify(
    //     orderId,
    //     response.data.successfulTrackingCodes[0]
    //   );
    // }

    // ===============================
// SAVE PALLETFORCE TRACKING META
// ===============================

  if (
  response.data?.success === true &&
  response.data.successfulTrackingCodes?.length > 0
) {
  const trackingNumber =
    response.data.successfulTrackingCodes[0];

  await saveTrackingMetafield(orderId, trackingNumber);
}


    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ ERROR:", err.response?.data || err.message);
    res.status(500).send("ERROR");
  }
   
});



async function saveTrackingMetafield(orderId, trackingNumber) {
  const existing = await shopify.get(
    `/orders/${orderId}/metafields.json`
  );

  const alreadyExists = existing.data.metafields.some(
    m => m.namespace === "custom" &&
         m.key === "palletforce_tracking"
  );

  if (alreadyExists) {
    console.log(`⏭ Metafield already exists for order ${orderId}`);
    return;
  }

  await shopify.post(`/metafields.json`, {
    metafield: {
      namespace: "custom",
      key: "palletforce_tracking",
      type: "single_line_text_field",
      value: trackingNumber,
      owner_id: orderId,
      owner_resource: "order"
    }
  });

  console.log(`💾 Metafield saved → ${trackingNumber}`);
}


// ===============================
app.listen(process.env.PORT || 10000, () =>
  console.log("🚀 Server running")
);
