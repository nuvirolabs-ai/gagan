import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { calculateRatingProposal } from "./ratingLifecycle";
import { nextQuarterlyCheckpoint, shouldAdvanceMissedCheckpoint } from "./reviewSchedule";

export class RatingServiceError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function daysBetween(earlier: Date, later: Date) {
  return Math.max(0, Math.floor((later.getTime() - earlier.getTime()) / 86_400_000));
}

export function netAllocationAmount(allocation: {
  amount: number | string | Prisma.Decimal;
  reversals: Array<{ amount: number | string | Prisma.Decimal }>;
}) {
  return Math.max(
    0,
    Number(allocation.amount) -
      allocation.reversals.reduce((sum, reversal) => sum + Number(reversal.amount), 0)
  );
}

export class RatingService {
  async listKycPending() {
    return prisma.creditProfile.findMany({
      where: { kycVerifiedAt: null },
      include: { retailer: { select: { id: true, name: true, phone: true, shopAddress: true } } },
      orderBy: { accountCreatedAt: "asc" },
      take: 500,
    });
  }

  async confirmKyc(
    retailerId: string,
    input: { actorStaffId: string; evidenceReference: string; reason: string; now?: Date }
  ) {
    const now = input.now ?? new Date();
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "Retailer" WHERE "id" = ${retailerId} FOR UPDATE`;
      const profile = await tx.creditProfile.findUnique({ where: { retailerId } });
      if (!profile) throw new RatingServiceError("credit_profile_not_found", 404);
      if (profile.kycVerifiedAt) throw new RatingServiceError("kyc_already_verified", 409);
      const updated = await tx.creditProfile.update({
        where: { retailerId },
        data: {
          kycVerifiedAt: now,
          kycVerifiedByStaffId: input.actorStaffId,
          kycEvidence: json({ reference: input.evidenceReference.trim(), confirmedReason: input.reason.trim() }),
          nextReviewAt: profile.nextReviewAt ?? nextQuarterlyCheckpoint(profile.accountCreatedAt),
        },
      });
      // The legacy evidence-confirmation path is still supported while KYC
      // cases are migrated. Mark the retailer active at the same commit so
      // dispatch enforcement cannot observe a half-verified account.
      await tx.retailer.update({ where: { id: retailerId }, data: { status: "active" } });
      await tx.auditEvent.create({
        data: {
          actorStaffId: input.actorStaffId,
          action: "credit_kyc.confirmed",
          subjectType: "credit_profile",
          subjectId: profile.id,
          metadata: json({
            retailerId,
            evidenceReference: input.evidenceReference.trim(),
            reason: input.reason.trim(),
          }),
        },
      });
      return updated;
    });
  }

  async list() {
    return prisma.ratingProposal.findMany({
      where: { status: "pending" },
      include: {
        creditProfile: { include: { retailer: { select: { id: true, name: true, phone: true } } } },
        policyVersion: { select: { version: true, name: true } },
      },
      orderBy: { proposedAt: "asc" },
    });
  }

  async generate(now = new Date()) {
    const policy = await prisma.creditPolicyVersion.findFirst({ where: { active: true }, orderBy: { version: "desc" } });
    if (!policy) throw new RatingServiceError("credit_policy_unavailable", 503);
    const profiles = await prisma.creditProfile.findMany({
      include: {
        retailer: {
          include: {
            invoices: {
              where: { status: { not: "voided" } },
              include: {
                allocations: {
                  include: { reversals: true },
                  orderBy: { createdAt: "asc" },
                },
              },
              orderBy: { invoiceDate: "asc" },
            },
          },
        },
      },
    });
    let created = 0;
    for (const profile of profiles) {
      const invoices = profile.retailer.invoices.map((invoice) => {
        const netAllocations = invoice.allocations.map((allocation) => ({
          createdAt: allocation.createdAt,
          amount: netAllocationAmount(allocation),
        }));
        const effectiveAllocations = netAllocations.filter((allocation) => allocation.amount > 0);
        const allocated = effectiveAllocations.reduce((sum, allocation) => sum + allocation.amount, 0);
        const fullyPaid = allocated >= Number(invoice.total);
        const completion = fullyPaid
          ? effectiveAllocations.at(-1)?.createdAt ?? invoice.updatedAt
          : now;
        return {
          daysToPay: daysBetween(invoice.invoiceDate, completion),
          fullyPaid,
          hadPartialPayment:
            effectiveAllocations.length > 1 ||
            (effectiveAllocations.length === 1 && effectiveAllocations[0].amount < Number(invoice.total)),
        };
      });
      const proposal = calculateRatingProposal({
        currentRating: profile.rating,
        billingPattern: profile.billingPattern,
        accountAgeDays: daysBetween(profile.accountCreatedAt, now),
        invoices,
        checkpointDue: profile.nextReviewAt != null && profile.nextReviewAt <= now,
        hasOutstanding: profile.retailer.invoices.some(
          (invoice) => Number(invoice.outstandingAmount) > 0
        ),
      });
      const advanceMissedCheckpoint = shouldAdvanceMissedCheckpoint({
        nextReviewAt: profile.nextReviewAt,
        now,
        requiresConfirmation: proposal.requiresConfirmation,
        currentRating: profile.rating,
        proposedRating: proposal.proposedRating,
      });
      await prisma.creditProfile.update({
        where: { id: profile.id },
        data: {
          cleanInvoiceCount: proposal.cleanInvoiceCount,
          ...(advanceMissedCheckpoint ? { nextReviewAt: nextQuarterlyCheckpoint(now) } : {}),
        },
      });
      if (!proposal.requiresConfirmation || proposal.proposedRating === profile.rating) continue;
      const keyPeriod = proposal.trigger === "quarterly_checkpoint"
        ? profile.nextReviewAt?.toISOString().slice(0, 10) ?? "checkpoint"
        : proposal.trigger;
      const idempotencyKey = `${profile.id}:${keyPeriod}:${proposal.proposedRating}`;
      const result = await prisma.ratingProposal.upsert({
        where: { idempotencyKey },
        update: {},
        create: {
          creditProfileId: profile.id,
          policyVersionId: policy.id,
          previousRating: profile.rating,
          proposedRating: proposal.proposedRating,
          trigger: proposal.trigger,
          evidence: json({ ...proposal.evidence, cleanInvoiceCount: proposal.cleanInvoiceCount }),
          idempotencyKey,
          proposedAt: now,
        },
      });
      if (result.proposedAt.getTime() === now.getTime()) created++;
    }
    return { scanned: profiles.length, created };
  }

  async confirm(id: string, input: { actorStaffId: string; reason: string; now?: Date }) {
    const now = input.now ?? new Date();
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "RatingProposal" WHERE "id" = ${id} FOR UPDATE`;
      const proposal = await tx.ratingProposal.findUnique({
        where: { id },
        include: { creditProfile: true },
      });
      if (!proposal) throw new RatingServiceError("rating_proposal_not_found", 404);
      if (proposal.status !== "pending") throw new RatingServiceError("rating_proposal_closed", 409);
      const evidence = proposal.evidence as Record<string, unknown>;
      await tx.ratingHistory.create({
        data: {
          creditProfileId: proposal.creditProfileId,
          fromRating: proposal.previousRating,
          toRating: proposal.proposedRating,
          billingPattern: proposal.creditProfile.billingPattern,
          reason: input.reason.trim(),
          evidence: json(proposal.evidence),
          confirmedByStaffId: input.actorStaffId,
          effectiveAt: now,
        },
      });
      await tx.creditProfile.update({
        where: { id: proposal.creditProfileId },
        data: {
          rating: proposal.proposedRating,
          ratingConfirmedAt: now,
          cleanInvoiceCount: Number(evidence.cleanInvoiceCount ?? proposal.creditProfile.cleanInvoiceCount),
          nextReviewAt: nextQuarterlyCheckpoint(now),
          advancePaymentOnly: proposal.proposedRating === "F",
          lockedAt: ["E", "F"].includes(proposal.proposedRating) ? now : null,
          lockReason: ["E", "F"].includes(proposal.proposedRating) ? proposal.trigger : null,
        },
      });
      await tx.ratingProposal.update({
        where: { id },
        data: { status: "confirmed", confirmedByStaffId: input.actorStaffId, confirmedAt: now },
      });
      await tx.dispatchAuthorization.updateMany({
        where: {
          status: "active",
          order: { retailerId: proposal.creditProfile.retailerId },
        },
        data: { status: "invalidated", invalidatedAt: now },
      });
      await tx.auditEvent.create({
        data: {
          actorStaffId: input.actorStaffId,
          action: "credit_rating.confirmed",
          subjectType: "credit_profile",
          subjectId: proposal.creditProfileId,
          metadata: json({ from: proposal.previousRating, to: proposal.proposedRating, proposalId: id }),
        },
      });
      return tx.ratingProposal.findUniqueOrThrow({ where: { id } });
    });
  }
}
