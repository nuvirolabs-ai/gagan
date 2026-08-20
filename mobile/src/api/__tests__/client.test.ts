import { describe, expect, it, vi } from "vitest";
import { createRetailerApi } from "../retailerApi";

describe("retailer auth API", () => {
  it("verifies the issued challenge and securely saves the token pair", async () => {
    const request = vi.fn().mockResolvedValue({
      accessToken: "access",
      refreshToken: "refresh",
      retailer: { id: "retailer-1", name: "Shah Stores", phone: "+919999999999" },
    });
    const store = { load: vi.fn(), save: vi.fn(), clear: vi.fn() };
    const api = createRetailerApi(request, store);

    const result = await api.verifyOtp("challenge-1", "9999999999", "123456");
    expect(request).toHaveBeenCalledWith(
      "/auth/otp/verify",
      expect.objectContaining({ body: JSON.stringify({ challengeId: "challenge-1", phone: "9999999999", otp: "123456" }) }),
      false
    );
    expect(store.save).toHaveBeenCalledWith({ accessToken: "access", refreshToken: "refresh" });
    expect(result.retailer.name).toBe("Shah Stores");
  });
});
