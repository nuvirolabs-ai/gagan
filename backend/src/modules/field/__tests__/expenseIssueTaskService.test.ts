import { describe, expect, it, vi } from "vitest";
import { ExpenseService } from "../expenseService";
import { IssueService } from "../issueService";
import { TaskService } from "../taskService";
import { day, fakePrisma } from "./fakePrisma";

function storage() {
  return () =>
    ({
      put: vi.fn().mockResolvedValue({
        objectKey: "expense_receipt/2026/03/abc",
        checksum: "x",
        contentType: "image/jpeg",
        sizeBytes: 10,
      }),
      read: vi.fn(),
      signedReadUrl: vi.fn().mockResolvedValue("https://signed.example/receipt"),
      delete: vi.fn(),
    }) as any;
}

describe("field expenses", () => {
  const base = {
    salespersonId: "staff-1",
    expenseDate: day("2026-03-10"),
    category: "fuel" as const,
    amount: 450,
    description: "Diesel, Kothrud beat",
  };

  it("rejects a non-positive amount", async () => {
    await expect(
      new ExpenseService(fakePrisma(), storage()).submit({ ...base, amount: 0 })
    ).rejects.toMatchObject({ code: "expense_amount_invalid" });
  });

  it("rejects an expense dated in the future", async () => {
    const future = new Date(Date.now() + 3 * 86_400_000);
    await expect(
      new ExpenseService(fakePrisma(), storage()).submit({ ...base, expenseDate: future })
    ).rejects.toMatchObject({ code: "expense_date_in_future" });
  });

  it("stores the receipt through object storage, not in the row", async () => {
    const prisma = fakePrisma();
    prisma.fieldExpense.create.mockResolvedValue({ id: "expense-1" });
    await new ExpenseService(prisma, storage()).submit({
      ...base,
      receipt: { contentType: "image/jpeg", bodyBase64: Buffer.from("r").toString("base64") },
    });
    const data = prisma.fieldExpense.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      receiptObjectKey: "expense_receipt/2026/03/abc",
      receiptContentType: "image/jpeg",
    });
    // The claim always starts as `submitted`; the client cannot pre-approve it.
    expect(data).not.toHaveProperty("status");
  });

  it("hands out a signed receipt link instead of the storage key", async () => {
    const prisma = fakePrisma();
    prisma.fieldExpense.findMany.mockResolvedValue([
      { id: "expense-1", amount: "450.00", receiptObjectKey: "expense_receipt/2026/03/abc" },
    ]);
    const [expense] = await new ExpenseService(prisma, storage()).list({ salespersonId: "staff-1" });
    expect(expense).toMatchObject({
      amount: 450,
      hasReceipt: true,
      receiptUrl: "https://signed.example/receipt",
    });
    expect(expense).not.toHaveProperty("receiptObjectKey");
  });

  it("returns all-time claimed and status totals independently of the history page", async () => {
    const prisma = fakePrisma();
    prisma.staffUser.findUnique.mockResolvedValue({ id: "staff-1", name: "Ravi Kumar" });
    prisma.fieldExpense.groupBy = vi.fn().mockResolvedValue([
      { status: "submitted", _count: { _all: 1 }, _sum: { amount: "10.25" } },
      { status: "approved", _count: { _all: 2 }, _sum: { amount: "20.50" } },
      { status: "rejected", _count: { _all: 1 }, _sum: { amount: "3.10" } },
    ]);
    prisma.fieldExpense.findMany.mockResolvedValue(Array.from({ length: 51 }, (_, index) => ({
      id: `expense-${index}`,
      amount: "1.00",
      receiptObjectKey: index === 0 ? "expense_receipt/2026/03/abc" : null,
    })));

    const result = await new ExpenseService(prisma, storage()).historyFor("staff-1");
    expect(result.salesperson).toEqual({ id: "staff-1", name: "Ravi Kumar" });
    expect(result.totals).toEqual({
      claimed: { count: 4, amount: "33.85" },
      submitted: { count: 1, amount: "10.25" },
      approved: { count: 2, amount: "20.50" },
      rejected: { count: 1, amount: "3.10" },
    });
    expect(result.expenses).toHaveLength(50);
    expect(result.nextCursor).toBe("expense-49");
    expect(result.expenses[0]).toMatchObject({ receiptUrl: "https://signed.example/receipt" });
    expect(result.expenses[0]).not.toHaveProperty("receiptObjectKey");
    expect(prisma.fieldExpense.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: { salespersonId: "staff-1" },
    }));
  });

  it("returns the next history page without changing the all-time total", async () => {
    const prisma = fakePrisma();
    prisma.staffUser.findUnique.mockResolvedValue({ id: "staff-1", name: "Ravi Kumar" });
    prisma.fieldExpense.findFirst.mockResolvedValue({ id: "expense-49" });
    prisma.fieldExpense.groupBy = vi.fn().mockResolvedValue([]);
    prisma.fieldExpense.findMany.mockResolvedValue([{ id: "older", amount: "5.00", receiptObjectKey: null }]);

    const result = await new ExpenseService(prisma, storage()).historyFor("staff-1", "expense-49");
    expect(result.nextCursor).toBeNull();
    expect(result.totals.claimed).toEqual({ count: 0, amount: "0.00" });
    expect(prisma.fieldExpense.findMany).toHaveBeenCalledWith(expect.objectContaining({
      cursor: { id: "expense-49" },
      skip: 1,
    }));
    expect(prisma.fieldExpense.findFirst).toHaveBeenCalledWith({
      where: { id: "expense-49", salespersonId: "staff-1" },
      select: { id: true },
    });
  });

  it.each(["foreign-expense", "nonexistent-expense"])(
    "rejects %s as a history cursor without querying history",
    async (cursor) => {
      const prisma = fakePrisma();
      prisma.staffUser.findUnique.mockResolvedValue({ id: "staff-1", name: "Ravi Kumar" });
      prisma.fieldExpense.findFirst.mockResolvedValue(null);
      await expect(new ExpenseService(prisma, storage()).historyFor("staff-1", cursor))
        .rejects.toMatchObject({ code: "expense_cursor_invalid", status: 400 });
      expect(prisma.fieldExpense.findFirst).toHaveBeenCalledWith({
        where: { id: cursor, salespersonId: "staff-1" }, select: { id: true },
      });
      expect(prisma.fieldExpense.groupBy).toBeUndefined();
      expect(prisma.fieldExpense.findMany).not.toHaveBeenCalled();
    }
  );

  it("issues a fresh receipt URL only for the requested person's stored receipt", async () => {
    const prisma = fakePrisma();
    prisma.fieldExpense.findFirst.mockResolvedValue({ receiptObjectKey: "expense_receipt/2026/03/abc" });
    const signedReadUrl = vi.fn().mockResolvedValue("https://signed.example/fresh");
    const service = new ExpenseService(prisma, () => ({ signedReadUrl }) as any);
    expect(await service.receiptFor("staff-1", "expense-1")).toEqual({ receiptUrl: "https://signed.example/fresh" });
    expect(prisma.fieldExpense.findFirst).toHaveBeenCalledWith({
      where: { id: "expense-1", salespersonId: "staff-1" }, select: { receiptObjectKey: true },
    });
    expect(signedReadUrl).toHaveBeenCalledWith("expense_receipt/2026/03/abc", 300);
    prisma.fieldExpense.findFirst.mockResolvedValue(null);
    await expect(service.receiptFor("staff-1", "foreign-or-missing"))
      .rejects.toMatchObject({ code: "expense_receipt_not_found", status: 404 });
  });

  it("lists historical claimants only inside the caller's reporting scope", async () => {
    const prisma = fakePrisma();
    prisma.staffUser.findMany.mockResolvedValue([{ id: "staff-1", name: "Ravi Kumar" }]);
    const claimants = await new ExpenseService(prisma, storage()).claimants(["staff-1"]);
    expect(claimants).toEqual([{ id: "staff-1", name: "Ravi Kumar" }]);
    expect(prisma.staffUser.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ["staff-1"] }, fieldExpenses: { some: {} } },
    }));
  });

  it("never lets a salesperson approve their own expense", async () => {
    const prisma = fakePrisma();
    prisma.fieldExpense.findUnique.mockResolvedValue({
      id: "expense-1",
      status: "submitted",
      salespersonId: "staff-1",
    });
    await expect(
      new ExpenseService(prisma, storage()).decide({
        expenseId: "expense-1",
        decidedByStaffId: "staff-1",
        decision: "approved",
      })
    ).rejects.toMatchObject({ code: "expense_self_decision_forbidden", status: 403 });
  });

  it("refuses to decide an expense twice", async () => {
    const prisma = fakePrisma();
    prisma.fieldExpense.findUnique.mockResolvedValue({
      id: "expense-1",
      status: "approved",
      salespersonId: "staff-1",
    });
    await expect(
      new ExpenseService(prisma, storage()).decide({
        expenseId: "expense-1",
        decidedByStaffId: "manager-1",
        decision: "rejected",
      })
    ).rejects.toMatchObject({ code: "expense_already_decided" });
  });
});

describe("service issues", () => {
  function assigned(prisma: any, sameRep = true) {
    prisma.staffUser.findUnique.mockResolvedValue({ salesRepId: "rep-1" });
    prisma.retailer.findUnique.mockResolvedValue({ salesRepId: sameRep ? "rep-1" : "rep-2" });
  }

  it("refuses to raise an issue for another salesperson's store", async () => {
    const prisma = fakePrisma();
    assigned(prisma, false);
    await expect(
      new IssueService(prisma).raise({
        salespersonId: "staff-1",
        retailerId: "retailer-1",
        type: "damaged_product",
        description: "Two cartons crushed",
      })
    ).rejects.toMatchObject({ code: "retailer_not_assigned" });
  });

  it("refuses to attach an invoice belonging to a different store", async () => {
    const prisma = fakePrisma();
    assigned(prisma);
    prisma.invoice.findUnique.mockResolvedValue({ retailerId: "retailer-9" });
    await expect(
      new IssueService(prisma).raise({
        salespersonId: "staff-1",
        retailerId: "retailer-1",
        type: "invoice_issue",
        description: "Wrong rate billed",
        invoiceId: "invoice-1",
      })
    ).rejects.toMatchObject({ code: "invoice_not_found_for_retailer" });
  });

  it("writes the matching customer activity so the store timeline stays complete", async () => {
    const prisma = fakePrisma();
    assigned(prisma);
    prisma.serviceIssue.create.mockResolvedValue({ id: "issue-1" });

    await new IssueService(prisma).raise({
      salespersonId: "staff-1",
      retailerId: "retailer-1",
      type: "damaged_product",
      description: "Two cartons crushed on delivery",
    });

    expect(prisma.customerActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "complaint_raised", serviceIssueId: "issue-1" }),
      })
    );
  });

  it("requires a resolution note before closing an issue", async () => {
    const prisma = fakePrisma();
    prisma.serviceIssue.findUnique.mockResolvedValue({ id: "issue-1", status: "open" });
    await expect(
      new IssueService(prisma).updateStatus({
        issueId: "issue-1",
        actorStaffId: "manager-1",
        status: "resolved",
      })
    ).rejects.toMatchObject({ code: "issue_resolution_note_required" });
  });

  it("will not reopen a closed issue through a status update", async () => {
    const prisma = fakePrisma();
    prisma.serviceIssue.findUnique.mockResolvedValue({ id: "issue-1", status: "closed" });
    await expect(
      new IssueService(prisma).updateStatus({
        issueId: "issue-1",
        actorStaffId: "manager-1",
        status: "in_progress",
      })
    ).rejects.toMatchObject({ code: "issue_already_closed" });
  });
});

describe("field tasks", () => {
  const image = { contentType: "image/jpeg", bodyBase64: Buffer.from("task-photo").toString("base64") };

  function evidenceStorage() {
    const adapter = {
      put: vi.fn().mockResolvedValue({
        objectKey: "task_activity_photo/2026/09/private-object",
        checksum: "sha256",
        contentType: "image/jpeg",
        sizeBytes: 10,
      }),
      read: vi.fn(),
      signedReadUrl: vi.fn().mockResolvedValue("https://signed.example/task-photo"),
      delete: vi.fn(),
    };
    return { adapter, storage: () => adapter as any };
  }

  it("stores task evidence against the assigned retailer and salesperson with optional coordinates", async () => {
    const prisma = fakePrisma();
    prisma.fieldTask.findUnique.mockResolvedValue({
      id: "task-1",
      assignedToStaffId: "staff-1",
      retailerId: "retailer-1",
      status: "open",
    });
    prisma.fieldTaskEvidence.create.mockResolvedValue({
      id: "evidence-1",
      taskId: "task-1",
      retailerId: "retailer-1",
      salespersonId: "staff-1",
      objectKey: "task_activity_photo/2026/09/private-object",
      checksum: "sha256",
      contentType: "image/jpeg",
      sizeBytes: 10,
      createdAt: new Date("2026-09-25T10:00:00Z"),
      latitude: 18.52,
      longitude: 73.85,
      accuracyMeters: 12,
    });
    const { adapter, storage } = evidenceStorage();

    const evidence = await new TaskService(prisma, storage).addEvidence({
      taskId: "task-1",
      salespersonId: "staff-1",
      ...image,
      location: { latitude: 18.52, longitude: 73.85, accuracyMeters: 12 },
    });

    expect(prisma.fieldTaskEvidence.create.mock.calls[0][0].data).toMatchObject({
      taskId: "task-1",
      retailerId: "retailer-1",
      salespersonId: "staff-1",
      latitude: 18.52,
      longitude: 73.85,
      accuracyMeters: 12,
      objectKey: "task_activity_photo/2026/09/private-object",
    });
    expect(adapter.put).toHaveBeenCalledWith(expect.objectContaining({
      purpose: "task_activity_photo",
      contentType: "image/jpeg",
      body: Buffer.from("task-photo"),
    }));
    expect(evidence).toMatchObject({ id: "evidence-1", signedUrl: "https://signed.example/task-photo" });
    expect(evidence).not.toHaveProperty("objectKey");
  });

  it("does not allow another salesperson to attach task evidence", async () => {
    const prisma = fakePrisma();
    prisma.fieldTask.findUnique.mockResolvedValue({
      id: "task-1",
      assignedToStaffId: "staff-2",
      retailerId: "retailer-1",
      status: "open",
    });
    const { adapter, storage } = evidenceStorage();

    await expect(new TaskService(prisma, storage).addEvidence({
      taskId: "task-1",
      salespersonId: "staff-1",
      ...image,
    })).rejects.toMatchObject({ code: "task_not_found", status: 404 });
    expect(prisma.fieldTaskEvidence.create).not.toHaveBeenCalled();
    expect(adapter.put).not.toHaveBeenCalled();
  });

  it("requires a retailer-linked task and image content", async () => {
    const prisma = fakePrisma();
    prisma.fieldTask.findUnique.mockResolvedValue({
      id: "task-1",
      assignedToStaffId: "staff-1",
      retailerId: null,
      status: "open",
    });
    const { adapter, storage } = evidenceStorage();

    await expect(new TaskService(prisma, storage).addEvidence({
      taskId: "task-1",
      salespersonId: "staff-1",
      ...image,
    })).rejects.toMatchObject({ code: "task_retailer_required", status: 422 });
    await expect(new TaskService(prisma, storage).addEvidence({
      taskId: "task-1",
      salespersonId: "staff-1",
      contentType: "application/pdf",
      bodyBase64: image.bodyBase64,
    })).rejects.toMatchObject({ code: "unsupported_content_type", status: 422 });
    expect(adapter.put).not.toHaveBeenCalled();
  });

  it("returns grouped retailer history only to its assigned salesperson", async () => {
    const prisma = fakePrisma();
    prisma.staffUser.findUnique.mockResolvedValue({ salesRepId: "rep-1" });
    prisma.retailer.findFirst.mockResolvedValue({ id: "retailer-1" });
    prisma.fieldTaskEvidence.findMany.mockResolvedValue([{
      id: "evidence-1",
      taskId: "task-1",
      retailerId: "retailer-1",
      salespersonId: "staff-1",
      objectKey: "task_activity_photo/private-object",
      checksum: "secret-hash",
      contentType: "image/jpeg",
      sizeBytes: 10,
      createdAt: new Date("2026-09-25T10:00:00Z"),
      latitude: null,
      longitude: null,
      accuracyMeters: null,
      task: { id: "task-1", title: "Install shelf display", status: "done", completedAt: new Date("2026-09-25T10:01:00Z") },
      salesperson: { id: "staff-1", name: "Field Rep" },
    }]);
    const { storage } = evidenceStorage();

    const history = await new TaskService(prisma, storage).marketingHistoryForSalesperson({
      retailerId: "retailer-1",
      salespersonId: "staff-1",
    });

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      task: { id: "task-1", title: "Install shelf display", status: "done" },
      salesperson: { id: "staff-1", name: "Field Rep" },
      evidence: [{ id: "evidence-1", signedUrl: "https://signed.example/task-photo" }],
    });
    expect(history[0].evidence[0]).not.toHaveProperty("objectKey");
    expect(history[0].evidence[0]).not.toHaveProperty("checksum");
    expect(history[0].evidence[0]).not.toHaveProperty("task");
    expect(history[0].evidence[0]).not.toHaveProperty("salesperson");
    expect(prisma.fieldTaskEvidence.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { retailerId: "retailer-1" },
      take: 100,
    }));
  });

  it("rejects retailer history outside the assigned salesperson's account", async () => {
    const prisma = fakePrisma();
    prisma.staffUser.findUnique.mockResolvedValue({ salesRepId: "rep-1" });
    prisma.retailer.findFirst.mockResolvedValue(null);

    await expect(new TaskService(prisma).marketingHistoryForSalesperson({
      retailerId: "retailer-2",
      salespersonId: "staff-1",
    })).rejects.toMatchObject({ code: "retailer_not_assigned", status: 404 });
    expect(prisma.fieldTaskEvidence.findMany).not.toHaveBeenCalled();
  });

  it("keeps Admin retailer history inside the manager's staff scope", async () => {
    const prisma = fakePrisma();
    prisma.retailer.findUnique.mockResolvedValue({ id: "retailer-1" });
    prisma.fieldTaskEvidence.findMany.mockResolvedValue([]);

    await new TaskService(prisma).marketingHistoryForAdmin({
      retailerId: "retailer-1",
      scopeStaffIds: ["staff-1", "staff-2"],
    });

    expect(prisma.fieldTaskEvidence.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { retailerId: "retailer-1", salespersonId: { in: ["staff-1", "staff-2"] } },
      take: 100,
    }));
  });

  it("hides another salesperson's task behind a not-found", async () => {
    const prisma = fakePrisma();
    prisma.fieldTask.findUnique.mockResolvedValue({
      id: "task-1",
      assignedToStaffId: "staff-2",
      status: "open",
    });
    await expect(
      new TaskService(prisma).updateStatus({
        taskId: "task-1",
        salespersonId: "staff-1",
        status: "done",
      })
    ).rejects.toMatchObject({ code: "task_not_found", status: 404 });
  });

  it("stamps a completion time when a task is finished", async () => {
    const prisma = fakePrisma();
    prisma.fieldTask.findUnique.mockResolvedValue({
      id: "task-1",
      assignedToStaffId: "staff-1",
      status: "open",
      completionNote: null,
    });
    prisma.fieldTask.update.mockResolvedValue({ id: "task-1" });

    await new TaskService(prisma).updateStatus({
      taskId: "task-1",
      salespersonId: "staff-1",
      status: "done",
      note: "Delivered the sample pack",
    });

    const data = prisma.fieldTask.update.mock.calls[0][0].data;
    expect(data.status).toBe("done");
    expect(data.completedAt).toBeInstanceOf(Date);
  });

  it("refuses to assign a task about a store the assignee does not own", async () => {
    const prisma = fakePrisma();
    prisma.staffUser.findUnique.mockResolvedValue({
      id: "staff-1",
      status: "active",
      salesRepId: "rep-1",
    });
    prisma.retailer.findUnique.mockResolvedValue({ salesRepId: "rep-2" });

    await expect(
      new TaskService(prisma).assign({
        assignedToStaffId: "staff-1",
        createdByStaffId: "manager-1",
        title: "Collect the signed POD",
        retailerId: "retailer-1",
      })
    ).rejects.toMatchObject({ code: "retailer_not_assigned_to_salesperson" });
  });

  it("refuses to assign to a suspended user", async () => {
    const prisma = fakePrisma();
    prisma.staffUser.findUnique.mockResolvedValue({ id: "staff-1", status: "suspended" });
    await expect(
      new TaskService(prisma).assign({
        assignedToStaffId: "staff-1",
        createdByStaffId: "manager-1",
        title: "Collect the signed POD",
      })
    ).rejects.toMatchObject({ code: "assignee_not_available" });
  });
});
