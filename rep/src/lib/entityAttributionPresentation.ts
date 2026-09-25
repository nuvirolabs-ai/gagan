export type EntityAmounts = {
  jainTraders: number;
  padamInternational: number;
  unattributed: number;
};

export type AttributionStatus = "complete" | "contains_unattributed" | "review_required";

export type EntityAttributionRow = {
  key: keyof EntityAmounts;
  amount: number;
};

const ENTITY_KEYS = ["jainTraders", "padamInternational", "unattributed"] as const;

function validEntityAmounts(amounts: EntityAmounts | null | undefined): amounts is EntityAmounts {
  return Boolean(amounts && ENTITY_KEYS.every((key) => Number.isFinite(amounts[key]) && amounts[key] >= 0));
}

export function entityAmountsMatchTotal(amounts: EntityAmounts | null | undefined, expectedTotal: number | null | undefined) {
  if (!validEntityAmounts(amounts) || expectedTotal == null || !Number.isFinite(expectedTotal) || expectedTotal < 0) return false;
  const sumCents = ENTITY_KEYS.reduce((sum, key) => sum + Math.round(amounts[key] * 100), 0);
  return sumCents === Math.round(expectedTotal * 100);
}

export function entityAttributionPresentation(
  amounts: EntityAmounts | null | undefined,
  status: AttributionStatus | null | undefined,
  expectedTotal?: number | null
): { rows: EntityAttributionRow[]; reviewRequired: boolean } {
  if (!amounts) return { rows: fallback(expectedTotal), reviewRequired: status === "review_required" };

  if (!validEntityAmounts(amounts)) {
    return { rows: fallback(expectedTotal), reviewRequired: true };
  }
  if (expectedTotal != null && !entityAmountsMatchTotal(amounts, expectedTotal)) {
    return { rows: fallback(expectedTotal), reviewRequired: true };
  }
  if (status === "review_required" && (amounts.jainTraders > 0 || amounts.padamInternational > 0)) {
    return { rows: fallback(expectedTotal), reviewRequired: true };
  }

  const sumCents = ENTITY_KEYS.reduce((sum, key) => sum + Math.round(amounts[key] * 100), 0);
  const reviewRequired = status === "review_required";
  if (sumCents === 0 && !reviewRequired) return { rows: [], reviewRequired: false };

  const rows: EntityAttributionRow[] = [];
  if (amounts.jainTraders > 0 || amounts.padamInternational > 0) {
    rows.push({ key: "jainTraders", amount: amounts.jainTraders });
    rows.push({ key: "padamInternational", amount: amounts.padamInternational });
  }
  if (amounts.unattributed > 0 || (reviewRequired && rows.length === 0)) {
    rows.push({ key: "unattributed", amount: amounts.unattributed });
  }

  return { rows, reviewRequired };
}

function fallback(expectedTotal?: number | null): EntityAttributionRow[] {
  if (expectedTotal == null || !Number.isFinite(expectedTotal) || expectedTotal < 0) return [];
  return [{ key: "unattributed", amount: Math.round(expectedTotal * 100) / 100 }];
}
