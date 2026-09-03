import { EvidencePurpose, Prisma, RetailerProposalStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { getObjectStorage } from "../../platform/storage/storageRuntime";
import type { ObjectStorage } from "../../platform/storage/objectStorage";
import { nextQuarterlyCheckpoint } from "../credit/reviewSchedule";
import { Permissions } from "../identity/roleCatalog";
import { listRetailerMasters } from "./retailerMasters";
import {
  mapFormToProposalWrite,
  mapFormToRetailerWrite,
  parseRetailerForm,
  publicRetailerProfile,
  type RetailerFormValues,
} from "./retailerFormSchema";

const ADMIN_PERMISSION = Permissions.STAFF_MANAGE;
const PROPOSE_PERMISSION = Permissions.RETAILER_PROPOSE;
const REVIEW_PERMISSION = Permissions.RETAILER_REVIEW;

export class RetailerFormError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 409,
    public readonly details?: unknown
  ) {
    super(code);
    this.name = "RetailerFormError";
  }
}

function hasPermission(permissions: string[], permission: string) {
  return permissions.includes(permission) || permissions.includes(ADMIN_PERMISSION);
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function decodeBody(value: string) {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 === 1) {
    throw new RetailerFormError("invalid_evidence_body", 400);
  }
  const body = Buffer.from(value, "base64");
  if (body.length === 0) throw new RetailerFormError("invalid_evidence_body", 400);
  return body;
}

const proposalInclude = {
  group: { select: { id: true, name: true } },
  transporter: { select: { id: true, name: true } },
  beat: { select: { id: true, name: true } },
  buyerCategory: { select: { id: true, name: true } },
  buyerSubCategory: { select: { id: true, name: true } },
  salesman: { select: { id: true, name: true, phone: true } },
  aadhaarPhoto: { select: { id: true, contentType: true, sizeBytes: true, checksum: true, objectKey: true } },
  retailer: { select: { id: true, name: true, phone: true, status: true } },
} satisfies Prisma.RetailerProposalInclude;

export interface RetailerFormActor {
  staffId: string;
  permissions: string[];
}

export class RetailerFormService {
  private readonly storage: ObjectStorage;

  constructor(options: { storage?: ObjectStorage } = {}) {
    this.storage = options.storage ?? getObjectStorage();
  }

  async masters() {
    return listRetailerMasters();
  }

  async uploadAadhaar(actor: RetailerFormActor, input: { contentType: string; bodyBase64: string; checksum?: string }) {
    this.assertPropose(actor.permissions);
    const body = decodeBody(input.bodyBase64);
    const stored = await this.storage.put({
      purpose: "aadhaar_card",
      contentType: input.contentType,
      body,
      checksum: input.checksum,
    });
    const asset = await prisma.evidenceAsset.create({
      data: {
        objectKey: stored.objectKey,
        checksum: stored.checksum,
        contentType: stored.contentType,
        sizeBytes: stored.sizeBytes,
        purpose: EvidencePurpose.aadhaar_card,
        createdByStaffId: actor.staffId,
      },
    });
    return this.publicAsset(asset);
  }

  async propose(actor: RetailerFormActor, input: unknown) {
    this.assertPropose(actor.permissions);
    const staff = await this.requireSalesRep(actor.staffId);
    const form = this.parseForm(input);
    await this.assertMasters(form);
    await this.assertAadhaarAsset(form.aadhaarPhotoAssetId, actor.staffId);
    const existing = await prisma.retailer.findUnique({ where: { phone: form.mobile } });
    if (existing) throw new RetailerFormError("mobile_already_registered", 409);
    const pending = await prisma.retailerProposal.findFirst({
      where: { mobile: form.mobile, status: RetailerProposalStatus.pending },
    });
    if (pending) throw new RetailerFormError("proposal_already_pending", 409);

    const created = await prisma.retailerProposal.create({
      data: {
        ...mapFormToProposalWrite(form),
        payload: json(form),
        proposedByStaffId: actor.staffId,
        proposedByRepId: staff.salesRepId,
        creditLimit: form.creditLimit,
      },
      include: proposalInclude,
    });
    await prisma.auditEvent.create({
      data: {
        actorStaffId: actor.staffId,
        action: "retailer_proposal.submitted",
        subjectType: "retailer_proposal",
        subjectId: created.id,
        metadata: json({ mobile: form.mobile, partyName: form.partyName }),
      },
    });
    return this.publicProposal(created);
  }

  async listProposals(actor: RetailerFormActor) {
    const canReview = hasPermission(actor.permissions, REVIEW_PERMISSION);
    const staff = canReview ? null : await this.requireSalesRep(actor.staffId);
    const proposals = await prisma.retailerProposal.findMany({
      where: canReview
        ? { status: { in: [RetailerProposalStatus.pending] } }
        : { proposedByStaffId: actor.staffId, proposedByRepId: staff!.salesRepId },
      orderBy: { createdAt: "asc" },
      include: proposalInclude,
    });
    return Promise.all(proposals.map((item) => this.publicProposal(item)));
  }

  async detail(id: string, actor: RetailerFormActor) {
    const proposal = await prisma.retailerProposal.findUnique({ where: { id }, include: proposalInclude });
    if (!proposal) throw new RetailerFormError("proposal_not_found", 404);
    if (!hasPermission(actor.permissions, REVIEW_PERMISSION) && proposal.proposedByStaffId !== actor.staffId) {
      throw new RetailerFormError("proposal_not_found", 404);
    }
    return this.publicProposal(proposal);
  }

  async approve(id: string, actor: RetailerFormActor & { reason?: string; stepUpUntil?: Date }) {
    this.assertReview(actor);
    return prisma.$transaction(async (tx) => {
      const current = await tx.retailerProposal.findUnique({ where: { id }, include: proposalInclude });
      if (!current) throw new RetailerFormError("proposal_not_found", 404);
      if (current.status !== RetailerProposalStatus.pending) {
        throw new RetailerFormError("invalid_transition", 409, { status: current.status });
      }
      const form = this.parseForm(current.payload ?? mapProposalPayload(current));
      const existing = await tx.retailer.findUnique({ where: { phone: form.mobile } });
      if (existing) throw new RetailerFormError("mobile_already_registered", 409);
      const tier = await defaultTier(tx);
      const retailerWrite = mapFormToRetailerWrite(form);
      const retailer = await tx.retailer.create({
        data: {
          ...retailerWrite,
          tierId: tier.id,
          status: "pending_kyc",
          creditLimit: form.creditLimit,
          paymentTermDays: form.paymentTermDays,
          grade: form.grade,
        },
      });
      await tx.retailerLocation.create({
        data: { retailerId: retailer.id, status: "NOT_SET", source: "MIGRATION", locationVersion: 0 },
      });
      await tx.creditProfile.create({
        data: {
          retailerId: retailer.id,
          rating: "N",
          accountCreatedAt: retailer.createdAt,
          nextReviewAt: nextQuarterlyCheckpoint(retailer.createdAt),
        },
      });
      await tx.retailerContact.create({
        data: {
          retailerId: retailer.id,
          name: form.contactPerson,
          phone: form.mobile,
          role: "owner",
          isPrimary: true,
        },
      });
      const updated = await tx.retailerProposal.updateMany({
        where: { id, status: RetailerProposalStatus.pending },
        data: {
          status: RetailerProposalStatus.approved,
          retailerId: retailer.id,
          reviewedByStaffId: actor.staffId,
          reviewedAt: new Date(),
          rejectionReason: null,
        },
      });
      if (updated.count !== 1) throw new RetailerFormError("invalid_transition", 409);
      await tx.auditEvent.create({
        data: {
          actorStaffId: actor.staffId,
          action: "retailer_proposal.approved",
          subjectType: "retailer_proposal",
          subjectId: id,
          metadata: json({
            retailerId: retailer.id,
            creditLimit: form.creditLimit,
            paymentTermDays: form.paymentTermDays,
            grade: form.grade,
            reason: actor.reason ?? null,
            stepUp: true,
          }),
        },
      });
      const reviewed = await tx.retailerProposal.findUniqueOrThrow({ where: { id }, include: proposalInclude });
      return this.publicProposal(reviewed);
    });
  }

  async reject(id: string, actor: RetailerFormActor & { reason: string; stepUpUntil?: Date }) {
    this.assertReview(actor);
    const reason = actor.reason.trim();
    if (reason.length < 5) throw new RetailerFormError("review_reason_required", 400);
    return prisma.$transaction(async (tx) => {
      const current = await tx.retailerProposal.findUnique({ where: { id } });
      if (!current) throw new RetailerFormError("proposal_not_found", 404);
      if (current.status !== RetailerProposalStatus.pending) {
        throw new RetailerFormError("invalid_transition", 409, { status: current.status });
      }
      const updated = await tx.retailerProposal.updateMany({
        where: { id, status: RetailerProposalStatus.pending },
        data: {
          status: RetailerProposalStatus.rejected,
          reviewedByStaffId: actor.staffId,
          reviewedAt: new Date(),
          rejectionReason: reason,
        },
      });
      if (updated.count !== 1) throw new RetailerFormError("invalid_transition", 409);
      await tx.auditEvent.create({
        data: {
          actorStaffId: actor.staffId,
          action: "retailer_proposal.rejected",
          subjectType: "retailer_proposal",
          subjectId: id,
          metadata: json({ reason, stepUp: true }),
        },
      });
      const reviewed = await tx.retailerProposal.findUniqueOrThrow({ where: { id }, include: proposalInclude });
      return this.publicProposal(reviewed);
    });
  }

  async updateAssigned(retailerId: string, actor: RetailerFormActor, input: unknown) {
    this.assertPropose(actor.permissions);
    const staff = await this.requireSalesRep(actor.staffId);
    const retailer = await prisma.retailer.findFirst({
      where: { id: retailerId, salesRepId: staff.salesRepId },
    });
    if (!retailer) throw new RetailerFormError("retailer_not_found", 404);
    const form = this.parseForm(input);
    if (form.salesmanRepId !== staff.salesRepId) {
      throw new RetailerFormError("salesman_locked", 400);
    }
    await this.assertMasters(form);
    await this.assertAadhaarAsset(form.aadhaarPhotoAssetId, actor.staffId);
    if (form.mobile !== retailer.phone) {
      const clash = await prisma.retailer.findUnique({ where: { phone: form.mobile } });
      if (clash) throw new RetailerFormError("mobile_already_registered", 409);
    }
    const write = mapFormToRetailerWrite(form);
    const updated = await prisma.retailer.update({
      where: { id: retailer.id },
      data: {
        ...write,
        creditLimit: form.creditLimit,
        paymentTermDays: form.paymentTermDays,
        grade: form.grade,
      },
      include: profileInclude,
    });
    const primary = await prisma.retailerContact.findFirst({
      where: { retailerId: retailer.id, isPrimary: true },
    });
    if (primary) {
      await prisma.retailerContact.update({
        where: { id: primary.id },
        data: { name: form.contactPerson, phone: form.mobile },
      });
    } else {
      await prisma.retailerContact.create({
        data: { retailerId: retailer.id, name: form.contactPerson, phone: form.mobile, role: "owner", isPrimary: true },
      });
    }
    await prisma.auditEvent.create({
      data: {
        actorStaffId: actor.staffId,
        action: "retailer.profile_updated",
        subjectType: "retailer",
        subjectId: retailer.id,
        metadata: json({ creditLimit: form.creditLimit, paymentTermDays: form.paymentTermDays, grade: form.grade }),
      },
    });
    return publicRetailerProfile(updated);
  }

  private parseForm(input: unknown): RetailerFormValues {
    const parsed = parseRetailerForm(input);
    if (!parsed.success) {
      throw new RetailerFormError("invalid_input", 400, parsed.error.flatten());
    }
    return parsed.data;
  }

  private async assertMasters(form: RetailerFormValues) {
    const [group, transporter, salesman, category] = await Promise.all([
      prisma.retailerGroup.findFirst({ where: { id: form.groupId, active: true } }),
      prisma.transporter.findFirst({ where: { id: form.transporterId, active: true } }),
      prisma.salesRep.findUnique({ where: { id: form.salesmanRepId } }),
      prisma.buyerCategory.findFirst({ where: { id: form.buyerCategoryId, active: true } }),
    ]);
    if (!group) throw new RetailerFormError("unknown_group", 400);
    if (!transporter) throw new RetailerFormError("unknown_transporter", 400);
    if (!salesman) throw new RetailerFormError("unknown_salesman", 400);
    if (!category) throw new RetailerFormError("unknown_buyer_category", 400);
    if (form.beatId) {
      const beat = await prisma.beat.findFirst({ where: { id: form.beatId, active: true } });
      if (!beat) throw new RetailerFormError("unknown_beat", 400);
    }
    if (form.buyerSubCategoryId) {
      const sub = await prisma.buyerSubCategory.findFirst({
        where: { id: form.buyerSubCategoryId, categoryId: form.buyerCategoryId, active: true },
      });
      if (!sub) throw new RetailerFormError("unknown_buyer_sub_category", 400);
    }
  }

  private async assertAadhaarAsset(assetId: string, staffId: string) {
    const asset = await prisma.evidenceAsset.findFirst({
      where: { id: assetId, purpose: EvidencePurpose.aadhaar_card, deletedAt: null },
    });
    if (!asset) throw new RetailerFormError("aadhaar_photo_required", 400);
    if (asset.createdByStaffId && asset.createdByStaffId !== staffId) {
      throw new RetailerFormError("aadhaar_photo_required", 400);
    }
    return asset;
  }

  private async requireSalesRep(staffId: string) {
    const staff = await prisma.staffUser.findUnique({
      where: { id: staffId },
      select: { id: true, salesRepId: true },
    });
    if (!staff?.salesRepId) throw new RetailerFormError("salesperson_required", 403);
    return { staffId: staff.id, salesRepId: staff.salesRepId };
  }

  private assertPropose(permissions: string[]) {
    if (!hasPermission(permissions, PROPOSE_PERMISSION) && !permissions.includes(Permissions.ORDER_CREATE_FOR_RETAILER)) {
      throw new RetailerFormError("permission_required", 403, { permission: PROPOSE_PERMISSION });
    }
  }

  private assertReview(actor: RetailerFormActor & { stepUpUntil?: Date }) {
    if (!hasPermission(actor.permissions, REVIEW_PERMISSION)) {
      throw new RetailerFormError("permission_required", 403, { permission: REVIEW_PERMISSION });
    }
    if (!actor.stepUpUntil || actor.stepUpUntil.getTime() <= Date.now()) {
      throw new RetailerFormError("step_up_required", 403);
    }
  }

  private async publicAsset(asset: { id: string; objectKey: string; contentType: string; sizeBytes: number; checksum: string }) {
    const { objectKey, ...rest } = asset;
    return { ...rest, signedUrl: await this.storage.signedReadUrl(objectKey, 300) };
  }

  private async publicProposal(proposal: Prisma.RetailerProposalGetPayload<{ include: typeof proposalInclude }>) {
    const { aadhaarPhoto, ...rest } = proposal;
    return {
      ...rest,
      creditLimit: Number(proposal.creditLimit),
      aadhaarPhoto: aadhaarPhoto ? await this.publicAsset(aadhaarPhoto) : null,
    };
  }
}

const profileInclude = {
  group: { select: { id: true, name: true } },
  transporter: { select: { id: true, name: true } },
  beat: { select: { id: true, name: true } },
  buyerCategory: { select: { id: true, name: true } },
  buyerSubCategory: { select: { id: true, name: true } },
  salesRep: { select: { id: true, name: true } },
} satisfies Prisma.RetailerInclude;

async function defaultTier(tx: Prisma.TransactionClient) {
  const silver = await tx.tier.findFirst({ where: { name: "Silver" } });
  if (silver) return silver;
  const any = await tx.tier.findFirst({ orderBy: { createdAt: "asc" } });
  if (!any) throw new RetailerFormError("tier_missing", 500);
  return any;
}

function mapProposalPayload(proposal: {
  partyName: string;
  groupId: string;
  contactPerson: string;
  mobile: string;
  telephone: string | null;
  transporterId: string;
  address1: string;
  pin: string | null;
  tehsil: string | null;
  district: string | null;
  state: string | null;
  deliveryCity: string;
  salesmanRepId: string;
  beatId: string | null;
  shopTenureYears: number;
  gstin: string | null;
  aadhaarNumber: string;
  aadhaarPhotoAssetId: string;
  paymentTermDays: number;
  creditLimit: Prisma.Decimal | number;
  grade: string;
  buyerCategoryId: string;
  buyerSubCategoryId: string | null;
  upiId: string | null;
}) {
  return {
    partyName: proposal.partyName,
    groupId: proposal.groupId,
    contactPerson: proposal.contactPerson,
    mobile: proposal.mobile,
    telephone: proposal.telephone ?? undefined,
    transporterId: proposal.transporterId,
    address1: proposal.address1,
    pin: proposal.pin ?? undefined,
    tehsil: proposal.tehsil ?? undefined,
    district: proposal.district ?? undefined,
    state: proposal.state ?? undefined,
    deliveryCity: proposal.deliveryCity,
    salesmanRepId: proposal.salesmanRepId,
    beatId: proposal.beatId ?? undefined,
    shopTenureYears: proposal.shopTenureYears,
    gstin: proposal.gstin ?? undefined,
    aadhaarNumber: proposal.aadhaarNumber,
    aadhaarPhotoAssetId: proposal.aadhaarPhotoAssetId,
    paymentTermDays: proposal.paymentTermDays,
    creditLimit: Number(proposal.creditLimit),
    grade: proposal.grade,
    buyerCategoryId: proposal.buyerCategoryId,
    buyerSubCategoryId: proposal.buyerSubCategoryId ?? undefined,
    upiId: proposal.upiId ?? undefined,
  };
}

export { mapFormToRetailerWrite, mapFormToProposalWrite };
