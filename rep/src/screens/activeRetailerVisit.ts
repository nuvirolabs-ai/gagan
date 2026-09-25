export interface VisitSummary {
  id: string;
  retailerId: string;
  checkedOutAt?: string | null;
}

export function activeRetailerVisit<T extends VisitSummary>(
  visits: readonly T[],
  retailerId: string
): { activeVisit: T | null; activeVisitElsewhere: T | null } {
  const activeVisit = visits.find((visit) => !visit.checkedOutAt) ?? null;
  if (!activeVisit) return { activeVisit: null, activeVisitElsewhere: null };
  if (activeVisit.retailerId === retailerId) return { activeVisit, activeVisitElsewhere: null };
  return { activeVisit: null, activeVisitElsewhere: activeVisit };
}
