import { prisma } from "../../lib/prisma";
import { getObjectStorage } from "../../platform/storage/storageRuntime";
import { ObjectStorageError, type ObjectStorage } from "../../platform/storage/objectStorage";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export class PaymentEvidenceError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
  }
}

export interface PaymentEvidenceInput {
  contentType: string;
  bodyBase64: string;
  checksum?: string;
}

interface PaymentEvidenceRecord {
  id: string;
  paymentId: string;
  objectKey: string;
  checksum: string;
  contentType: string;
  sizeBytes: number;
  createdAt: Date;
}

export class PaymentEvidenceService {
  constructor(private readonly storage?: ObjectStorage) {}

  async attach(paymentId: string, retailerId: string, input: PaymentEvidenceInput) {
    if (!IMAGE_TYPES.has(input.contentType)) throw new PaymentEvidenceError("unsupported_content_type", 400);
    const payment = await prisma.payment.findFirst({ where: { id: paymentId, retailerId }, select: { id: true } });
    if (!payment) throw new PaymentEvidenceError("payment_not_found", 404);

    const body = decodeBody(input.bodyBase64);
    let stored;
    try {
      stored = await this.storageAdapter().put({
        purpose: "payment_receipt",
        contentType: input.contentType,
        body,
        checksum: input.checksum,
      });
    } catch (error) {
      if (error instanceof ObjectStorageError) throw new PaymentEvidenceError(error.code, 400);
      throw new PaymentEvidenceError("evidence_storage_failed", 503);
    }

    try {
      const evidence = await prisma.paymentEvidence.create({ data: { paymentId, ...stored } });
      return this.present(evidence);
    } catch (error) {
      await this.storageAdapter().delete(stored.objectKey).catch(() => undefined);
      throw error;
    }
  }

  async list(paymentId: string, retailerId: string) {
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, retailerId },
      select: { evidence: { orderBy: { createdAt: "asc" } } },
    });
    if (!payment) throw new PaymentEvidenceError("payment_not_found", 404);
    return this.presentMany(payment.evidence);
  }

  async presentMany(evidence: PaymentEvidenceRecord[]) {
    return Promise.all(evidence.map((item) => this.present(item)));
  }

  private async present({ objectKey, ...evidence }: PaymentEvidenceRecord) {
    const signedUrl = await this.storageAdapter().signedReadUrl(objectKey, 300).catch(() => null);
    return { ...evidence, signedUrl };
  }

  private storageAdapter() {
    return this.storage ?? getObjectStorage();
  }
}

function decodeBody(value: string) {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 === 1) {
    throw new PaymentEvidenceError("invalid_evidence_body", 400);
  }
  const body = Buffer.from(value, "base64");
  if (body.length === 0) throw new PaymentEvidenceError("invalid_evidence_body", 400);
  return body;
}
