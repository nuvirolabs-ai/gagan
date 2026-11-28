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
  tehsil_required: "Tehsil is required.",
  district_required: "District is required.",
  state_required: "State is required.",
  grade_required: "Buyer grade is required.",
  buyer_category_required: "Buyer category is required.",
  references_minimum_three: "At least 3 same-city retailer references are required.",
  reference_city_mismatch: "All retailer references must belong to the same delivery city.",
  reference_duplicate: "Duplicate retailer references are not allowed.",
  reference_phone_invalid: "Each manual retailer reference must include a valid 10-digit mobile number.",
  references_must_be_existing_city_retailers:
    "Please pick at least 3 existing retailers from this city.",
  aadhaar_photo_back_required: "Aadhaar Card Back photo is required.",
  hindi_fields_required: "Mandatory Hindi translation fields must be filled.",

  /* -------------------------------- routes ------------------------------- */
  route_plan_not_found: "That route plan no longer exists.",
  route_plan_not_draft: "That plan has already been published.",
  route_requires_stops: "A route needs at least one stop.",
  task_not_found: "That task no longer exists.",
  task_already_closed: "That task is already closed.",

  /* -------------------------------- access ------------------------------- */
  permission_required: "You do not have permission to do that.",
  admin_access_required: "This area needs a portal login.",
  target_scope_required: "Choose Personal or Team for this target before saving.",
  target_writes_paused: "Target changes are temporarily paused during verification. Try again after the cutover.",
  sales_rep_identity_ambiguous: "More than one SalesRep identity may match. Resolve the contact records before setup.",
  staff_identity_ambiguous: "Another staff identity uses this phone number. Resolve the duplicate staff contacts before salesperson setup.",
  sales_rep_link_conflict: "This SalesRep link conflicts with the staff contact. Resolve the identity before setup.",
  role_permission_mismatch: "This role is missing a required permission. Repair the role catalog before setup.",
  selling_leader_setup_required: "Use the guided Sales Leader setup to link the salesperson identity and roles together.",
  setup_conflict_retry: "Another setup changed this identity. Reload the staff record and try again.",
  invalid_input: "Invalid input. Please check the entered fields.",
  company_dispatch_routes_required: "Choose a route for each company sales order in the Warehouse queue.",
  company_order_line_unassigned: "A promotional line needs a confirmed selling company before this order can be packed or dispatched.",
  sales_order_dispatch_not_authorized: "Dispatch authorization is missing or expired. Review the authorization before packing.",
  sales_order_created_by_packing: "Pack the order to record sales-order creation.",
  invoice_selection_required: "Select the exact billing record to download.",
  firm_billing_snapshot_missing: "This firm billing record is missing its saved billing details.",
  firm_freight_configuration_required: "Confirm the freight owner and GST rate before entering a delivery freight amount.",
  firm_freight_entity_mismatch: "Delivery freight belongs to the firm assigned on the accepted quote.",
  accounting_requires_issued_invoice: "Accounting close requires a completed delivery and an issued invoice.",
  accepted_order_amendment_required: "This order has an accepted commercial snapshot. Quantity, pricing and freight changes require an approved amendment.",
};

/** The sentence for an error, falling back to whatever the API actually said. */
export function explain(error: unknown, fallback = "Something went wrong."): string {
  const errBody = (error as { body?: { error?: string; details?: { fieldErrors?: Record<string, string[]> } } } | null)?.body;
  const body = errBody?.error;
  const details = errBody?.details;
  if (details?.fieldErrors) {
    const entries = Object.entries(details.fieldErrors);
    if (entries.length > 0) {
      const [field, msgs] = entries[0];
      const msg = Array.isArray(msgs) && msgs.length > 0 ? msgs[0] : "";
      const fieldName = field.includes(".") ? field.split(".").pop() : field;
      return `Invalid input on ${fieldName}: ${msg || "please verify the entered value"}`;
    }
  }
  const message = error instanceof Error ? error.message : undefined;
  return ERROR_COPY[body ?? ""] ?? ERROR_COPY[message ?? ""] ?? body ?? message ?? fallback;
}
