import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const VERSION = "v1";

function keyFromEnvironment() {
  const configured = process.env.PII_ENCRYPTION_KEY?.trim();
  if (!configured || configured.length < 32) {
    throw new Error("PII_ENCRYPTION_KEY is required for sensitive identity data");
  }
  return createHash("sha256").update(configured, "utf8").digest();
}

/**
 * Encrypts identity data for database storage. The returned value is opaque
 * and deliberately has no plaintext or reversible metadata outside the key.
 */
export function encryptPii(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFromEnvironment(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(":");
}

export function decryptPii(payload: string) {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded] = payload.split(":");
  if (version !== VERSION || !ivEncoded || !tagEncoded || !ciphertextEncoded) throw new Error("Invalid encrypted PII");
  const decipher = createDecipheriv("aes-256-gcm", keyFromEnvironment(), Buffer.from(ivEncoded, "base64url"));
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextEncoded, "base64url")), decipher.final()]).toString("utf8");
}

export function maskAadhaar(last4: string | null | undefined) {
  return last4 ? `XXXX-XXXX-${last4}` : null;
}
