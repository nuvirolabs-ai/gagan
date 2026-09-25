import { describe, expect, it, vi } from "vitest";
import { createStaffApi } from "../staffApi";

describe("staff auth API", () => {
  it("verifies the issued challenge and securely saves staff permissions", async () => {
    const request = vi.fn().mockResolvedValue({
      accessToken: "access",
      refreshToken: "refresh",
      staff: { id: "staff-1", name: "Meera", permissions: ["collection.submit"] },
      rep: null,
    });
    const store = { load: vi.fn(), save: vi.fn(), clear: vi.fn() };
    const api = createStaffApi(request, store);

    const result = await api.verifyOtp("challenge-1", "9999999999", "123456");
    expect(request).toHaveBeenCalledWith(
      "/rep/auth/otp/verify",
      expect.objectContaining({ body: JSON.stringify({ challengeId: "challenge-1", phone: "9999999999", otp: "123456" }) }),
      false
    );
    expect(store.save).toHaveBeenCalledWith({ accessToken: "access", refreshToken: "refresh" });
    expect(result.staff.permissions).toEqual(["collection.submit"]);
  });

  it("keeps the refresh token when step-up replaces the access token", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({ challengeId: "step-1" })
      .mockResolvedValueOnce({ accessToken: "elevated" });
    const store = {
      load: vi.fn().mockResolvedValue({ accessToken: "old", refreshToken: "refresh" }),
      save: vi.fn(),
      clear: vi.fn(),
    };
    const api = createStaffApi(request, store);

    await api.requestStepUp();
    await api.completeStepUp("step-1", "123456");

    expect(store.save).toHaveBeenCalledWith({ accessToken: "elevated", refreshToken: "refresh" });
  });

  it("submits a collection with an idempotency key through the staff session", async () => {
    const request = vi.fn().mockResolvedValue({ submission: { id: "submission-1" } });
    const store = { load: vi.fn(), save: vi.fn(), clear: vi.fn() };
    const api = createStaffApi(request, store);

    await api.submitCollection({
      retailerId: "retailer-1",
      amount: 250,
      method: "cash",
      reference: "RCPT-123",
      notes: "Retailer requested a call next week",
      idempotencyKey: "receipt-1234",
    });

    expect(request).toHaveBeenCalledWith(
      "/rep/collections",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          retailerId: "retailer-1",
          amount: 250,
          method: "cash",
          reference: "RCPT-123",
          notes: "Retailer requested a call next week",
          idempotencyKey: "receipt-1234",
        }),
      }),
      true
    );
  });

  it("starts and submits a retailer KYC case through the staff session", async () => {
    const request = vi.fn().mockResolvedValue({ kycCase: { id: "case-1" } });
    const store = { load: vi.fn(), save: vi.fn(), clear: vi.fn() };
    const api = createStaffApi(request, store);

    await api.startKyc("retailer-1");
    await api.submitKyc("case-1");
    expect(request).toHaveBeenNthCalledWith(1, "/rep/kyc", expect.objectContaining({ method: "POST", body: JSON.stringify({ retailerId: "retailer-1" }) }), true);
    expect(request).toHaveBeenNthCalledWith(2, "/rep/kyc/case-1/submit", expect.objectContaining({ method: "POST" }), true);
  });

  it("punches pending retailer demand idempotently and converts only through the review endpoint", async () => {
    const request = vi.fn().mockResolvedValue({ intent: { id: "intent-1" } });
    const store = { load: vi.fn(), save: vi.fn(), clear: vi.fn() };
    const api = createStaffApi(request, store);

    await api.proposalDemandCatalog("proposal-1");
    await api.punchProposalOrderIntent("proposal-1", [{ variantId: "sku-1", qty: 2 }], "punch-1");
    await api.proposalOrderIntent("intent-1");
    await api.convertProposalOrderIntent("intent-1", { quoteId: "quote-1", revision: 3 });

    expect(request).toHaveBeenNthCalledWith(1, "/rep/retailer-proposals/proposal-1/catalog");
    expect(request).toHaveBeenNthCalledWith(2, "/rep/retailer-proposals/proposal-1/order-intents", expect.objectContaining({
      method: "POST",
      headers: { "Idempotency-Key": "punch-1" },
      body: JSON.stringify({ items: [{ variantId: "sku-1", qty: 2 }] }),
    }));
    expect(request).toHaveBeenNthCalledWith(3, "/rep/retailer-proposal-order-intents/intent-1");
    expect(request).toHaveBeenNthCalledWith(4, "/rep/retailer-proposal-order-intents/intent-1/convert", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ commercial: { quoteId: "quote-1", revision: 3 } }),
    }), true);
  });

  it("sends receipt bytes without exposing a storage key", async () => {
    const request = vi.fn().mockResolvedValue({ submission: { id: "submission-1" } });
    const store = { load: vi.fn(), save: vi.fn(), clear: vi.fn() };
    const api = createStaffApi(request, store);
    await api.submitCollection({ retailerId: "retailer-1", amount: 250, method: "cash", idempotencyKey: "receipt-5678", evidence: { contentType: "image/jpeg", bodyBase64: "cmVjZWlwdA==" } });
    const [, options, auth] = request.mock.calls[0];
    expect(auth).toBe(true);
    expect(JSON.parse(String(options.body))).toMatchObject({ evidence: { contentType: "image/jpeg", bodyBase64: "cmVjZWlwdA==" } });
  });

  it("loads the assigned retailer ledger with a sequence cursor", async () => {
    const request = vi.fn().mockResolvedValue({ entries: [], nextCursor: null });
    const store = { load: vi.fn(), save: vi.fn(), clear: vi.fn() };
    const api = createStaffApi(request, store);

    await api.retailerLedger("retailer-1", "123");

    expect(request).toHaveBeenCalledWith("/rep/retailers/retailer-1/ledger?beforeSequence=123");
  });

  it("provides a staff-session client for hierarchy-scoped team performance", async () => {
    const request = vi.fn().mockResolvedValue({ team: { salespeople: 1 } });
    const store = { load: vi.fn(), save: vi.fn(), clear: vi.fn() };
    const api = createStaffApi(request, store);

    expect(typeof api.salesLeader).toBe("function");
    await api.salesLeader();
    expect(request).toHaveBeenCalledWith("/rep/sales-leader");
  });
});
