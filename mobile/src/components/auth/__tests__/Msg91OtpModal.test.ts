import { describe, expect, it } from "vitest";
import { extractMsg91Token, MSG91_CONFIG } from "../msg91Config";

describe("Msg91OtpModal helper", () => {
  it("contains widgetId and tokenAuth from MSG91 specification", () => {
    expect(MSG91_CONFIG.widgetId).toBe("366a7265766a313133313832");
    expect(MSG91_CONFIG.tokenAuth).toBe("582611TbIk02hM6ad4580bP1");
    expect(MSG91_CONFIG.urls).toContain("https://verify.msg91.com/otp-provider.js");
  });

  it("extracts token when string directly provided", () => {
    expect(extractMsg91Token("eyJhbGciOi...123")).toBe("eyJhbGciOi...123");
  });

  it("extracts token from access-token property", () => {
    expect(extractMsg91Token({ "access-token": "jwt_token_456" })).toBe("jwt_token_456");
  });

  it("extracts token from nested data property", () => {
    expect(extractMsg91Token({ data: { "access-token": "nested_jwt_789" } })).toBe("nested_jwt_789");
  });

  it("returns null on empty or invalid inputs", () => {
    expect(extractMsg91Token(null)).toBeNull();
    expect(extractMsg91Token({})).toBeNull();
  });
});
