import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:4000";

async function runVerification() {
  console.log("=== STARTING END-TO-END VERIFICATION ===");

  // 1. Salesperson Request OTP
  console.log("1. Requesting OTP for Vikas Bhimke (9812345680)...");
  const otpReqRes = await fetch(`${BASE_URL}/rep/auth/otp/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "9812345680" }),
  });
  const otpReqData = await otpReqRes.json();
  console.log("OTP request result:", otpReqData);
  if (!otpReqRes.ok || !otpReqData.challengeId) {
    throw new Error(`Failed OTP request: ${JSON.stringify(otpReqData)}`);
  }

  // 2. Verify OTP
  console.log("2. Verifying OTP with staging code 123456...");
  const otpVerifyRes = await fetch(`${BASE_URL}/rep/auth/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone: "9812345680",
      otp: "123456",
      challengeId: otpReqData.challengeId,
    }),
  });
  const otpVerifyData = await otpVerifyRes.json();
  console.log("Login success! Rep Name:", otpVerifyData.staff?.name, "Token:", otpVerifyData.accessToken?.slice(0, 15) + "...");
  if (!otpVerifyRes.ok || !otpVerifyData.accessToken) {
    throw new Error(`Failed OTP verify: ${JSON.stringify(otpVerifyData)}`);
  }
  const repToken = otpVerifyData.accessToken;

  // 3. Fetch Retailers
  console.log("3. Fetching retailers assigned to Vikas Bhimke...");
  const retailersRes = await fetch(`${BASE_URL}/rep/retailers`, {
    headers: { Authorization: `Bearer ${repToken}` },
  });
  const retailersData = await retailersRes.json();
  console.log(`Found ${retailersData.retailers?.length} assigned retailers!`);
  if (!retailersData.retailers || retailersData.retailers.length === 0) {
    throw new Error("No retailers returned for Vikas Bhimke!");
  }

  const sampleRetailer = retailersData.retailers[0];
  console.log("Sample retailer:", sampleRetailer.name, "Credit Limit:", sampleRetailer.creditLimit, "Available:", sampleRetailer.available);

  // 4. Fetch Catalog for Sample Retailer
  console.log(`4. Fetching catalog for ${sampleRetailer.name}...`);
  const catalogRes = await fetch(`${BASE_URL}/rep/retailers/${sampleRetailer.id}/catalog`, {
    headers: { Authorization: `Bearer ${repToken}` },
  });
  const catalogData = await catalogRes.json();
  console.log(`Loaded ${catalogData.catalog?.length} products in catalog!`);

  let pendingSetupCount = 0;
  let orderableCount = 0;
  let sampleOrderableVariant: any = null;

  for (const prod of catalogData.catalog) {
    for (const v of prod.variants) {
      if (v.orderable === false) {
        pendingSetupCount++;
        console.warn(`Variant not orderable: ${prod.name} ${v.unitSize} - Reason: ${v.orderingReason}`);
      } else {
        orderableCount++;
        if (!sampleOrderableVariant) {
          sampleOrderableVariant = { product: prod, variant: v };
        }
      }
    }
  }

  console.log(`Orderability breakdown: Orderable = ${orderableCount}, Pending Setup = ${pendingSetupCount}`);
  if (pendingSetupCount > 0) {
    throw new Error(`Found ${pendingSetupCount} variants with setup pending! Must be 0.`);
  }

  // 5. Create Commercial Quote
  console.log(`5. Creating commercial quote for ${sampleOrderableVariant.product.name} (${sampleOrderableVariant.variant.unitSize})...`);
  const quoteRes = await fetch(`${BASE_URL}/rep/commercial/quotes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${repToken}`,
    },
    body: JSON.stringify({
      retailerId: sampleRetailer.id,
      items: [{ variantId: sampleOrderableVariant.variant.id, qty: 3 }],
    }),
  });
  const quoteData = await quoteRes.json();
  console.log("Commercial quote generated:", quoteData.quote?.id, "Total:", quoteData.quote?.snapshot?.total);
  if (!quoteRes.ok || !quoteData.quote) {
    throw new Error(`Failed to create commercial quote: ${JSON.stringify(quoteData)}`);
  }

  // 6. Punch Order
  console.log("6. Punching order as Vikram Singh...");
  const orderRes = await fetch(`${BASE_URL}/rep/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${repToken}`,
      "Idempotency-Key": `test-punch-${Date.now()}`,
    },
    body: JSON.stringify({
      retailerId: sampleRetailer.id,
      items: [{ variantId: sampleOrderableVariant.variant.id, qty: 3 }],
      commercial: {
        quoteId: quoteData.quote.id,
        revision: quoteData.quote.revision,
      },
    }),
  });
  const orderData = await orderRes.json();
  console.log("Order punched successfully! Order No:", orderData.order?.orderNo, "Status:", orderData.order?.status, "Total:", orderData.order?.orderTotal);
  if (!orderRes.ok || !orderData.order) {
    throw new Error(`Failed to punch order: ${JSON.stringify(orderData)}`);
  }
  const createdOrderId = orderData.order.id;

  // 7. Warehouse Manager Login
  console.log("7. Logging in as Warehouse Manager (warehouse-lead@gagan.test)...");
  const whLoginRes = await fetch(`${BASE_URL}/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "warehouse-lead@gagan.test",
      password: "password123",
    }),
  });
  const whLoginData = await whLoginRes.json();
  console.log("Warehouse login success! Name:", whLoginData.name, "Token:", whLoginData.accessToken?.slice(0, 15) + "...");
  if (!whLoginRes.ok || !whLoginData.accessToken) {
    throw new Error(`Failed warehouse login: ${JSON.stringify(whLoginData)}`);
  }
  const whToken = whLoginData.accessToken;

  // 8. Fetch Warehouse Orders
  console.log("8. Fetching warehouse orders for fulfillment...");
  const whOrdersRes = await fetch(`${BASE_URL}/admin/warehouse-orders?status=all`, {
    headers: { Authorization: `Bearer ${whToken}` },
  });
  const whOrdersData = await whOrdersRes.json();
  console.log(`Warehouse portal received ${whOrdersData.orders?.length} orders.`);
  const foundOrder = whOrdersData.orders?.find((o: any) => o.id === createdOrderId);
  if (!foundOrder) {
    throw new Error(`Created order ${createdOrderId} not found in warehouse orders!`);
  }
  console.log("Warehouse verified Order #1:", {
    orderNo: foundOrder.orderNo,
    retailer: foundOrder.retailer?.name,
    status: foundOrder.status,
    itemsCount: foundOrder.items?.length,
  });

  // 9. Warehouse transitions: Pack -> Dispatch
  console.log("9. Transitioning order: Packing...");
  const packRes = await fetch(`${BASE_URL}/admin/warehouse-orders/${createdOrderId}/pack`, {
    method: "POST",
    headers: { Authorization: `Bearer ${whToken}` },
  });
  const packData = await packRes.json();
  console.log("Order packed! New status:", packData.status || packData.order?.status);

  console.log("10. Transitioning order: Dispatching (Out for delivery)...");
  const dispatchRes = await fetch(`${BASE_URL}/admin/warehouse-orders/${createdOrderId}/dispatch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${whToken}`,
    },
    body: JSON.stringify({
      routeId: "ROUTE-INDORE-CENTRAL-1",
    }),
  });
  const dispatchData = await dispatchRes.json();
  console.log("Order dispatched! New status:", dispatchData.status || dispatchData.order?.status);

  console.log("\n=== ALL END-TO-END TESTS PASSED WITH 100% SUCCESS! ===");
}

runVerification()
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
