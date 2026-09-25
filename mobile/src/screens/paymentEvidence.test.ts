import { describe, expect, it } from "vitest";
import { toPaymentProof } from "./paymentEvidence";

describe("retailer payment proof selection", () => {
  it("keeps a local preview and JPEG bytes together for the selected payment", () => {
    expect(toPaymentProof({ uri: "file:///receipt.jpg", base64: "cHJvb2Y=", fileName: "receipt.jpg", fileSize: 5 })).toEqual({
      uri: "file:///receipt.jpg",
      name: "receipt.jpg",
      contentType: "image/jpeg",
      bodyBase64: "cHJvb2Y=",
    });
  });

  it("rejects a proof larger than the private-storage limit", () => {
    expect(() => toPaymentProof({ uri: "file:///receipt.jpg", base64: "cHJvb2Y=", fileSize: 10_000_001 })).toThrow("proof_too_large");
  });
});
