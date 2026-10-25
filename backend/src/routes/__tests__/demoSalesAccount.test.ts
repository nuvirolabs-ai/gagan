import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../app";

const app = createApp();

describe("Demo Sales Account for 9999999999", () => {
  it("requests OTP, verifies, loads retailers, catalog, and punches an order", async () => {
    // 1. Request OTP
    const reqRes = await request(app)
      .post("/rep/auth/otp/request")
      .send({ phone: "9999999999" });

    expect(reqRes.status).toBe(202);
    expect(reqRes.body.accepted).toBe(true);
    expect(reqRes.body.challengeId).toBeDefined();

    // 2. Verify OTP
    const verifyRes = await request(app)
      .post("/rep/auth/otp/verify")
      .send({
        challengeId: reqRes.body.challengeId,
        phone: "9999999999",
        otp: "123456",
      });

    expect(verifyRes.status).toBe(200);
    const token = verifyRes.body.accessToken;
    expect(token).toBeDefined();

    // 3. Get Retailers
    const retailersRes = await request(app)
      .get("/rep/retailers")
      .set("Authorization", `Bearer ${token}`);

    expect(retailersRes.status).toBe(200);
    expect(retailersRes.body.retailers).toBeDefined();
    expect(retailersRes.body.retailers.length).toBeGreaterThan(0);

    const retailer = retailersRes.body.retailers[0];
    expect(retailer.id).toBeDefined();

    // 4. Get Catalog for Retailer
    const catalogRes = await request(app)
      .get(`/rep/retailers/${retailer.id}/catalog`)
      .set("Authorization", `Bearer ${token}`);

    expect(catalogRes.status).toBe(200);
    const catalog = catalogRes.body.catalog;
    expect(Array.isArray(catalog)).toBe(true);
    expect(catalog.length).toBeGreaterThan(0);

    const firstProduct = catalog[0];
    expect(firstProduct.variants.length).toBeGreaterThan(0);
    const firstVariant = firstProduct.variants[0];

    // 5. Commercial Quote
    const quoteRes = await request(app)
      .post("/rep/commercial/quotes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        retailerId: retailer.id,
        items: [{ variantId: firstVariant.id, qty: 2 }],
      });

    expect(quoteRes.status).toBe(200);
    expect(quoteRes.body.quote).toBeDefined();
    const quote = quoteRes.body.quote;

    // 6. Punch / Checkout Order
    const orderRes = await request(app)
      .post("/rep/orders")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", `test-order-${Date.now()}`)
      .send({
        retailerId: retailer.id,
        items: [{ variantId: firstVariant.id, qty: 2 }],
        commercial: { quoteId: quote.id, revision: quote.revision },
      });

    expect(orderRes.status).toBe(201);
    expect(orderRes.body.order).toBeDefined();
    expect(orderRes.body.order.retailerId).toBe(retailer.id);
    expect(["pending", "confirmed"]).toContain(orderRes.body.order.status);
  });
});
