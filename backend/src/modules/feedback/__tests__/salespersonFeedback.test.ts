import { describe, expect, it, vi } from "vitest";
import { SalespersonFeedbackService } from "../salespersonFeedbackService";

function fakeDb(assignedRepId: string | null = "rep-a") {
  const rows: any[] = [];
  const db: any = {
    $transaction: async (fn: any) => fn(db),
    $queryRaw: vi.fn().mockResolvedValue([{ id: "retailer-a", salesRepId: assignedRepId }]),
    retailer: { findUnique: vi.fn().mockResolvedValue({ salesRep: assignedRepId ? { id: assignedRepId, name: "Ravi" } : null }) },
    staffUser: { findMany: vi.fn().mockResolvedValue([{ salesRepId: "rep-a" }]) },
    salespersonFeedback: {
      findUnique: vi.fn(async ({ where }: any) => rows.find(row => row.retailerId === where.retailerId_clientReference.retailerId && row.clientReference === where.retailerId_clientReference.clientReference) ?? null),
      create: vi.fn(async ({ data }: any) => { const row = { id: "feedback-a", createdAt: new Date("2026-09-26T00:00:00Z"), salesRep: { id: data.salesRepId, name: "Ravi" }, ...data }; rows.push(row); return row; }),
      findMany: vi.fn(async ({ where }: any) => rows.filter(row =>
        (where.retailerId === undefined || row.retailerId === where.retailerId) &&
        (where.salesRepId === undefined || where.salesRepId.in.includes(row.salesRepId))
      )),
    },
  };
  return { db, rows };
}

const input = { retailerId: "retailer-a", expectedSalesRepId: "rep-a", description: "Helpful shop visit", clientReference: "retry-a" };

describe("salesperson feedback", () => {
  it("uses the canonical assigned SalesRep even without a linked active StaffUser", async () => {
    const { db, rows } = fakeDb();
    const service = new SalespersonFeedbackService(db);
    const first = await service.submit(input);
    expect(first).toMatchObject({ retailerId: "retailer-a", salesRepId: "rep-a", description: "Helpful shop visit" });
    expect((await service.submit(input)).id).toBe(first.id);
    expect(rows).toHaveLength(1);
    expect(db.staffUser.findMany).not.toHaveBeenCalled();
  });

  it("rejects a stale assignment before creating anything, but replays a committed retry", async () => {
    const { db, rows } = fakeDb("rep-b");
    const service = new SalespersonFeedbackService(db);
    await expect(service.submit(input)).rejects.toMatchObject({ code: "salesperson_assignment_changed", status: 409 });
    expect(rows).toHaveLength(0);
    rows.push({ id: "committed", retailerId: "retailer-a", salesRepId: "rep-a", description: input.description, clientReference: input.clientReference });
    expect((await service.submit(input)).id).toBe("committed");
  });

  it("rejects changed replay content or expected subject and missing assignment", async () => {
    const { db } = fakeDb();
    const service = new SalespersonFeedbackService(db);
    await service.submit(input);
    await expect(service.submit({ ...input, description: "Different visit" })).rejects.toMatchObject({ code: "feedback_payload_conflict" });
    await expect(service.submit({ ...input, expectedSalesRepId: "rep-b" })).rejects.toMatchObject({ code: "feedback_payload_conflict" });
    await expect(new SalespersonFeedbackService(fakeDb(null).db).submit(input)).rejects.toMatchObject({ code: "salesperson_not_assigned" });
  });

  it("uses retailer actor and reporting-tree SalesRep IDs for readback", async () => {
    const { db, rows } = fakeDb();
    const service = new SalespersonFeedbackService(db);
    await service.submit(input);
    rows.push({ id: "feedback-b", retailerId: "retailer-b", salesRepId: "rep-b", description: "Other store" });
    expect((await service.forRetailer("retailer-a")).feedback.map((row: any) => row.id)).toEqual(["feedback-a"]);
    expect((await service.forAdmin(["staff-a"])).feedback.map((row: any) => row.id)).toEqual(["feedback-a"]);
    expect(db.staffUser.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ["staff-a"] } } }));
    db.staffUser.findMany.mockResolvedValueOnce([]);
    expect((await service.forAdmin(["staff-c"])).feedback).toEqual([]);
  });
});
