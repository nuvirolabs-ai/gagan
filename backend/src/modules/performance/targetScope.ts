import { normalizeIndianPhone } from "../identity/otpService";

export type TargetScope = "PERSONAL" | "TEAM";

export class TargetScopeError extends Error {
  constructor(readonly code: string, readonly status = 409) {
    super(code);
  }
}

type TargetOwnerIdentity = {
  status: string;
  phone: string;
  salesRepPhone: string | null;
  roles: readonly string[];
};

function hasVerifiedPersonalIdentity(owner: TargetOwnerIdentity): boolean {
  if (!owner.roles.includes("salesperson") || !owner.salesRepPhone) return false;
  try {
    return normalizeIndianPhone(owner.phone) === normalizeIndianPhone(owner.salesRepPhone);
  } catch {
    return false;
  }
}

export function resolveTargetWriteScope(
  requested: unknown,
  owner: TargetOwnerIdentity,
): TargetScope {
  if (owner.status !== "active") throw new TargetScopeError("target_owner_inactive");
  if (requested === undefined) {
    if (owner.roles.includes("field_manager") || !hasVerifiedPersonalIdentity(owner)) {
      throw new TargetScopeError("target_scope_required");
    }
    return "PERSONAL";
  }
  if (requested === "PERSONAL") {
    if (!hasVerifiedPersonalIdentity(owner)) throw new TargetScopeError("personal_owner_required");
    return requested;
  }
  if (requested === "TEAM") {
    if (!owner.roles.includes("field_manager")) throw new TargetScopeError("team_owner_required");
    return requested;
  }
  throw new TargetScopeError("target_scope_invalid", 400);
}
