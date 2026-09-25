import { NO_ORDER_REASONS } from "../field/fieldDomain";

export const VISIT_OUTCOMES = ["order_placed", "no_order", "payment_collected", "follow_up_required",
  "issue_raised", "shop_closed", "decision_maker_unavailable", "other", "survey_completed", "task_completed"] as const;

export function normalizeVisitOutcomes(input: { outcome?: string; outcomes?: string[] }) {
  const selected = input.outcomes ?? (input.outcome ? [input.outcome] : []);
  if (!Array.isArray(selected) || selected.length === 0 || selected.length > VISIT_OUTCOMES.length ||
      selected.some(value => !(VISIT_OUTCOMES as readonly string[]).includes(value))) {
    throw new Error("visit_outcome_required");
  }
  const outcomes = [...new Set(selected)].sort();
  if (input.outcome && !outcomes.includes(input.outcome)) throw new Error("visit_outcome_conflict");
  if (outcomes.includes("order_placed") && outcomes.includes("no_order")) throw new Error("visit_outcome_conflict");
  // Preserve one primary outcome for existing dashboards, without dropping the
  // other structured selections. New task/survey-only visits map to legacy other.
  const outcome = ["order_placed", "payment_collected", "no_order", "follow_up_required", "issue_raised",
    "shop_closed", "decision_maker_unavailable", "other"].find(value => outcomes.includes(value)) ?? "other";
  return { outcomes, outcome };
}

export function validateVisitExplanation(input: {
  purpose: string; outcomes: string[]; noOrderReason?: string; notes?: string;
}) {
  const needsReason = input.outcomes.includes("no_order") ||
    (input.purpose === "sales_call" && !input.outcomes.includes("order_placed"));
  if (needsReason && !input.noOrderReason) throw new Error("no_order_reason_required");
  if (input.noOrderReason && !(NO_ORDER_REASONS as readonly string[]).includes(input.noOrderReason)) throw new Error("invalid_no_order_reason");
  if (input.outcomes.includes("order_placed") && input.noOrderReason) throw new Error("visit_outcome_conflict");
  if (input.noOrderReason === "other" && (input.notes?.trim().length ?? 0) < 3) throw new Error("no_order_note_required");
}
