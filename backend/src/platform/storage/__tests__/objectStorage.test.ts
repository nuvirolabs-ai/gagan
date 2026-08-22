import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalObjectStorage } from "../localObjectStorage";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("local private object storage", () => {
  function storage() {
    const root = mkdtempSync(join(tmpdir(), "gagan-evidence-"));
    roots.push(root);
    return new LocalObjectStorage(root);
  }

  it("writes an opaque key, verifies checksum, reads privately, signs and deletes", async () => {
    const objectStorage = storage();
    const body = Buffer.from("private kyc document");
    const checksum = createHash("sha256").update(body).digest("hex");

    const stored = await objectStorage.put({
      purpose: "kyc_document",
      contentType: "application/pdf",
      body,
      checksum,
    });

    expect(stored.objectKey).not.toContain("private");
    expect(stored.checksum).toBe(checksum);
    await expect(objectStorage.read(stored.objectKey)).resolves.toEqual(body);
    await expect(objectStorage.signedReadUrl(stored.objectKey, 60)).resolves.toMatch(/^local-storage:\/\//);

    await objectStorage.delete(stored.objectKey);
    await expect(objectStorage.read(stored.objectKey)).rejects.toThrow(/not found/i);
  });

  it("rejects unsupported content, oversized bodies and checksum mismatch", async () => {
    const objectStorage = storage();
    await expect(
      objectStorage.put({ purpose: "kyc_document", contentType: "text/plain", body: Buffer.from("x") })
    ).rejects.toMatchObject({ code: "unsupported_content_type" });
    await expect(
      objectStorage.put({ purpose: "kyc_document", contentType: "application/pdf", body: Buffer.alloc(10_000_001) })
    ).rejects.toMatchObject({ code: "evidence_too_large" });
    await expect(
      objectStorage.put({
        purpose: "kyc_document",
        contentType: "application/pdf",
        body: Buffer.from("x"),
        checksum: "wrong",
      })
    ).rejects.toMatchObject({ code: "checksum_mismatch" });
  });
});
