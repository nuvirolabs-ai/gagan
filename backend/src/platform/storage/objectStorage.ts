import { createHash, randomUUID } from "node:crypto";

export const MAX_EVIDENCE_BYTES = 10_000_000;
export const ALLOWED_EVIDENCE_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type EvidencePurpose = "kyc_document" | "collection_receipt" | "pod";

export interface PutObjectInput {
  purpose: EvidencePurpose;
  contentType: string;
  body: Buffer;
  checksum?: string;
}

export interface StoredObject {
  objectKey: string;
  checksum: string;
  contentType: string;
  sizeBytes: number;
}

export class ObjectStorageError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "ObjectStorageError";
  }
}

export interface ObjectStorage {
  put(input: PutObjectInput): Promise<StoredObject>;
  read(objectKey: string): Promise<Buffer>;
  signedReadUrl(objectKey: string, expiresInSeconds: number): Promise<string>;
  delete(objectKey: string): Promise<void>;
}

export function validatePutInput(input: PutObjectInput) {
  if (!ALLOWED_EVIDENCE_CONTENT_TYPES.has(input.contentType)) {
    throw new ObjectStorageError("unsupported_content_type", "Evidence content type is not allowed");
  }
  if (input.body.length === 0) {
    throw new ObjectStorageError("evidence_empty", "Evidence file cannot be empty");
  }
  if (input.body.length > MAX_EVIDENCE_BYTES) {
    throw new ObjectStorageError("evidence_too_large", "Evidence file exceeds the 10 MB limit");
  }
  const checksum = createHash("sha256").update(input.body).digest("hex");
  if (input.checksum && input.checksum !== checksum) {
    throw new ObjectStorageError("checksum_mismatch", "Evidence checksum does not match its body");
  }
  return checksum;
}

export function opaqueObjectKey(purpose: EvidencePurpose, now = new Date()) {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${purpose}/${year}/${month}/${randomUUID()}`;
}
