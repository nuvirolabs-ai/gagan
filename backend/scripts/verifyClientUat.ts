import "dotenv/config";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { drainOutbox } from "../src/lib/sap/outbox";
import { clientUatCanonicalKey, loadClientUatSource } from "../src/modules/clientUat/clientUatSource";

const app = createApp({ corsOrigins: [] });
const OTP = process.env.MOCK_OTP ?? "123456";

function argument(name: string) {
  const prefix = `${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length);
}

function required(name: string) {
  const value = argument(name);
  if (!value) throw new Error(`missing_${name.replace(/^--/, "")}`);
  return value;
}

async function otpLogin(prefix: "/auth" | "/rep/auth", phone: string) {
  const challenge = await request(app).post(`${prefix}/otp/request`).send({ phone });
  if (challenge.status !== 202) throw new Error(`otp_request_failed_${prefix}_${challenge.status}_${JSON.stringify(challenge.body)}`);
  const verified = await request(app).post(`${prefix}/otp/verify`).send({ challengeId: challenge.body.challengeId, phone, otp: OTP });
  if (verified.status !== 200) throw new Error(`otp_verify_failed_${prefix}_${verified.status}_${JSON.stringify(verified.body)}`);
  return verified.body.accessToken as string;
}

async function createQuote(token: string, route: "/commercial/quotes" | "/rep/commercial/quotes", body: Record<string, unknown>) {
  const response = await request(app).post(route).set("Authorization", `Bearer ${token}`).send(body);
  if (response.status !== 200 || !response.body.quote) throw new Error(`quote_failed_${response.status}_${JSON.stringify(response.body)}`);
  return response.body.quote as { id: string; revision: number };
}

async function confirmQuote(adminToken: string, quote: { id: string; revision: number }) {
  const response = await request(app).put(`/admin/commercial/quotes/${quote.id}/freight`).set("Authorization", `Bearer ${adminToken}`).send({
    revision: quote.revision,
    freight: { entity: "jain_traders", amount: "0", gstPercent: "5.00", recordedQuintals: "0", recordedKilometres: "0" },
  });
  if (response.status !== 200 || !response.body.quote) throw new Error(`quote_confirmation_failed_${response.status}_${JSON.stringify(response.body)}`);
  return response.body.quote as { id: string; revision: number };
}

async function createOrder(route: "/orders" | "/rep/orders", token: string, idempotencyKey: string, body: Record<string, unknown>) {
  const response = await request(app).post(route).set("Authorization", `Bearer ${token}`).set("Idempotency-Key", idempotencyKey).send(body);
  if (response.status !== 201 || !response.body.order) throw new Error(`order_failed_${route}_${response.status}_${JSON.stringify(response.body)}`);
  return response.body.order as { id: string; status: string; placedBy: string; placedByRepId: string | null; items: Array<{ id: string; variantId: string }> };
}

async function main() {
  const source = await loadClientUatSource({ products: required("--products"), pricing: required("--pricing"), retailers: required("--retailers"), assignments: required("--assignments") });
  const adminLogin = await request(app).post("/admin/auth/login").send({ email: process.env.CLIENT_UAT_ADMIN_EMAIL ?? "client-uat-admin@gagan.test", password: process.env.CLIENT_UAT_ADMIN_PASSWORD ?? "uat-admin-15d" });
  if (adminLogin.status !== 200) throw new Error(`admin_login_failed_${adminLogin.status}_${JSON.stringify(adminLogin.body)}`);
  const adminToken = adminLogin.body.accessToken as string;
  const [retailerA, retailerB] = await prisma.retailer.findMany({ where: { status: "active" }, orderBy: { phone: "asc" }, take: 2 });
  if (!retailerA || !retailerB) throw new Error("uat_retailers_missing");
  const retailerToken = await otpLogin("/auth", retailerA.phone);
  const staffToken = await otpLogin("/rep/auth", process.env.CLIENT_UAT_SALESPERSON_PHONE ?? "9000000001");

  const retailerCatalog = await request(app).get("/catalog").set("Authorization", `Bearer ${retailerToken}`);
  if (retailerCatalog.status !== 200) throw new Error(`retailer_catalog_failed_${retailerCatalog.status}`);
  const catalogVariants = retailerCatalog.body.catalog.flatMap((product: any) => product.variants.map((variant: any) => ({ ...variant, productName: product.name })));
  const readyVariants = catalogVariants.filter((variant: any) => variant.orderable === true && variant.orderingStatus === "ready" && variant.availability?.status === "available" && variant.price != null);
  if (readyVariants.length !== source.counts.canonicalSkuCount) throw new Error(`catalogue_ready_count_${readyVariants.length}_expected_${source.counts.canonicalSkuCount}`);

  const dbVariants = await prisma.variant.findMany({ include: { product: true, priceList: true } });
  const pricingMatched = dbVariants.every((variant) => {
    const key = clientUatCanonicalKey({ productName: variant.product.name, unitSize: variant.unitSize, unit: variant.unit, unitsPerCase: variant.unitsPerCase, unitWeightKg: Number(variant.unitWeightKg) });
    const sourcePrice = source.pricing.find((price) => price.canonicalKey === key);
    return sourcePrice != null && variant.priceList.length === 2 && variant.priceList.every((price) => Number(price.price) === sourcePrice.casePrice);
  });
  if (!pricingMatched) throw new Error("pricing_does_not_match_source_economics");

  const smallPack = readyVariants.find((variant: any) => variant.caseWeightKg <= 5) ?? readyVariants[0];
  const quote = await createQuote(retailerToken, "/commercial/quotes", { items: [{ variantId: smallPack.id, qty: 1 }] });
  const confirmedQuote = await confirmQuote(adminToken, quote);
  const retailerOrder = await createOrder("/orders", retailerToken, `client-uat-retailer-${Date.now()}`, { items: [{ variantId: smallPack.id, qty: 1 }], commercial: { quoteId: confirmedQuote.id, revision: confirmedQuote.revision } });

  const repList = await request(app).get("/rep/retailers").set("Authorization", `Bearer ${staffToken}`);
  if (repList.status !== 200 || repList.body.retailers.length !== 30) throw new Error(`rep_retailer_list_failed_${repList.status}_${repList.body.retailers?.length}`);
  const repRetailer = repList.body.retailers.find((retailer: { id: string }) => retailer.id === retailerB.id);
  if (!repRetailer) throw new Error("assigned_second_retailer_missing");
  const repQuote = await createQuote(staffToken, "/rep/commercial/quotes", { retailerId: retailerB.id, items: [{ variantId: smallPack.id, qty: 1 }] });
  const confirmedRepQuote = await confirmQuote(adminToken, repQuote);
  const salespersonOrder = await createOrder("/rep/orders", staffToken, `client-uat-rep-${Date.now()}`, { retailerId: retailerB.id, items: [{ variantId: smallPack.id, qty: 1 }], commercial: { quoteId: confirmedRepQuote.id, revision: confirmedRepQuote.revision } });

  const adminOrders = await request(app).get("/admin/orders").set("Authorization", `Bearer ${adminToken}`);
  if (adminOrders.status !== 200 || !adminOrders.body.orders.some((order: { id: string }) => order.id === retailerOrder.id) || !adminOrders.body.orders.some((order: { id: string }) => order.id === salespersonOrder.id)) throw new Error("admin_order_visibility_failed");

  const approve = await request(app).post(`/admin/orders/${retailerOrder.id}/approve`).set("Authorization", `Bearer ${adminToken}`).send();
  const pack = await request(app).post(`/admin/orders/${retailerOrder.id}/pack`).set("Authorization", `Bearer ${adminToken}`).send();
  if (approve.status !== 200 || pack.status !== 200) throw new Error(`warehouse_transition_failed_${approve.status}_${pack.status}`);
  const assign = await request(app).post(`/admin/dispatch/${retailerOrder.id}/assign`).set("Authorization", `Bearer ${adminToken}`).send({ routeId: "CLIENT-UAT-ROUTE-001" });
  if (assign.status !== 200) throw new Error(`dispatch_assign_failed_${assign.status}_${JSON.stringify(assign.body)}`);
  const delivered = await request(app).post(`/admin/dispatch/${retailerOrder.id}/pod`).set("Authorization", `Bearer ${adminToken}`).send({ podType: "otp", items: retailerOrder.items.map((item) => ({ orderItemId: item.id, qtyDelivered: 1 })) });
  if (delivered.status !== 200) throw new Error(`delivery_failed_${delivered.status}_${JSON.stringify(delivered.body)}`);
  await drainOutbox();

  const [retailerFinal, salespersonFinal, retailerEvents, outbox] = await Promise.all([
    prisma.order.findUniqueOrThrow({ where: { id: retailerOrder.id }, include: { invoice: true, items: true } }),
    prisma.order.findUniqueOrThrow({ where: { id: salespersonOrder.id }, include: { items: true } }),
    prisma.auditEvent.findMany({ where: { subjectType: "order", subjectId: retailerOrder.id }, orderBy: { createdAt: "asc" }, select: { action: true, metadata: true } }),
    prisma.sapOutbox.findMany({ where: { referenceId: retailerOrder.id }, select: { kind: true, status: true } }),
  ]);
  const statusEvidence = retailerEvents.map((event) => event.action);
  const result = {
    source: { rawRows: source.counts, pricingBasis: source.pricingBasis },
    catalogue: { readyVariants: readyVariants.length, pricingMatched, retailerCatalogProducts: retailerCatalog.body.catalog.length },
    retailers: { activeAssignedVisible: repList.body.retailers.length },
    orders: {
      retailer: { id: retailerFinal.id, status: retailerFinal.status, total: Number(retailerFinal.orderTotal), invoiceId: retailerFinal.invoice?.id ?? null },
      salesperson: { id: salespersonFinal.id, status: salespersonFinal.status, placedBy: salespersonFinal.placedBy, placedByRepId: salespersonFinal.placedByRepId },
      adminVisible: true,
      statusEvents: statusEvidence,
      sapOutbox: outbox,
      lastVerifiedBackendStatus: retailerFinal.status,
    },
    pass: retailerFinal.status === "delivered" && salespersonFinal.placedBy === "rep" && salespersonFinal.placedByRepId != null && pricingMatched,
  };
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
