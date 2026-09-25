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
