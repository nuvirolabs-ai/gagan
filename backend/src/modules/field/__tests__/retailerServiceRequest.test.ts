import { describe, expect, it, vi } from "vitest";
import { IssueService } from "../issueService";

function fakeDb(issue: any = null) {
  const state = { issue };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "request-1" }]),
    serviceIssue: {
      findUnique: vi.fn(async () => state.issue),
      findFirst: vi.fn(async () => state.issue),
      create: vi.fn(async ({ data }: any) => (state.issue = { id: "request-1", ...data })),
      update: vi.fn(async ({ data }: any) => (state.issue = { ...state.issue, ...data })),
      updateMany: vi.fn(async ({ data }: any) => { state.issue = { ...state.issue, ...data }; return { count: 1 }; }),
    },
    auditEvent: { create: vi.fn(async () => ({})) },
  };
  const db = { ...tx, $transaction: async (fn: any) => fn(tx) };
  return { db, tx, state };
}

const open = { id: "request-1", retailerId: "retailer-a", type: "service_request", status: "open", description: "Please call about delivery", withdrawnByRetailerId: null };

describe("retailer service-request lifecycle", () => {
  it("creates a retailer-owned open request with durable audit, not a fabricated staff actor", async () => {
    const { db, tx } = fakeDb();
    const result = await new IssueService(db).raiseRetailerRequest({ retailerId: "retailer-a", description: "Please call about delivery", clientReference: "retry-1" });
    expect(result.raisedByStaffId).toBeNull();
    expect(result.type).toBe("service_request");
    expect(tx.auditEvent.create).toHaveBeenCalledOnce();
  });
  it("rejects another retailer and never mutates its request", async () => {
    const { db, tx } = fakeDb(open);
    await expect(new IssueService(db).withdrawRetailerRequest("request-1", "retailer-b")).rejects.toMatchObject({ code: "issue_not_found" });
    expect(tx.serviceIssue.update).not.toHaveBeenCalled();
  });
  it("withdraws an open request once and safely replays the same result", async () => {
    const { db, tx } = fakeDb(open);
    const service = new IssueService(db);
    const result = await service.withdrawRetailerRequest("request-1", "retailer-a");
    expect(result.status).toBe("withdrawn");
    expect(result.withdrawnFromStatus).toBe("open");
    expect(result.withdrawnAt).toBeInstanceOf(Date);
    expect((await service.withdrawRetailerRequest("request-1", "retailer-a")).id).toBe("request-1");
    expect(tx.serviceIssue.update).toHaveBeenCalledOnce();
    expect(tx.auditEvent.create).toHaveBeenCalledOnce();
  });
  it.each(["in_progress", "resolved", "closed", "rejected"])("does not withdraw %s work", async status => {
    const { db, tx } = fakeDb({ ...open, status });
    await expect(new IssueService(db).withdrawRetailerRequest("request-1", "retailer-a")).rejects.toMatchObject({ code: "issue_not_withdrawable" });
    expect(tx.serviceIssue.update).not.toHaveBeenCalled();
  });
});
