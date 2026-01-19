function convertOrderToPalletforce(order) {
  const payload = {
    accessKey: process.env.PF_ACCESS_KEY,

    uniqueTransactionNumber: `SHOPIFY-${order.order_number}`,

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
      name: order.shipping_address?.name || "",
      streetAddress: order.shipping_address?.address1 || "",
      location: order.shipping_address?.address2 || "",
      town: order.shipping_address?.city || "",
      county: order.shipping_address?.province || "",
      postcode: order.shipping_address?.zip || "",
      countryCode: order.shipping_address?.country_code || "GB",
      phoneNumber: order.shipping_address?.phone || "",
      contactName: order.shipping_address?.name || ""
    },

    consignments: [
      {
        requestingDepot: process.env.PF_DEPOT || "121",
        collectingDepot: "",
        deliveryDepot: "",
        trackingNumber: "",
        consignmentNumber: String(order.order_number),

        CustomerAccountNumber: process.env.PF_ACCOUNT || "indi001",

        datesAndTimes: [
          {
            dateTimeType: "COLD",
            value: order.created_at.substring(0, 10).replace(/-/g, "")
          }
        ],

        pallets: [
          {
            palletType: "H",
            numberofPallets: "1"
          }
        ],

        palletSpaces: "1",
        weight: String(Math.ceil((order.total_weight || 10000) / 1000)),
        serviceName: process.env.PF_SERVICE || "A",

        surcharges: "",
        customersUniqueReference: String(order.order_number),
        customersUniqueReference2: "",

        // No notes allowed for your account
        notes: [],

        insuranceCode: "05",
        customerCharge: "",
        nonPalletforceConsignment: "",
        deliveryVehicleCode: "",
        consignmentType: "",
        hubIdentifyingCode: "",

        notifications: [
          {
            notificationType: "EMAIL",
            value: order.email
          }
        ],

        cartonCount: "",
        aSNFBABOLReferenceNumber: "",
        additionalDetails: { lines: [] }
      }
    ]
  };

  // Remove acceptedStatus if Shopify or your order adds it
  delete payload.consignments[0].acceptedStatus;

  return payload;
}
