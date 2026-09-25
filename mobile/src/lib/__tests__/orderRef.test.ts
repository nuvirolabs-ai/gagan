import { describe, expect, it } from "vitest";
import { formatOrderRef } from "../orderRef";

describe("formatOrderRef", () => {
  it("prefers the SAP external reference when present", () => {
    expect(formatOrderRef({ sapExternalReference: "GGN-00000007", orderNo: 7 })).toBe("GGN-00000007");
  });

  it("pads orderNo to eight digits to match the outbox", () => {
    expect(formatOrderRef({ orderNo: 42 })).toBe("GGN-00000042");
  });
});
