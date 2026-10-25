import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../app";

describe("Demo Retailer Account for 9999999999", () => {
  const app = createApp();

  it("logs in with 9999999999 and OTP 123456, views catalog, and checks out an order", async () => {
    // 1. Request OTP
    const reqRes = await request(app)
      .post("/auth/otp/request")
      .send({ phone: "9999999999" });

    expect([200, 202]).toContain(reqRes.status);
    expect(reqRes.body.accepted).toBe(true);
    expect(reqRes.body.challengeId).toBeDefined();

    // 2. Verify OTP
    const verifyRes = await request(app)
      .post("/auth/otp/verify")
      .send({
        challengeId: reqRes.body.challengeId,
        phone: "9999999999",
        otp: "123456",
      });

    expect(verifyRes.status).toBe(200);
    const token = verifyRes.body.accessToken;
    expect(token).toBeDefined();
    expect(verifyRes.body.retailer.phone).toBe("9999999999");

    // 3. /auth/me check
    const meRes = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.retailer.id).toBe(verifyRes.body.retailer.id);

    // 4. Get Catalog
    const catRes = await request(app)
      .get("/catalog")
      .set("Authorization", `Bearer ${token}`);

    expect(catRes.status).toBe(200);
    expect(catRes.body.catalog.length).toBeGreaterThan(0);
    const firstProduct = catRes.body.catalog[0];
    const firstVariant = firstProduct.variants[0];
    expect(firstVariant.id).toBeDefined();

    // 5. Commercial Quote
    const quoteRes = await request(app)
      .post("/commercial/quotes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ variantId: firstVariant.id, qty: 2 }],
      });

    expect(quoteRes.status).toBe(200);
    const quote = quoteRes.body.quote;
    expect(quote.id).toBeDefined();

    // 6. Checkout Order
    const orderRes = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", `retailer-test-${Date.now()}`)
      .send({
        items: [{ variantId: firstVariant.id, qty: 2 }],
        commercial: { quoteId: quote.id, revision: quote.revision },
      });

    expect(orderRes.status).toBe(201);
    expect(orderRes.body.order).toBeDefined();
    expect(orderRes.body.order.retailerId).toBe(verifyRes.body.retailer.id);
    expect(orderRes.body.order.placedBy).toBe("retailer");
  });
});
