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
});
