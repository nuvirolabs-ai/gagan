import type { FounderIssue } from "../api/types";
import { formatInrExecutive } from "./inr";

export function impactLabel(issue: Pick<FounderIssue, "businessImpact">): string {
  if (issue.businessImpact.amount == null) return "";
  if (issue.businessImpact.unit === "inr") return formatInrExecutive(issue.businessImpact.amount);
  return `${issue.businessImpact.amount}`;
}
