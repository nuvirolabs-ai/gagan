import { describe, expect, it, vi } from "vitest";
import { feedbackSubjectLabel, prepareFeedbackSubmission, readPendingFeedback, sendFeedbackAttempt } from "../salespersonFeedbackSubmission";

function fixture() {
  const state = new Map<string, string>();
  const storage = {
    getItem: vi.fn(async (key: string) => state.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { state.set(key, value); }),
    removeItem: vi.fn(async (key: string) => { state.delete(key); }),
  };
  const pending = { retailerId: "retailer-a", description: "Good visit", clientReference: "retry-a", expectedSalesRepId: "rep-a", expectedSalesRepName: "Ravi" };
  const feedback = { id: "feedback-a", retailerId: pending.retailerId, salesRepId: pending.expectedSalesRepId, salesRep: { id: "rep-a", name: "Ravi" }, description: pending.description, clientReference: pending.clientReference, createdAt: "2026-09-26T09:00:00.000Z" };
  const api = {
    submit: vi.fn().mockResolvedValue({ feedback }),
    byReference: vi.fn().mockResolvedValue({ feedback }),
    list: vi.fn().mockResolvedValue({ feedback: [feedback], nextCursor: null, assignment: { id: "rep-a", name: "Ravi" } }),
  };
  return { storage, pending, api };
}

describe("feedback submission recovery", () => {
  it("does not treat an unreadable saved attempt as permission to create a new key", async () => {
    const { storage, pending } = fixture();
    await storage.setItem(`salesperson-feedback-pending:${pending.retailerId}`, "{broken");
    await expect(readPendingFeedback(storage, pending.retailerId)).rejects.toThrow("feedback_pending_corrupt");
    await expect(prepareFeedbackSubmission(storage, { ...pending, clientReference: "new-key" })).rejects.toThrow("feedback_pending_corrupt");
  });
  it("keeps the pending subject visible after the current assignment changes", () => {
    const { pending } = fixture();
    expect(feedbackSubjectLabel(pending, { id: "rep-b", name: "Priya" }, false)).toBe("For Ravi");
    expect(feedbackSubjectLabel(null, { id: "rep-b", name: "Priya" }, false)).toBe("For Priya");
    expect(feedbackSubjectLabel(null, null, false)).toBe("Assigned salesperson unavailable");
  });
  it("keeps the original payload and key when a user edits after an uncertain response", async () => {
    const { storage, pending, api } = fixture();
    api.submit.mockRejectedValue(new Error("connection lost"));
    api.byReference.mockRejectedValue(new Error("connection lost"));
    await prepareFeedbackSubmission(storage, pending);
    expect((await sendFeedbackAttempt(storage, pending, api)).kind).toBe("pending");
    const attempt = await prepareFeedbackSubmission(storage, { ...pending, description: "Edited visit", clientReference: "retry-b" });
    expect(attempt).toEqual(pending);
    expect(await readPendingFeedback(storage, "retailer-a")).toEqual(pending);
    await sendFeedbackAttempt(storage, attempt, api);
    expect(api.submit).toHaveBeenLastCalledWith(pending.description, pending.clientReference, pending.expectedSalesRepId);
  });

  it("reconciles a committed POST whose response was lost without a second submit", async () => {
    const { storage, pending, api } = fixture();
    api.submit.mockRejectedValue(new Error("connection lost"));
    await prepareFeedbackSubmission(storage, pending);
    const result = await sendFeedbackAttempt(storage, pending, api);
    expect(result).toMatchObject({ kind: "submitted", feedback: { id: "feedback-a" } });
    expect(api.submit).toHaveBeenCalledTimes(1);
    expect(await readPendingFeedback(storage, "retailer-a")).toBeNull();
  });

  it("does not confirm a readback attributed to another salesperson", async () => {
    const { storage, pending, api } = fixture();
    api.submit.mockRejectedValue(new Error("connection lost"));
    api.byReference.mockResolvedValue({ feedback: { id: "feedback-a", retailerId: pending.retailerId, salesRepId: "rep-b", description: pending.description } });
    await prepareFeedbackSubmission(storage, pending);
    expect(await sendFeedbackAttempt(storage, pending, api)).toEqual({ kind: "pending" });
    expect(await readPendingFeedback(storage, pending.retailerId)).toEqual(pending);
  });

  it("does not turn a committed POST into a failed submission when history refresh fails", async () => {
    const { storage, pending, api } = fixture();
    api.list.mockRejectedValue(new Error("history unavailable"));
    await prepareFeedbackSubmission(storage, pending);
    const result = await sendFeedbackAttempt(storage, pending, api);
    expect(result).toMatchObject({ kind: "submitted", feedback: { id: "feedback-a" }, page: null });
    expect(await readPendingFeedback(storage, "retailer-a")).toBeNull();
  });

  it("unlocks the form after a definitive assignment conflict with no committed record", async () => {
    const { storage, pending, api } = fixture();
    api.submit.mockRejectedValue({ status: 409, body: { error: "salesperson_assignment_changed" } });
    api.byReference.mockRejectedValue({ status: 404, body: { error: "feedback_not_found" } });
    await prepareFeedbackSubmission(storage, pending);
    expect(await sendFeedbackAttempt(storage, pending, api)).toEqual({ kind: "assignment_changed" });
    expect(await readPendingFeedback(storage, "retailer-a")).toBeNull();
  });
});
