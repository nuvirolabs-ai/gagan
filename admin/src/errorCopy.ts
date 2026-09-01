/**
 * API error codes turned into sentences a reviewer can act on.
 *
 * The API answers with a code because a code is stable and translatable; a
 * person needs to be told what went wrong and what to do instead. This lives in
 * one place because the reporting-scope codes are raised by half a dozen
 * endpoints, and a code that reaches the screen raw is a defect on every one of
 * them.
 *
 * Anything not listed falls back to the raw message rather than being
 * swallowed: an unexplained code is bad, a silent failure is worse.
 */
export const ERROR_COPY: Record<string, string> = {
  /* ------------------------- reporting hierarchy ------------------------- */
  outside_reporting_scope:
    "That person is not in your team, so you cannot see or act on their work.",
  self_approval_forbidden: "You cannot approve your own request.",
  self_management: "Someone cannot report to themselves.",
  cycle: "That manager already reports to this person, directly or further down.",
  manager_not_found: "That manager no longer exists.",
  manager_inactive: "That manager is not active.",
  employee_not_found: "That employee no longer exists.",
  employee_inactive: "That employee is not active, so their reporting line is frozen.",
  max_depth_exceeded: "That would make the reporting chain too deep.",

  /* ------------------------------ approvals ------------------------------ */
  expense_self_decision_forbidden: "You cannot decide your own expense claim.",
  expense_already_decided: "Somebody has already decided this claim.",
  expense_not_found: "That claim no longer exists.",
  leave_self_decision_forbidden: "You cannot decide your own leave request.",
  leave_already_decided: "Somebody has already decided this request.",
  leave_request_not_found: "That request no longer exists.",
  issue_already_closed: "That issue is already closed.",
  issue_not_found: "That issue no longer exists.",

  /* --------------------------- retailer proposals ------------------------ */
  tier_required:
    "Choose a tier to apply — this request did not come with one, and a customer cannot be created without it.",
  tier_not_found: "That tier no longer exists. Pick another one.",
  proposal_already_decided: "Somebody has already decided this request.",
  retailer_already_exists:
    "A customer with this phone number already exists. Assign the existing customer instead.",
  self_review_forbidden: "A salesperson cannot review their own request.",
  rejection_reason_required: "Give the salesperson a reason before rejecting.",
  proposal_not_found: "That request no longer exists.",

  /* -------------------------------- routes ------------------------------- */
  route_plan_not_found: "That route plan no longer exists.",
  route_plan_not_draft: "That plan has already been published.",
  route_requires_stops: "A route needs at least one stop.",
  task_not_found: "That task no longer exists.",
  task_already_closed: "That task is already closed.",

  /* -------------------------------- access ------------------------------- */
  permission_required: "You do not have permission to do that.",
  admin_access_required: "This area needs a portal login.",
};

/** The sentence for an error, falling back to whatever the API actually said. */
export function explain(error: unknown, fallback = "Something went wrong."): string {
  const body = (error as { body?: { error?: string } } | null)?.body?.error;
  const message = error instanceof Error ? error.message : undefined;
  return ERROR_COPY[body ?? ""] ?? ERROR_COPY[message ?? ""] ?? body ?? message ?? fallback;
}
