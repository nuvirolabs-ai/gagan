import { describe, expect, it } from "vitest";
import { toCollectionReceipt } from "./collectionEvidence";

describe("sales collection proof selection", () => {
  it("keeps a local preview and JPEG bytes together for the collection submission", () => {
    expect(toCollectionReceipt({ uri: "file:///collection.jpg", base64: "cHJvb2Y=", fileName: "collection.jpg", fileSize: 5 })).toEqual({
      uri: "file:///collection.jpg",
      name: "collection.jpg",
      contentType: "image/jpeg",
      bodyBase64: "cHJvb2Y=",
    });
  });

  it("rejects an image larger than the private-storage limit", () => {
    expect(() => toCollectionReceipt({ uri: "file:///collection.jpg", base64: "cHJvb2Y=", fileSize: 10_000_001 })).toThrow("proof_too_large");
  });
});
