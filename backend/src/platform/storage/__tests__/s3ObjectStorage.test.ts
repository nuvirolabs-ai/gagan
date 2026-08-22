import { describe, expect, it, vi } from "vitest";
import { S3ObjectStorage } from "../s3ObjectStorage";

describe("S3 object storage", () => {
  it("writes private objects and returns presigned reads without exposing bucket paths", async () => {
    const send = vi.fn().mockResolvedValue({});
    const signed = vi.fn().mockResolvedValue("https://signed.example/opaque");
    const storage = new S3ObjectStorage({
      bucket: "private-bucket",
      client: { send } as never,
      sign: signed,
    });
    const stored = await storage.put({
      purpose: "kyc_document",
      contentType: "application/pdf",
      body: Buffer.from("document"),
    });

    expect(stored.objectKey).not.toContain(".pdf");
    expect(stored.objectKey).not.toContain("private");
    expect(send).toHaveBeenCalledTimes(1);
    await expect(storage.signedReadUrl(stored.objectKey, 60)).resolves.toBe("https://signed.example/opaque");
    expect(signed).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({ Bucket: "private-bucket" }) }), 60);
  });
});
