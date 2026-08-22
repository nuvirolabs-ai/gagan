import {
  EvidencePurpose,
  KycCaseStatus,
  KycDocumentStatus,
  KycDocumentType,
  KycReviewDecision,
  Prisma,
  RetailerLifecycle,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { getObjectStorage } from "../../platform/storage/storageRuntime";
import type { ObjectStorage } from "../../platform/storage/objectStorage";

export const REQUIRED_KYC_DOCUMENTS = [
  KycDocumentType.business_registration,
  KycDocumentType.identity_proof,
  KycDocumentType.address_proof,
] as const;

const SUBMIT_PERMISSION = "kyc.submit";
const VIEW_PERMISSION = "kyc.view";
const REVIEW_PERMISSION = "kyc.review";
const ADMIN_PERMISSION = "staff.manage";

export class KycServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 409,
    public readonly details?: unknown
  ) {
    super(code);
    this.name = "KycServiceError";
  }
}

function hasPermission(permissions: string[], permission: string) {
  return permissions.includes(permission) || permissions.includes(ADMIN_PERMISSION);
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export interface KycServiceOptions {
  storage?: ObjectStorage;
}

export interface KycActor {
  staffId: string;
  permissions: string[];
}

export class KycService {
  private readonly storage: ObjectStorage;

  constructor(options: KycServiceOptions = {}) {
    this.storage = options.storage ?? getObjectStorage();
  }

  async startCase(retailerId: string, staffId: string, permissions: string[]) {
    await this.assertSubmitAccess(retailerId, staffId, permissions);
    const retailer = await prisma.retailer.findUnique({ where: { id: retailerId } });
    if (!retailer) throw new KycServiceError("retailer_not_found", 404);
    const result = await prisma.kycCase.upsert({
      where: { retailerId },
      update: {},
      create: { retailerId, status: KycCaseStatus.draft },
      include: { documents: { include: { asset: true }, orderBy: { createdAt: "asc" } } },
    });
    return this.publicCase(result);
  }

  async listPending(permissions: string[]) {
    if (!hasPermission(permissions, VIEW_PERMISSION) && !hasPermission(permissions, REVIEW_PERMISSION)) {
      throw new KycServiceError("permission_required", 403, { permission: VIEW_PERMISSION });
    }
    const cases = await prisma.kycCase.findMany({
      where: { status: { in: [KycCaseStatus.submitted, KycCaseStatus.in_review] } },
      orderBy: { submittedAt: "asc" },
      include: { retailer: { select: { id: true, name: true, phone: true, status: true } }, documents: { include: { asset: true }, orderBy: { createdAt: "asc" } } },
    });
    return Promise.all(cases.map((item) => this.publicCase(item)));
  }

  async detail(caseId: string, staffId: string, permissions: string[]) {
    const kycCase = await prisma.kycCase.findUnique({
      where: { id: caseId },
      include: { retailer: true, documents: { include: { asset: true }, orderBy: { createdAt: "asc" } }, reviews: { orderBy: { createdAt: "desc" } } },
    });
    if (!kycCase) throw new KycServiceError("kyc_case_not_found", 404);
    if (!hasPermission(permissions, VIEW_PERMISSION) && !hasPermission(permissions, REVIEW_PERMISSION)) {
      await this.assertSubmitAccess(kycCase.retailerId, staffId, permissions);
    }
    return this.publicCase(kycCase);
  }

  async uploadDocument(caseId: string, input: KycActor & {
    type: KycDocumentType;
    contentType: string;
    bodyBase64: string;
    checksum?: string;
  }) {
    const kycCase = await this.caseForSubmit(caseId, input.staffId, input.permissions);
    if (!( [KycCaseStatus.draft, KycCaseStatus.rejected] as KycCaseStatus[]).includes(kycCase.status)) {
      throw new KycServiceError("invalid_transition", 409, { status: kycCase.status });
    }
    const body = decodeBody(input.bodyBase64);
    const stored = await this.storage.put({
      purpose: EvidencePurpose.kyc_document,
      contentType: input.contentType,
      body,
      checksum: input.checksum,
    });
    return prisma.$transaction(async (tx) => {
      const asset = await tx.evidenceAsset.create({
        data: {
          objectKey: stored.objectKey,
          checksum: stored.checksum,
          contentType: stored.contentType,
          sizeBytes: stored.sizeBytes,
          purpose: EvidencePurpose.kyc_document,
          createdByStaffId: input.staffId,
        },
      });
      const document = await tx.kycDocument.create({
        data: {
          caseId,
          type: input.type,
          assetId: asset.id,
          status: KycDocumentStatus.uploaded,
          uploadedByStaffId: input.staffId,
        },
        include: { asset: true },
      });
      await tx.kycCase.update({ where: { id: caseId }, data: { status: KycCaseStatus.draft, rejectionReason: null } });
      return this.publicDocument(document);
    });
  }

  async submit(caseId: string, actor: KycActor) {
    const kycCase = await this.caseForSubmit(caseId, actor.staffId, actor.permissions);
    if (!( [KycCaseStatus.draft, KycCaseStatus.rejected] as KycCaseStatus[]).includes(kycCase.status)) {
      throw new KycServiceError("invalid_transition", 409, { status: kycCase.status });
    }
    const missing = REQUIRED_KYC_DOCUMENTS.filter((type) => {
      const latest = kycCase.documents.filter((document) => document.type === type).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      return !latest || latest.status === KycDocumentStatus.rejected;
    });
    if (missing.length > 0) throw new KycServiceError("required_documents_missing", 400, { missing });
    const submitted = await prisma.kycCase.update({ where: { id: caseId }, data: { status: KycCaseStatus.submitted, submittedAt: new Date(), rejectionReason: null }, include: { documents: { include: { asset: true } } } });
    return this.publicCase(submitted);
  }

  async review(caseId: string, input: KycActor & {
    decision: KycReviewDecision;
    reason: string;
    stepUpUntil?: Date;
  }) {
    if (!hasPermission(input.permissions, REVIEW_PERMISSION)) {
      throw new KycServiceError("permission_required", 403, { permission: REVIEW_PERMISSION });
    }
    if (!input.stepUpUntil || input.stepUpUntil.getTime() <= Date.now()) {
      throw new KycServiceError("step_up_required", 403);
    }
    const reason = input.reason.trim();
    if (reason.length < 5) throw new KycServiceError("review_reason_required", 400);
    return prisma.$transaction(async (tx) => {
      const current = await tx.kycCase.findUnique({ where: { id: caseId } });
      if (!current) throw new KycServiceError("kyc_case_not_found", 404);
      if (!( [KycCaseStatus.submitted, KycCaseStatus.in_review] as KycCaseStatus[]).includes(current.status)) {
        throw new KycServiceError("invalid_transition", 409, { status: current.status });
      }
      const nextStatus = input.decision === KycReviewDecision.approved ? KycCaseStatus.approved : KycCaseStatus.rejected;
      const updated = await tx.kycCase.updateMany({
        where: { id: caseId, status: { in: [KycCaseStatus.submitted, KycCaseStatus.in_review] } },
        data: { status: nextStatus, reviewedAt: new Date(), reviewedByStaffId: input.staffId, rejectionReason: nextStatus === KycCaseStatus.rejected ? reason : null },
      });
      if (updated.count !== 1) throw new KycServiceError("invalid_transition", 409);
      await tx.kycReview.create({ data: { caseId, reviewerStaffId: input.staffId, decision: input.decision, reason } });
      await tx.retailer.update({ where: { id: current.retailerId }, data: { status: nextStatus === KycCaseStatus.approved ? RetailerLifecycle.active : RetailerLifecycle.pending_kyc } });
      if (nextStatus === KycCaseStatus.approved) {
        await tx.creditProfile.updateMany({ where: { retailerId: current.retailerId }, data: { kycVerifiedAt: new Date(), kycVerifiedByStaffId: input.staffId, kycEvidence: json({ caseId }) } });
      }
      await tx.auditEvent.create({ data: { actorStaffId: input.staffId, action: input.decision === KycReviewDecision.approved ? "kyc.approved" : "kyc.rejected", subjectType: "kyc_case", subjectId: caseId, metadata: json({ retailerId: current.retailerId, decision: input.decision, reason, stepUp: true }) } });
      const reviewed = await tx.kycCase.findUniqueOrThrow({ where: { id: caseId }, include: { retailer: true, documents: { include: { asset: true } }, reviews: { orderBy: { createdAt: "desc" } } } });
      return this.publicCase(reviewed);
    });
  }

  private async caseForSubmit(caseId: string, staffId: string, permissions: string[]) {
    const kycCase = await prisma.kycCase.findUnique({ where: { id: caseId }, include: { retailer: true, documents: { include: { asset: true } } } });
    if (!kycCase) throw new KycServiceError("kyc_case_not_found", 404);
    await this.assertSubmitAccess(kycCase.retailerId, staffId, permissions);
    return kycCase;
  }

  private async publicDocument<T extends { asset: { objectKey: string; checksum: string; contentType: string; sizeBytes: number } }>(document: T) {
    const { objectKey, ...asset } = document.asset;
    return { ...document, asset: { ...asset, signedUrl: await this.storage.signedReadUrl(objectKey, 300) } };
  }

  private async publicCase<T extends { documents: Array<{ asset: { objectKey: string; checksum: string; contentType: string; sizeBytes: number } }> }>(kycCase: T) {
    return { ...kycCase, documents: await Promise.all(kycCase.documents.map((document) => this.publicDocument(document))) };
  }

  private async assertSubmitAccess(retailerId: string, staffId: string, permissions: string[]) {
    if (!hasPermission(permissions, SUBMIT_PERMISSION)) throw new KycServiceError("permission_required", 403, { permission: SUBMIT_PERMISSION });
    if (hasPermission(permissions, ADMIN_PERMISSION)) return;
    const [retailer, staff] = await Promise.all([
      prisma.retailer.findUnique({ where: { id: retailerId }, select: { salesRepId: true } }),
      prisma.staffUser.findUnique({ where: { id: staffId }, select: { salesRepId: true } }),
    ]);
    if (!retailer) throw new KycServiceError("retailer_not_found", 404);
    if (!staff?.salesRepId || staff.salesRepId !== retailer.salesRepId) throw new KycServiceError("retailer_not_assigned", 403);
  }
}

function decodeBody(value: string) {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 === 1) throw new KycServiceError("invalid_evidence_body", 400);
  const body = Buffer.from(value, "base64");
  if (body.length === 0) throw new KycServiceError("invalid_evidence_body", 400);
  return body;
}
