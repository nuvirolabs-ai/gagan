import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { getObjectStorage } from "../../platform/storage/storageRuntime";
import type { ObjectStorage } from "../../platform/storage/objectStorage";
import { EvidencePurpose } from "@prisma/client";
import { isWithinScope } from "../field/fieldDomain";
import { normalizeIndianPhone } from "../identity/otpService";
import { encryptPii, maskAadhaar } from "../../platform/security/pii";

type Db = PrismaClient | any;

export class ProposalError extends Error {
  constructor(readonly code: string, readonly status = 409, readonly details?: unknown) {
    super(code);
    this.name = "ProposalError";
  }
}

export interface SubmitProposalInput {
  submittedByStaffId: string;
  businessName: string;
  groupName: string;
  ownerName: string;
  phone: string;
  telephone?: string;
  transporter: string;
  shopAddress: string;
  pinCode?: string;
  tehsil?: string;
  district?: string;
  state?: string;
  deliveryCity: string;
  shopDurationYears: number;
  gstin?: string;
  aadhaarNumber: string;
  aadhaarPhoto: {
    contentType: string;
    bodyBase64: string;
    checksum?: string;
  };
  paymentTerms: string;
  upiId?: string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  proposedTierId?: string;
  notes?: string;
}

function clean(value: string | undefined) {
  return value?.trim() || null;
}

function validateAadhaar(value: string) {
  const normalized = value.replace(/[\s-]/g, "");
  if (!/^\d{12}$/.test(normalized)) throw new ProposalError("aadhaar_invalid", 400);
  return normalized;
}

const INDIAN_PIN_RE = /^\d{6}$/;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const UPI_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{1,255}@[A-Za-z][A-Za-z0-9.-]{1,63}$/;

function optionalValue(value: string | undefined, pattern: RegExp, code: string) {
  const normalized = clean(value);
  if (normalized && !pattern.test(normalized)) throw new ProposalError(code, 400);
  return normalized;
}

function decodePhoto(bodyBase64: string) {
  const body = Buffer.from(bodyBase64, "base64");
  if (!body.length) throw new ProposalError("aadhaar_photo_required", 400);
  return body;
}

function publicProposal(proposal: any, photoUrl?: string | null) {
  const {
    aadhaarEncrypted: _encrypted,
    aadhaarLast4,
    aadhaarPhotoAsset,
    aadhaarPhotoAssetId: _photoAssetId,
    ...safe
  } = proposal;
  return {
    ...safe,
    aadhaarNumberMasked: maskAadhaar(aadhaarLast4),
    aadhaarPhoto: aadhaarPhotoAsset
      ? {
          available: !aadhaarPhotoAsset.deletedAt,
          contentType: aadhaarPhotoAsset.contentType,
          sizeBytes: aadhaarPhotoAsset.sizeBytes,
          ...(photoUrl ? { signedUrl: photoUrl } : {}),
        }
      : null,
  };
}

/**
 * Adding a store to the customer master, proposed from the field.
 *
 * There is no second customer model: a proposal is a governance record that,
 * once approved, creates exactly one canonical `Retailer` and points at it. A
 * salesperson can put a store forward; only a reviewer can admit it, and the
 * store still enters the lifecycle at `pending_kyc` so approval never
 * shortcuts the KYC gate that dispatch and credit depend on.
 */
export class RetailerProposalService {
  constructor(
    private readonly prisma: Db = defaultPrisma,
    private readonly storage?: ObjectStorage
  ) {}

  private objectStorage() {
    return this.storage ?? getObjectStorage();
  }

  async submit(input: SubmitProposalInput) {
    const businessName = input.businessName.trim();
    const groupName = input.groupName.trim();
    const ownerName = input.ownerName.trim();
    const shopAddress = input.shopAddress.trim();
    if (businessName.length < 2) throw new ProposalError("business_name_required", 400);
    if (groupName.length < 2) throw new ProposalError("group_name_required", 400);
    if (ownerName.length < 2) throw new ProposalError("contact_person_required", 400);
    if (shopAddress.length < 4) throw new ProposalError("shop_address_required", 400);
    if (!input.transporter.trim()) throw new ProposalError("transporter_required", 400);
    if (!input.deliveryCity.trim()) throw new ProposalError("delivery_city_required", 400);
    if (!Number.isInteger(input.shopDurationYears) || input.shopDurationYears < 0 || input.shopDurationYears > 200) {
      throw new ProposalError("shop_duration_invalid", 400);
    }
    if (!input.paymentTerms.trim()) throw new ProposalError("payment_terms_required", 400);
    const pinCode = optionalValue(input.pinCode, INDIAN_PIN_RE, "pin_code_invalid");
    const gstin = clean(input.gstin)?.toUpperCase() ?? null;
    if (gstin && !GSTIN_RE.test(gstin)) throw new ProposalError("gstin_invalid", 400);
    const upiId = optionalValue(input.upiId, UPI_ID_RE, "upi_id_invalid");
    const aadhaar = validateAadhaar(input.aadhaarNumber);
    if (!input.aadhaarPhoto?.contentType?.startsWith("image/")) {
      throw new ProposalError("aadhaar_photo_required", 400);
    }

    // `normalizeIndianPhone` validates and returns the +91 form; the customer
    // master stores the bare national number, so the proposal is kept in the
    // shape the Retailer row will actually use.
    let phone: string;
    let internationalPhone: string;
    try {
      internationalPhone = normalizeIndianPhone(input.phone);
      phone = internationalPhone.replace(/^\+91/, "");
    } catch {
      throw new ProposalError("phone_invalid", 400);
    }

    const staff = await this.prisma.staffUser.findUnique({
      where: { id: input.submittedByStaffId },
      select: { status: true, salesRepId: true },
    });
    if (!staff || staff.status !== "active" || !staff.salesRepId) {
      throw new ProposalError("salesperson_not_available", 403);
    }

    // The customer master keys on phone, so a store already on it cannot be
    // proposed again — the salesperson is told to ask for the assignment
    // instead of creating a duplicate customer.
    const [existingRetailer, existingProposal] = await Promise.all([
      this.prisma.retailer.findFirst({
        where: { phone: { in: [phone, internationalPhone, `91${phone}`] } },
        select: { id: true, name: true },
      }),
      this.prisma.retailerProposal.findFirst({
        where: { phone, status: "pending" },
        select: { id: true },
      }),
    ]);
    if (existingRetailer) {
      throw new ProposalError("retailer_already_exists", 409, { retailerName: existingRetailer.name });
    }
    if (existingProposal) throw new ProposalError("proposal_already_pending", 409);

    const storage = this.objectStorage();
    const stored = await storage.put({
      purpose: EvidencePurpose.retailer_proposal_aadhaar,
      contentType: input.aadhaarPhoto.contentType,
      body: decodePhoto(input.aadhaarPhoto.bodyBase64),
      checksum: input.aadhaarPhoto.checksum,
    });
    try {
      const proposal = await this.prisma.$transaction(async (tx: Db) => {
        const asset = await tx.evidenceAsset.create({
          data: {
            objectKey: stored.objectKey,
            checksum: stored.checksum,
            contentType: stored.contentType,
            sizeBytes: stored.sizeBytes,
            purpose: EvidencePurpose.retailer_proposal_aadhaar,
            createdByStaffId: input.submittedByStaffId,
          },
        });
        return tx.retailerProposal.create({
          data: {
            businessName,
            groupName,
            ownerName,
            phone,
            telephone: clean(input.telephone),
            transporter: input.transporter.trim(),
            shopAddress,
            pinCode,
            tehsil: clean(input.tehsil),
            district: clean(input.district),
            state: clean(input.state),
            deliveryCity: input.deliveryCity.trim(),
            shopDurationYears: input.shopDurationYears,
            gstin,
            aadhaarEncrypted: encryptPii(aadhaar),
            aadhaarLast4: aadhaar.slice(-4),
            aadhaarPhotoAssetId: asset.id,
            paymentTerms: input.paymentTerms.trim(),
            upiId,
            latitude: input.latitude ?? null,
            longitude: input.longitude ?? null,
            accuracyMeters: input.accuracyMeters ?? null,
            proposedTierId: input.proposedTierId ?? null,
            notes: clean(input.notes),
            submittedByStaffId: input.submittedByStaffId,
          },
        });
      });
      return publicProposal(proposal);
    } catch (error) {
      await storage.delete(stored.objectKey).catch(() => undefined);
      throw error;
    }
  }

  async listForSalesperson(salespersonId: string) {
    const proposals = await this.prisma.retailerProposal.findMany({
      where: { submittedByStaffId: salespersonId },
      include: { proposedTier: { select: { id: true, name: true } }, aadhaarPhotoAsset: true },
      orderBy: { submittedAt: "desc" },
      take: 100,
    });
    return proposals.map((proposal: any) => publicProposal(proposal));
  }

  /**
   * The reviewer's queue.
   *
   * Scope routes a proposal to the manager above whoever submitted it, but it
   * does not change who is *allowed* to admit a store to the customer master —
   * an org-wide reviewer (the existing admin approval policy) still sees every
   * proposal, because `scopeStaffIds` is null for them. Routing and policy stay
   * separate concerns.
   */
  async listForReview(filters: { status?: string; scopeStaffIds?: string[] | null } = {}) {
    const proposals = await this.prisma.retailerProposal.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.scopeStaffIds ? { submittedByStaffId: { in: filters.scopeStaffIds } } : {}),
      },
      include: {
        submittedBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
        proposedTier: { select: { id: true, name: true } },
        aadhaarPhotoAsset: true,
      },
      orderBy: [{ status: "asc" }, { submittedAt: "desc" }],
      take: 200,
    });
    return Promise.all(
      proposals.map(async (proposal: any) => {
        let photoUrl: string | null = null;
        if (proposal.aadhaarPhotoAsset && !proposal.aadhaarPhotoAsset.deletedAt) {
          // A storage outage must not turn the whole review queue into a 500.
          // The proposal remains reviewable with masked identity data and an
          // explicit unavailable-photo state; the object is never made public.
          try {
            photoUrl = await this.objectStorage().signedReadUrl(proposal.aadhaarPhotoAsset.objectKey, 300);
          } catch {
            photoUrl = null;
          }
        }
        return publicProposal(proposal, photoUrl);
      })
    );
  }

  async withdraw(input: { proposalId: string; salespersonId: string }) {
    const proposal = await this.prisma.retailerProposal.findUnique({
      where: { id: input.proposalId },
    });
    if (!proposal || proposal.submittedByStaffId !== input.salespersonId) {
      throw new ProposalError("proposal_not_found", 404);
    }
    if (proposal.status !== "pending") throw new ProposalError("proposal_already_decided", 409);
    return this.prisma.retailerProposal.update({
      where: { id: proposal.id },
      data: { status: "withdrawn" },
    });
  }

  /**
   * Admits the store to the customer master.
   *
   * The reviewer chooses the tier that is actually applied; the salesperson's
   * suggestion is only a suggestion. The new customer is assigned to the
   * salesperson who proposed it, which is also what makes it count towards
   * their new-store target.
   */
  async approve(input: {
    proposalId: string;
    reviewerStaffId: string;
    tierId?: string;
    scopeStaffIds?: string[] | null;
  }) {
    const proposal = await this.prisma.retailerProposal.findUnique({
      where: { id: input.proposalId },
      include: { submittedBy: { select: { salesRepId: true } } },
    });
    if (!proposal) throw new ProposalError("proposal_not_found", 404);
    if (proposal.status !== "pending") throw new ProposalError("proposal_already_decided", 409);
    if (proposal.submittedByStaffId === input.reviewerStaffId) {
      throw new ProposalError("self_review_forbidden", 403);
    }
    if (!isWithinScope(proposal.submittedByStaffId, input.scopeStaffIds)) {
      throw new ProposalError("outside_reporting_scope", 403);
    }

    const tierId = input.tierId ?? proposal.proposedTierId;
    if (!tierId) throw new ProposalError("tier_required", 400);
    const tier = await this.prisma.tier.findUnique({ where: { id: tierId }, select: { id: true } });
    if (!tier) throw new ProposalError("tier_not_found", 404);

    const duplicate = await this.prisma.retailer.findFirst({
      where: { phone: proposal.phone },
      select: { id: true },
    });
    if (duplicate) throw new ProposalError("retailer_already_exists", 409);

    return this.prisma.$transaction(async (tx: Db) => {
      const retailer = await tx.retailer.create({
        data: {
          name: proposal.businessName,
          shopAddress: proposal.shopAddress,
          phone: proposal.phone,
          tierId,
          // Approval admits the store to the master; KYC still gates credit
          // and dispatch, so the lifecycle starts where every store starts.
          status: "pending_kyc",
          creditLimit: 0,
          currentBalance: 0,
          overdueAmount: 0,
          salesRepId: proposal.submittedBy?.salesRepId ?? null,
        },
      });

      // A coordinate taken at the storefront is captured, not verified: the
      // location module verifies on a second reading taken at the store.
      await tx.retailerLocation.create({
        data:
          proposal.latitude != null && proposal.longitude != null
            ? {
                retailerId: retailer.id,
                latitude: proposal.latitude,
                longitude: proposal.longitude,
                accuracyMeters: proposal.accuracyMeters,
                status: "CAPTURED",
                source: "SALESPERSON_VISIT",
                capturedAt: proposal.submittedAt,
                capturedByUserId: proposal.submittedByStaffId,
                locationVersion: 1,
              }
            : { retailerId: retailer.id },
      });

      const updated = await tx.retailerProposal.update({
        where: { id: proposal.id },
        data: {
          status: "approved",
          reviewedByStaffId: input.reviewerStaffId,
          reviewedAt: new Date(),
          retailerId: retailer.id,
        },
      });

      await tx.auditEvent.create({
        data: {
          actorStaffId: input.reviewerStaffId,
          action: "retailer_proposal.approved",
          subjectType: "retailer_proposal",
          subjectId: proposal.id,
          metadata: { retailerId: retailer.id, submittedBy: proposal.submittedByStaffId },
        },
      });

      return { proposal: updated, retailer };
    });
  }

  async reject(input: {
    proposalId: string;
    reviewerStaffId: string;
    reason: string;
    scopeStaffIds?: string[] | null;
  }) {
    const reason = input.reason?.trim() ?? "";
    if (reason.length < 3) throw new ProposalError("rejection_reason_required", 400);

    const proposal = await this.prisma.retailerProposal.findUnique({
      where: { id: input.proposalId },
    });
    if (!proposal) throw new ProposalError("proposal_not_found", 404);
    if (proposal.status !== "pending") throw new ProposalError("proposal_already_decided", 409);
    if (proposal.submittedByStaffId === input.reviewerStaffId) {
      throw new ProposalError("self_review_forbidden", 403);
    }
    if (!isWithinScope(proposal.submittedByStaffId, input.scopeStaffIds)) {
      throw new ProposalError("outside_reporting_scope", 403);
    }

    return this.prisma.$transaction(async (tx: Db) => {
      const updated = await tx.retailerProposal.update({
        where: { id: proposal.id },
        data: {
          status: "rejected",
          reviewedByStaffId: input.reviewerStaffId,
          reviewedAt: new Date(),
          rejectionReason: reason,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorStaffId: input.reviewerStaffId,
          action: "retailer_proposal.rejected",
          subjectType: "retailer_proposal",
          subjectId: proposal.id,
          metadata: { reason },
        },
      });
      return updated;
    });
  }
}

export const defaultRetailerProposalService = new RetailerProposalService();
