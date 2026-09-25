/**
 * Founder health thresholds. Import this object — do not copy the numbers.
 * Documented in FOUNDER_HEALTH_RULES.md.
 */
export const FOUNDER_HEALTH_RULES = {
  sales: { healthyMin: 0.95, watchMin: 0.8 },
  collections: { healthyMin: 0.95, watchMin: 0.8 },
  fulfilment: { healthyMin: 95, watchMin: 90 },
  inventory: { watchMin: 0.05, riskMin: 0.12 },
  receivables: { watchMin: 0.25, riskMin: 0.4 },
  salesTeam: { healthyMin: 0.85, watchMin: 0.7 },
  systems: { watchMin: 1, riskMin: 5 },
} as const;

export type FounderHealthRules = typeof FOUNDER_HEALTH_RULES;
