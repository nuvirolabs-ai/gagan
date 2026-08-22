import { KycCaseStatus, RetailerLifecycle } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export class KycGateError extends Error {
  constructor(public readonly code = "kyc_required", public readonly status = 409) {
    super(code);
    this.name = "KycGateError";
  }
}

/**
 * Dispatch is the irreversible operational action. It requires both an active
 * retailer lifecycle and an explicit KYC verification. The profile timestamp
 * remains accepted for backwards compatibility with the original Credit Team
 * confirmation route; new cases are verified by an approved KycCase.
 */
export async function ensureKycApprovedForDispatch(retailerId: string) {
  const retailer = await prisma.retailer.findUnique({
    where: { id: retailerId },
    select: {
      id: true,
      status: true,
      creditProfile: { select: { kycVerifiedAt: true } },
      kycCase: { select: { status: true } },
    },
  });
  if (!retailer) throw new KycGateError("retailer_not_found", 404);

  const verified =
    retailer.kycCase?.status === KycCaseStatus.approved ||
    retailer.creditProfile?.kycVerifiedAt != null;
  if (retailer.status !== RetailerLifecycle.active || !verified) {
    throw new KycGateError();
  }
  return { retailerId: retailer.id };
}
