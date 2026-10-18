import { describe, expect, it, vi } from "vitest";
import {
  extractPhoneFromMsg91Payload,
  getMsg91AuthKey,
  Msg91Error,
  verifyMsg91AccessToken,
} from "../msg91Service";

describe("msg91Service", () => {
  it("cleans brackets and quotes from getMsg91AuthKey", () => {
    const key = getMsg91AuthKey();
    expect(key).not.toContain("<");
    expect(key).not.toContain(">");
    expect(key).not.toContain('"');
    expect(key.length).toBeGreaterThan(10);
  });

  describe("extractPhoneFromMsg91Payload", () => {
    it("extracts phone from string", () => {
      expect(extractPhoneFromMsg91Payload("9876543210")).toBe("9876543210");
      expect(extractPhoneFromMsg91Payload("+919876543210")).toBe("+919876543210");
    });

    it("extracts phone from object with mobile field", () => {
      expect(extractPhoneFromMsg91Payload({ mobile: "9876543210" })).toBe("9876543210");
    });

    it("extracts phone from object with identifier field", () => {
      expect(extractPhoneFromMsg91Payload({ identifier: "919876543210" })).toBe("919876543210");
    });

    it("returns null if no phone found", () => {
      expect(extractPhoneFromMsg91Payload(null)).toBeNull();
      expect(extractPhoneFromMsg91Payload({})).toBeNull();
      expect(extractPhoneFromMsg91Payload({ email: "test@example.com" })).toBeNull();
    });
  });

  describe("verifyMsg91AccessToken", () => {
    it("throws 400 when access token is missing or empty", async () => {
      await expect(verifyMsg91AccessToken({ accessToken: "" })).rejects.toThrow(Msg91Error);
      await expect(verifyMsg91AccessToken({ accessToken: "   " })).rejects.toThrow(
        "missing_access_token"
      );
    });

    it("handles mock tokens in test environment", async () => {
      const result = await verifyMsg91AccessToken({
        accessToken: "mock_token_123",
        expectedPhone: "9876543210",
      });
      expect(result.phone).toBe("+919876543210");
    });

    it("calls MSG91 endpoint with authkey and access-token and parses success response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => ({
          type: "success",
          message: "Token verified successfully",
          data: {
            mobile: "919876543210",
          },
        }),
      });

      const result = await verifyMsg91AccessToken({
        accessToken: "live_jwt_access_token_12345",
        fetchFn: mockFetch as any,
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe("https://control.msg91.com/api/v5/widget/verifyAccessToken");
      expect(options.method).toBe("POST");
      const body = JSON.parse(options.body);
      expect(body["access-token"]).toBe("live_jwt_access_token_12345");
      expect(body.authkey).toBeDefined();

      expect(result.phone).toBe("+919876543210");
    });

    it("throws 401 when MSG91 returns error", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        json: async () => ({
          message: "invalid access-token",
          type: "error",
          code: 701,
        }),
      });

      await expect(
        verifyMsg91AccessToken({
          accessToken: "live_invalid_token",
          fetchFn: mockFetch as any,
        })
      ).rejects.toThrow("invalid access-token");
    });
  });
});
