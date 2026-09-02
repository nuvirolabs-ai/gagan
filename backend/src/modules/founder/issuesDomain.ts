import type { FounderBlockedSummary, FounderIssue } from "./types";

export function composeIssues(input: {
  asOf: string;
  blocked: FounderBlockedSummary;
  failedOutbox: number;
  oldestFailedOutboxHours: number | null;
  overdue: number | null;
  outstanding: number | null;
}): FounderIssue[] {
  const issues: FounderIssue[] = [];
  const inventory = input.blocked.categories.find((category) => category.id === "INVENTORY");
  if (inventory && inventory.uniqueValue > 0) {
    issues.push({
      id: "blocked-inventory",
      category: "INVENTORY",
      severity: inventory.uniqueValue >= 500_000 ? "CRITICAL" : inventory.uniqueValue >= 100_000 ? "HIGH" : "WATCH",
      title: "Inventory is holding open orders",
      explanation: `${inventory.orderCount} open ${inventory.orderCount === 1 ? "order is" : "orders are"} short of available stock.`,
      businessImpact: { amount: inventory.uniqueValue, unit: "inr" },
      affectedObjects: { orders: inventory.orderCount },
      owner: "Operations",
      ageHours: null,
      drilldown: { kind: "blocked" },
      asOf: input.asOf,
    });
  }

  const credit = input.blocked.categories.find((category) => category.id === "CREDIT");
  if (credit && credit.uniqueValue > 0) {
    issues.push({
      id: "blocked-credit",
      category: "MONEY",
      severity: credit.uniqueValue >= 500_000 ? "CRITICAL" : "HIGH",
      title: "Orders waiting on credit approval",
      explanation: `${credit.orderCount} open ${credit.orderCount === 1 ? "order is" : "orders are"} held for credit approval.`,
      businessImpact: { amount: credit.uniqueValue, unit: "inr" },
      affectedObjects: { orders: credit.orderCount },
      owner: "Credit",
      ageHours: null,
      drilldown: { kind: "decisions" },
      asOf: input.asOf,
    });
  }

  if (input.failedOutbox > 0) {
    issues.push({
      id: "sap-outbox",
      category: "SYSTEM",
      severity: input.failedOutbox >= 5 ? "CRITICAL" : input.failedOutbox >= 1 ? "HIGH" : "WATCH",
      title: "SAP outbox has failed documents",
      explanation: "Documents still owe SAP a posting. Mock failures for unlinked accounts remain visible.",
      businessImpact: { amount: input.failedOutbox, unit: "count" },
      affectedObjects: { outbox: input.failedOutbox },
      owner: "Systems",
      ageHours: input.oldestFailedOutboxHours,
      drilldown: { kind: "systems" },
      asOf: input.asOf,
    });
  }

  if (input.outstanding != null && input.overdue != null && input.outstanding > 0 && input.overdue / input.outstanding >= 0.4) {
    issues.push({
      id: "overdue-receivables",
      category: "MONEY",
      severity: "HIGH",
      title: "Overdue is a large share of receivables",
      explanation: "The local invoice ledger shows overdue dominating outstanding.",
      businessImpact: { amount: input.overdue, unit: "inr" },
      affectedObjects: {},
      owner: "Collections",
      ageHours: null,
      drilldown: { kind: "receivables" },
      asOf: input.asOf,
    });
  }

  const dispatch = input.blocked.categories.find((category) => category.id === "DISPATCH");
  if (dispatch && dispatch.uniqueValue > 0) {
    issues.push({
      id: "blocked-dispatch",
      category: "EXECUTION",
      severity: "WATCH",
      title: "Packed orders waiting to leave",
      explanation: `${dispatch.orderCount} packed ${dispatch.orderCount === 1 ? "order is" : "orders are"} not yet out for delivery.`,
      businessImpact: { amount: dispatch.uniqueValue, unit: "inr" },
      affectedObjects: { orders: dispatch.orderCount },
      owner: "Dispatch",
      ageHours: null,
      drilldown: { kind: "blocked" },
      asOf: input.asOf,
    });
  }

  return issues.sort((left, right) => impact(right) - impact(left));
}

function impact(issue: FounderIssue): number {
  if (issue.businessImpact.unit === "inr") return issue.businessImpact.amount ?? 0;
  return (issue.businessImpact.amount ?? 0) * 1_000;
}
