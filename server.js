
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
app.use(bodyParser.json());

app.post("/webhooks/order-paid", async (req, res) => {
  try {
    const order = req.body;

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
        contactName: "Warehouse"
      },
      deliveryAddress: {
        name: order.shipping_address.name,
        streetAddress: order.shipping_address.address1,
        town: order.shipping_address.city,
        postcode: order.shipping_address.zip,
        countryCode: order.shipping_address.country_code,
        phoneNumber: order.shipping_address.phone || "000000000",
        contactName: order.shipping_address.name
      },
      consignments: [
        {
          requestingDepot: "075",
          consignmentNumber: order.order_number.toString(),
          CustomerAccountNumber: "YOUR_PF_ACCOUNT",
          datesAndTimes: [
            {
              dateTimeType: "COLD",
              value: order.created_at.substring(0, 10).replace(/-/g, "")
            }
          ],
          pallets: [{ palletType: "H", numberofPallets: "1" }],
          palletSpaces: "1",
          weight: Math.ceil(order.total_weight / 1000).toString(),
          serviceName: "A",
          customersUniqueReference: order.order_number.toString(),
          insuranceCode: "05",
          acceptedStatus: "Y"
        }
      ]
    };

    await axios.post(
      "https://apiuat.palletforce.net/api/ExternalScanning/UploadManifest",
      payload,
      { headers: { "Content-Type": "application/json" } }
    );

    res.status(200).send("OK");
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
