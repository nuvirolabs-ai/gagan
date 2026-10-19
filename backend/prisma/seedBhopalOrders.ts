import { prisma } from "../src/lib/prisma";
import { CommercialStatusCode } from "@prisma/client";

async function main() {
  console.log("Seeding Bhopal test data for multi-warehouse verification...");

  // 1. Find or create sales rep Priya Deshmukh (Bhopal region)
  let priya = await prisma.salesRep.findFirst({
    where: { name: { contains: "Priya" } },
  });
  if (!priya) {
    priya = await prisma.salesRep.create({
      data: {
        name: "Priya Deshmukh",
        phone: "9812345671",
      },
    });
  }

  // 2. Find default tier
  const tier = await prisma.tier.findFirstOrThrow();

  // 3. Find sample variants for orders
  const toorDal = await prisma.product.findFirst({
    where: { name: { contains: "Toor" } },
    include: { variants: true },
  });
  const rice = await prisma.product.findFirst({
    where: { name: { contains: "Rice" } },
    include: { variants: true },
  });

  const variant1 = toorDal?.variants[0]?.id;
  const variant2 = rice?.variants[0]?.id;

  if (!variant1) {
    console.log("No variant found to seed orders");
    return;
  }

  // 4. Create Bhopal Retailer 1: Bhopal Kirana Bhandar
  let retailer1 = await prisma.retailer.findFirst({
    where: { phone: "9826199991" },
  });
  if (!retailer1) {
    retailer1 = await prisma.retailer.create({
      data: {
        name: "Bhopal Kirana Bhandar",
        ownerName: "Sunil Verma",
        shopAddress: "Plot 12, New Market, TT Nagar, Bhopal",
        pincode: "462001",
        deliveryCity: "Bhopal",
        phone: "9826199991",
        status: "active",
        tierId: tier.id,
        salesRepId: priya.id,
        creditLimit: 200000,
      },
    });
    console.log("Created retailer:", retailer1.name, retailer1.deliveryCity);
  }

  // 5. Create Bhopal Retailer 2: Lake City Super Mart
  let retailer2 = await prisma.retailer.findFirst({
    where: { phone: "9826199992" },
  });
  if (!retailer2) {
    retailer2 = await prisma.retailer.create({
      data: {
        name: "Lake City Super Mart Bhopal",
        ownerName: "Deepak Sharma",
        shopAddress: "B-42, MP Nagar Zone 2, Bhopal",
        pincode: "462011",
        deliveryCity: "Bhopal",
        phone: "9826199992",
        status: "active",
        tierId: tier.id,
        salesRepId: priya.id,
        creditLimit: 300000,
      },
    });
    console.log("Created retailer:", retailer2.name, retailer2.deliveryCity);
  }

  // 6. Check existing orders for retailer1
  const existingOrders = await prisma.order.findMany({
    where: { retailerId: { in: [retailer1.id, retailer2.id] } },
  });

  if (existingOrders.length === 0) {
    // Order A: Placed by Priya Deshmukh, waiting in confirmed state
    const orderA = await prisma.order.create({
      data: {
        retailerId: retailer1.id,
        status: "confirmed",
        placedBy: "rep",
        placedByRepId: priya.id,
        orderTotal: 48500,
        remarks: "Deliver to Bhopal New Market depot before 2 PM",
        transportName: "Bhopal Express Cargo",
        expectedDeliveryAt: new Date(Date.now() + 86400000),
        items: {
          create: [
            { variantId: variant1, qtyOrdered: 8, unitPrice: 3200 },
            ...(variant2 ? [{ variantId: variant2, qtyOrdered: 4, unitPrice: 5725 }] : []),
          ],
        },
        commercialStatusEvents: {
          create: {
            code: CommercialStatusCode.SALES_ORDER_PUNCHED,
            retailerId: retailer1.id,
            reason: "Punched via Mobile Sales App by Priya Deshmukh",
          },
        },
      },
    });
    console.log("Created confirmed order for Bhopal (WH-002):", orderA.orderNo);

    // Order B: Placed by retailer directly, waiting in placed state
    const orderB = await prisma.order.create({
      data: {
        retailerId: retailer2.id,
        status: "placed",
        placedBy: "retailer",
        orderTotal: 32000,
        remarks: "Urgent delivery required for weekend sale",
        transportName: "Central MP Logistics",
        expectedDeliveryAt: new Date(Date.now() + 2 * 86400000),
        items: {
          create: [{ variantId: variant1, qtyOrdered: 10, unitPrice: 3200 }],
        },
      },
    });
    console.log("Created placed order for Bhopal (WH-002):", orderB.orderNo);
  } else {
    console.log("Bhopal orders already exist:", existingOrders.length);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
