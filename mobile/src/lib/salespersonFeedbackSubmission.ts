export interface PendingFeedback {
  retailerId: string;
  description: string;
  clientReference: string;
  expectedSalesRepId: string;
  expectedSalesRepName?: string;
}

export interface FeedbackRow {
  id: string;
  retailerId: string;
  salesRepId: string;
  salesRep: { id: string; name: string };
  description: string;
  clientReference: string;
  createdAt: string;
}

export interface FeedbackPage {
  feedback: FeedbackRow[];
  nextCursor: string | null;
  assignment: { id: string; name: string } | null;
}

export interface FeedbackStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface FeedbackApi {
  submit(description: string, clientReference: string, expectedSalesRepId: string): Promise<{ feedback: FeedbackRow }>;
  byReference(clientReference: string): Promise<{ feedback: FeedbackRow }>;
  list(): Promise<FeedbackPage>;
}

export function feedbackSubjectLabel(
  pending: PendingFeedback | null | undefined,
  assignment: { id: string; name: string } | null,
  loading: boolean,
): string {
  if (pending) {
    const name = pending.expectedSalesRepName ?? (assignment?.id === pending.expectedSalesRepId ? assignment.name : null);
    return name ? `For ${name}` : "For your previously assigned salesperson";
  }
  return assignment ? `For ${assignment.name}` : loading ? "Checking assigned salesperson..." : "Assigned salesperson unavailable";
}

const storageKey = (retailerId: string) => `salesperson-feedback-pending:${retailerId}`;

export async function readPendingFeedback(storage: FeedbackStorage, retailerId: string): Promise<PendingFeedback | null> {
  const raw = await storage.getItem(storageKey(retailerId));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (value?.retailerId !== retailerId || typeof value.description !== "string" ||
      typeof value.clientReference !== "string" || !value.clientReference ||
      typeof value.expectedSalesRepId !== "string" || !value.expectedSalesRepId ||
      (value.expectedSalesRepName !== undefined && typeof value.expectedSalesRepName !== "string")) {
      throw new Error("feedback_pending_corrupt");
    }
    return value;
  } catch {
    throw new Error("feedback_pending_corrupt");
  }
}

export async function prepareFeedbackSubmission(storage: FeedbackStorage, input: PendingFeedback): Promise<PendingFeedback> {
  const existing = await readPendingFeedback(storage, input.retailerId);
  if (existing) return existing;
  await storage.setItem(storageKey(input.retailerId), JSON.stringify(input));
  return input;
}

export async function sendFeedbackAttempt(storage: FeedbackStorage, pending: PendingFeedback, api: FeedbackApi): Promise<
  | { kind: "submitted"; feedback: FeedbackRow; page: FeedbackPage | null }
  | { kind: "pending" }
  | { kind: "assignment_changed" }
> {
  let feedback: FeedbackRow;
  try {
    feedback = (await api.submit(pending.description, pending.clientReference, pending.expectedSalesRepId)).feedback;
  } catch (postError) {
    try {
      feedback = (await api.byReference(pending.clientReference)).feedback;
    } catch {
      const response = postError as { status?: number; body?: { error?: string } };
      if (response.status === 409 && response.body?.error === "salesperson_assignment_changed") {
        await storage.removeItem(storageKey(pending.retailerId));
        return { kind: "assignment_changed" };
      }
      return { kind: "pending" };
    }
  }
  if (feedback.retailerId !== pending.retailerId || feedback.salesRepId !== pending.expectedSalesRepId ||
    feedback.description !== pending.description || feedback.clientReference !== pending.clientReference) {
    return { kind: "pending" };
  }
  await storage.removeItem(storageKey(pending.retailerId)).catch(() => undefined);
  const page = await api.list().catch(() => null);
  return { kind: "submitted", feedback, page };
}
