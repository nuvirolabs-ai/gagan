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

  it("reads the Ocean Home and stock hubs through the staff session", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({ sales: { today: 0 }, route: { stops: [] } })
      .mockResolvedValueOnce({ stockTakeAvailable: false, items: [] });
    const store = { load: vi.fn(), save: vi.fn(), clear: vi.fn() };
    const api = createStaffApi(request, store);
    await api.home();
    await api.stock();
    expect(request).toHaveBeenNthCalledWith(1, "/rep/home");
    expect(request).toHaveBeenNthCalledWith(2, "/rep/stock");
  });

  it("proposes a retailer and updates assigned commercial fields", async () => {
    const request = vi.fn().mockResolvedValue({ proposal: { id: "proposal-1" } });
    const store = { load: vi.fn(), save: vi.fn(), clear: vi.fn() };
    const api = createStaffApi(request, store);
    await api.proposeRetailer({ partyName: "Sharma Kirana", creditLimit: 40000, grade: "A", paymentTermDays: 21 });
    await api.updateRetailerProfile("retailer-1", { creditLimit: 50000, grade: "B", paymentTermDays: 30 });
    expect(request).toHaveBeenNthCalledWith(1, "/rep/retailer-proposals", expect.objectContaining({ method: "POST" }), true);
    expect(request).toHaveBeenNthCalledWith(2, "/rep/retailers/retailer-1/profile", expect.objectContaining({ method: "PATCH" }), true);
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
});
