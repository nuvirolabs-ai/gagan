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
  reason: string;
}

export interface SalesOrderRoutingPlan {
  ruleVersion: "jain-padam-v1";
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

function positiveContribution(line: SalesOrderRoutingInputLine, klass: RoutingClass) {
  if (line.routingBagEquivalent === null || line.routingBagEquivalent === undefined) {
    if (klass === "LAXMI_TOOR") return null;
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
  return equivalent.mul(line.quantity);
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
  const hasInstantMix = classified.some((line) => line.routingClass === "INSTANT_MIX");
  const hasLaxmi = classified.some((line) => line.routingClass === "LAXMI_TOOR");
  const hasOther = classified.some((line) => line.routingClass === "OTHER");

  const instantWithoutApprovedConversion = classified.filter(
    (line) => line.routingClass === "INSTANT_MIX" && (line.routingBagEquivalent === null || line.routingBagEquivalent === undefined)
  );
  const totalInstantWeight = classified
    .filter((line) => line.routingClass === "INSTANT_MIX")
    .reduce((sum, line) => sum.add(decimal(line.caseWeightKg, "caseWeightKg").mul(line.quantity)), new Prisma.Decimal(0));

  // The business brief gives one weight-based exception only: Laxmi plus an
  // Instant Mix amount below 5 kg. Every other mixed-unit combination must be
  // explicitly mapped to bags or be reviewed instead of being guessed.
  const laxmiInstantException = hasLaxmi
    && hasInstantMix
    && !hasOther
    && instantWithoutApprovedConversion.length === classified.filter((line) => line.routingClass === "INSTANT_MIX").length
    && totalInstantWeight.lt(5);

  if (instantWithoutApprovedConversion.length && !laxmiInstantException && destination.destination !== "INDORE_CITY") {
    throw new RoutingPolicyError("ROUTING_POLICY_UNRESOLVED", {
      reason: "instant_mix_mixed_unit_conversion_required",
      variantIds: instantWithoutApprovedConversion.map((line) => line.variantId),
    });
  }

  let eligibleContribution = new Prisma.Decimal(0);
  const contributionByVariant = new Map<string, Prisma.Decimal | null>();
  for (const line of classified) {
    if (destination.destination === "INDORE_CITY") {
      contributionByVariant.set(line.variantId, null);
      continue;
    }
    if (line.routingClass === "LAXMI_TOOR") {
      contributionByVariant.set(line.variantId, null);
      continue;
    }
    if (laxmiInstantException && line.routingClass === "INSTANT_MIX" && !line.routingBagEquivalent) {
      contributionByVariant.set(line.variantId, null);
      continue;
    }
    const contribution = positiveContribution(line, line.routingClass);
    contributionByVariant.set(line.variantId, contribution);
    if (contribution) eligibleContribution = eligibleContribution.add(contribution);
  }

  const allJain = destination.destination === "INDORE_CITY"
    || laxmiInstantException
    || eligibleContribution.lt(5);
  const lines = classified.map((line): SalesOrderRoutingLine => {
    const contribution = contributionByVariant.get(line.variantId);
    let entity: RoutingEntity;
    let reason: string;
    if (destination.destination === "INDORE_CITY") {
      entity = "jain_traders";
      reason = "INDORE_CITY_OVERRIDE";
    } else if (line.routingClass === "LAXMI_TOOR") {
      entity = "jain_traders";
      reason = laxmiInstantException ? "LAXMI_INSTANT_MIX_LT_5KG" : "LAXMI_ALWAYS_JAIN";
    } else if (laxmiInstantException) {
      entity = "jain_traders";
      reason = "LAXMI_INSTANT_MIX_LT_5KG";
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
      contributionBags: contribution?.toFixed(3) ?? null,
      reason,
    };
  });

  return {
    ruleVersion: "jain-padam-v1",
    destinationCity: destination.display,
    destination: destination.destination,
    threshold: { value: "5.00", unit: "bags" },
    eligibleContributionBags: eligibleContribution.toFixed(3),
    lines,
    explanation: destination.destination === "INDORE_CITY"
      ? "Indore City destination routes the entire order to Jain Traders."
      : allJain
        ? "Eligible products are below the 5-bag threshold; the order routes to Jain Traders, with Laxmi Toor Dal always Jain."
        : "Eligible products meet the 5-bag threshold; eligible products route to Padam International and Laxmi Toor Dal remains Jain.",
  };
}
