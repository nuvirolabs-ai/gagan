import { Prisma } from "@prisma/client";

export type RoutingClass = "LAXMI_TOOR" | "INSTANT_MIX" | "OTHER";
export type RoutingEntity = "jain_traders" | "padam_international";

export type RoutingErrorCode =
  | "ROUTING_DESTINATION_REQUIRED"
  | "ROUTING_CLASS_REQUIRED"
  | "ROUTING_CLASS_INVALID"
  | "ROUTING_DATA_NOT_READY"
  | "ROUTING_POLICY_UNRESOLVED";

export class RoutingPolicyError extends Error {
  constructor(public readonly code: RoutingErrorCode, public readonly details?: Record<string, unknown>) {
    super(code);
  }
}

export interface SalesOrderRoutingInputLine {
  variantId: string;
  quantity: number;
  routingClass: string | null;
  routingBagEquivalent: string | Prisma.Decimal | null;
  caseWeightKg: string | Prisma.Decimal;
}

export interface SalesOrderRoutingLine {
  variantId: string;
  entity: RoutingEntity;
  routingClass: RoutingClass;
  contributionBags: string | null;
  contributionBasis: "NOT_APPLICABLE" | "EXPLICIT_ROUTING_BAG_EQUIVALENT" | "INSTANT_MIX_KG_DIV_5";
  orderedKg: string | null;
  reason: string;
}

export interface SalesOrderRoutingPlan {
  ruleVersion: "jain-padam-v2";
  destinationCity: string;
  destination: "INDORE_CITY" | "OUTSIDE_INDORE";
  threshold: { value: "5.00"; unit: "bags" };
  eligibleContributionBags: string;
  lines: SalesOrderRoutingLine[];
  explanation: string;
}

function decimal(value: string | Prisma.Decimal, field: string): Prisma.Decimal {
  const result = new Prisma.Decimal(value);
  if (!result.isFinite() || result.isNegative()) throw new RoutingPolicyError("ROUTING_DATA_NOT_READY", { field });
  return result;
}

const INSTANT_MIX_KG_PER_ROUTING_BAG = new Prisma.Decimal(5);

function exactDecimalText(value: Prisma.Decimal) {
  // Preserve the complete decimal result. Three places remain the minimum so
  // existing review displays stay stable, but a value such as 24.001 / 5 is
  // never rounded down to an inaccurate three-place contribution.
  return value.toFixed(Math.max(3, value.decimalPlaces()));
}

function normalizeCity(value: string | null | undefined) {
  const city = value?.trim().replace(/\s+/g, " ");
  if (!city) throw new RoutingPolicyError("ROUTING_DESTINATION_REQUIRED");
  const normalized = city.toLowerCase();
  return {
    display: city,
    destination: normalized === "indore" || normalized === "indore city" ? "INDORE_CITY" as const : "OUTSIDE_INDORE" as const,
  };
}

function routingClass(value: string | null): RoutingClass {
  if (!value) throw new RoutingPolicyError("ROUTING_CLASS_REQUIRED");
  if (value !== "LAXMI_TOOR" && value !== "INSTANT_MIX" && value !== "OTHER") {
    throw new RoutingPolicyError("ROUTING_CLASS_INVALID", { value });
  }
  return value;
}

type RoutingContribution = {
  bags: Prisma.Decimal | null;
  orderedKg: Prisma.Decimal | null;
  basis: SalesOrderRoutingLine["contributionBasis"];
};

function contributionForLine(line: SalesOrderRoutingInputLine, klass: RoutingClass): RoutingContribution {
  if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
    throw new RoutingPolicyError("ROUTING_DATA_NOT_READY", {
      variantId: line.variantId,
      reason: "invalid_order_quantity",
    });
  }

  if (klass === "LAXMI_TOOR") {
    return { bags: null, orderedKg: null, basis: "NOT_APPLICABLE" };
  }

  if (klass === "INSTANT_MIX") {
    // The approved policy is fixed: 5 KG of ordered Instant Mix equals one
    // routing bag. The product's authoritative case weight comes from the
    // product master; no client-provided conversion is accepted here.
    if (line.routingBagEquivalent !== null && line.routingBagEquivalent !== undefined) {
      throw new RoutingPolicyError("ROUTING_DATA_NOT_READY", {
        variantId: line.variantId,
        reason: "instant_mix_uses_fixed_5kg_conversion_leave_bag_equivalent_blank",
      });
    }
    const orderedKg = decimal(line.caseWeightKg, "caseWeightKg").mul(line.quantity);
    if (!orderedKg.isPositive()) {
      throw new RoutingPolicyError("ROUTING_DATA_NOT_READY", {
        variantId: line.variantId,
        reason: "instant_mix_weight_required",
      });
    }
    return {
      bags: orderedKg.div(INSTANT_MIX_KG_PER_ROUTING_BAG),
      orderedKg,
      basis: "INSTANT_MIX_KG_DIV_5",
    };
  }

  // OTHER products must carry an explicit approved contribution from the
  // product master. An approved BAG is represented by 1.000 per ordered
  // sellable case/unit; other UOMs must provide their reviewed equivalent.
  if (line.routingBagEquivalent === null || line.routingBagEquivalent === undefined) {
    throw new RoutingPolicyError("ROUTING_DATA_NOT_READY", {
      variantId: line.variantId,
      reason: "approved_bag_equivalent_required",
    });
  }
  const equivalent = decimal(line.routingBagEquivalent, "routingBagEquivalent");
  if (!equivalent.isPositive()) {
    throw new RoutingPolicyError("ROUTING_DATA_NOT_READY", {
      variantId: line.variantId,
      reason: "approved_bag_equivalent_required",
    });
  }
  return {
    bags: equivalent.mul(line.quantity),
    orderedKg: null,
    basis: "EXPLICIT_ROUTING_BAG_EQUIVALENT",
  };
}

/**
 * Resolve the approved Jain/Padam routing policy. This function is deliberately
 * pure and uses only explicit destination/SKU metadata. It never derives a
 * city from an address or a seller from a display name.
 */
export function resolveSalesOrderAllocation(input: {
  destinationCity: string | null | undefined;
  lines: SalesOrderRoutingInputLine[];
}): SalesOrderRoutingPlan {
  if (!input.lines.length) throw new RoutingPolicyError("ROUTING_DATA_NOT_READY", { reason: "empty_order" });
  const destination = normalizeCity(input.destinationCity);
  const classified = input.lines
    .map((line) => ({ ...line, routingClass: routingClass(line.routingClass) }))
    .sort((a, b) => a.variantId.localeCompare(b.variantId));

  // The fixed Instant Mix rule is a product-master contract, not something
  // that may be overridden by a caller. Validate this before the Indore
  // all-Jain shortcut as well, so every quote snapshot has one interpretation
  // of the configured conversion.
  for (const line of classified) {
    if (line.routingClass === "INSTANT_MIX" && line.routingBagEquivalent !== null && line.routingBagEquivalent !== undefined) {
      throw new RoutingPolicyError("ROUTING_DATA_NOT_READY", {
        variantId: line.variantId,
        reason: "instant_mix_uses_fixed_5kg_conversion_leave_bag_equivalent_blank",
      });
    }
  }

  let eligibleContribution = new Prisma.Decimal(0);
  const contributionByVariant = new Map<string, RoutingContribution>();
  for (const line of classified) {
    if (destination.destination === "INDORE_CITY") {
      contributionByVariant.set(line.variantId, { bags: null, orderedKg: null, basis: "NOT_APPLICABLE" });
      continue;
    }
    const contribution = contributionForLine(line, line.routingClass);
    contributionByVariant.set(line.variantId, contribution);
    if (contribution.bags) eligibleContribution = eligibleContribution.add(contribution.bags);
  }

  const allJain = destination.destination === "INDORE_CITY"
    || eligibleContribution.lt(5);
  const lines = classified.map((line): SalesOrderRoutingLine => {
    let entity: RoutingEntity;
    let reason: string;
    const contribution = contributionByVariant.get(line.variantId) ?? { bags: null, orderedKg: null, basis: "NOT_APPLICABLE" as const };
    if (destination.destination === "INDORE_CITY") {
      entity = "jain_traders";
      reason = "INDORE_CITY_OVERRIDE";
    } else if (line.routingClass === "LAXMI_TOOR") {
      entity = "jain_traders";
      reason = "LAXMI_ALWAYS_JAIN";
    } else if (allJain) {
      entity = "jain_traders";
      reason = "ELIGIBLE_THRESHOLD_LT_5_BAGS";
    } else {
      entity = "padam_international";
      reason = "ELIGIBLE_THRESHOLD_GTE_5_BAGS";
    }
    return {
      variantId: line.variantId,
      entity,
      routingClass: line.routingClass,
      contributionBags: contribution.bags === null ? null : exactDecimalText(contribution.bags),
      contributionBasis: contribution.basis,
      orderedKg: contribution.orderedKg === null ? null : exactDecimalText(contribution.orderedKg),
      reason,
    };
  });

  return {
    ruleVersion: "jain-padam-v2",
    destinationCity: destination.display,
    destination: destination.destination,
    threshold: { value: "5.00", unit: "bags" },
    eligibleContributionBags: exactDecimalText(eligibleContribution),
    lines,
    explanation: destination.destination === "INDORE_CITY"
      ? "Indore City destination routes the entire order to Jain Traders."
      : allJain
        ? "Eligible products are below the 5-bag threshold; the order routes to Jain Traders, with Laxmi Toor Dal always Jain and Instant Mix counted as ordered KG ÷ 5."
        : "Eligible products meet the 5-bag threshold; eligible products route to Padam International, Laxmi Toor Dal remains Jain, and Instant Mix is counted as ordered KG ÷ 5.",
  };
}
