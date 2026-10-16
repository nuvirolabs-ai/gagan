import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";

export function createFieldApprovalsRouter() {
  const router = Router();

  const ensureDefaultApprovalsData = async () => {
    try {
      const expCount = await prisma.fieldExpense.count();
      if (expCount === 0) {
        const staff = await prisma.staffUser.findFirst({
          where: { roles: { some: { role: { name: "salesperson" } } } },
        });

        if (staff) {
          const now = new Date();
          await prisma.fieldExpense.createMany({
            data: [
              {
                salespersonId: staff.id,
                expenseDate: now,
                category: "fuel",
                amount: 650.0,
                description: "Two-wheeler petrol reimbursement for Dewas outer market beat (55 km covered)",
                receiptObjectKey: "/catalog-images/basmati-rice.png",
                receiptContentType: "image/png",
                status: "submitted",
              },
              {
                salespersonId: staff.id,
                expenseDate: new Date(now.getTime() - 24 * 3600 * 1000),
                category: "food",
                amount: 220.0,
                description: "Lunch expense during full-day Ujjain rural market onboarding camp",
                receiptObjectKey: "/catalog-images/chana-dal.png",
                receiptContentType: "image/png",
                status: "submitted",
              },
              {
                salespersonId: staff.id,
                expenseDate: new Date(now.getTime() - 2 * 24 * 3600 * 1000),
                category: "other",
                amount: 150.0,
                description: "Printout & photocopy charges for physical KYC application forms",
                status: "approved",
                decisionNote: "Approved as per field sales policy",
                decidedAt: new Date(),
              },
            ],
          });
        }
      }

      const leaveCount = await prisma.leaveRequest.count();
      if (leaveCount === 0) {
        const staff = await prisma.staffUser.findFirst({
          where: { roles: { some: { role: { name: "salesperson" } } } },
        });

        if (staff) {
          const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
          const dayAfter = new Date(Date.now() + 2 * 24 * 3600 * 1000);

          await prisma.leaveRequest.createMany({
            data: [
              {
                salespersonId: staff.id,
                fromDate: tomorrow,
                toDate: dayAfter,
                type: "casual",
                reason: "Family function in native village, will resume beats on Monday",
                status: "pending",
              },
              {
                salespersonId: staff.id,
                fromDate: new Date(Date.now() - 5 * 24 * 3600 * 1000),
                toDate: new Date(Date.now() - 4 * 24 * 3600 * 1000),
                type: "sick",
                reason: "Severe fever and viral infection",
                status: "approved",
                decisionNote: "Medical prescription verified by team lead",
                decidedAt: new Date(),
              },
            ],
          });
        }
      }
    } catch (err) {
      console.warn("Could not ensure default field approvals data:", err);
    }
  };

  void ensureDefaultApprovalsData();

  // GET /admin/field-approvals/expenses
  router.get("/field-approvals/expenses", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const where: any = {};
      if (status && status !== "all") where.status = status;

      const expenses = await prisma.fieldExpense.findMany({
        where,
        include: {
          salesperson: { select: { id: true, name: true, phone: true } },
          decidedBy: { select: { id: true, name: true } },
        },
        orderBy: [{ submittedAt: "desc" }],
      });

      const metrics = {
        totalClaims: expenses.length,
        pendingClaims: expenses.filter((e) => e.status === "submitted").length,
        approvedClaims: expenses.filter((e) => e.status === "approved").length,
        rejectedClaims: expenses.filter((e) => e.status === "rejected").length,
        pendingAmount: expenses
          .filter((e) => e.status === "submitted")
          .reduce((sum, e) => sum + Number(e.amount), 0),
      };

      res.json({
        metrics,
        expenses: expenses.map((e) => ({
          id: e.id,
          salespersonId: e.salespersonId,
          salespersonName: e.salesperson.name,
          salespersonPhone: e.salesperson.phone,
          expenseDate: e.expenseDate,
          category: e.category,
          amount: Number(e.amount),
          description: e.description,
          receiptObjectKey: e.receiptObjectKey,
          receiptUrl: e.receiptObjectKey
            ? e.receiptObjectKey.startsWith("http")
              ? e.receiptObjectKey
              : `http://localhost:4000${e.receiptObjectKey}`
            : null,
          status: e.status,
          submittedAt: e.submittedAt,
          decidedAt: e.decidedAt,
          decidedByName: e.decidedBy?.name || null,
          decisionNote: e.decisionNote,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to list expense claims", detail: String(err) });
    }
  });

  // POST /admin/field-approvals/expenses/:id/decision
  router.post("/field-approvals/expenses/:id/decision", async (req, res) => {
    const parsed = z
      .object({
        decision: z.enum(["approved", "rejected"]),
        note: z.string().trim().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) return res.status(400).json({ error: "Invalid expense decision" });

    try {
      const expense = await prisma.fieldExpense.findUnique({
        where: { id: req.params.id },
      });
      if (!expense) return res.status(404).json({ error: "Expense claim not found" });

      const updated = await prisma.fieldExpense.update({
        where: { id: req.params.id },
        data: {
          status: parsed.data.decision as any,
          decisionNote: parsed.data.note || (parsed.data.decision === "approved" ? "Approved by Admin" : "Rejected by Admin"),
          decidedAt: new Date(),
        },
      });

      res.json({ ok: true, expense: updated });
    } catch (err) {
      res.status(500).json({ error: "Failed to record expense decision", detail: String(err) });
    }
  });

  // GET /admin/field-approvals/leaves
  router.get("/field-approvals/leaves", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const where: any = {};
      if (status && status !== "all") where.status = status;

      const leaves = await prisma.leaveRequest.findMany({
        where,
        include: {
          salesperson: { select: { id: true, name: true, phone: true } },
          decidedBy: { select: { id: true, name: true } },
        },
        orderBy: [{ createdAt: "desc" }],
      });

      const metrics = {
        totalLeaves: leaves.length,
        pendingLeaves: leaves.filter((l) => l.status === "pending").length,
        approvedLeaves: leaves.filter((l) => l.status === "approved").length,
        rejectedLeaves: leaves.filter((l) => l.status === "rejected").length,
      };

      res.json({
        metrics,
        leaves: leaves.map((l) => ({
          id: l.id,
          salespersonId: l.salespersonId,
          salespersonName: l.salesperson.name,
          salespersonPhone: l.salesperson.phone,
          fromDate: l.fromDate,
          toDate: l.toDate,
          type: l.type,
          reason: l.reason,
          status: l.status,
          decidedAt: l.decidedAt,
          decidedByName: l.decidedBy?.name || null,
          decisionNote: l.decisionNote,
          createdAt: l.createdAt,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to list leave requests", detail: String(err) });
    }
  });

  // POST /admin/field-approvals/leaves/:id/decision
  router.post("/field-approvals/leaves/:id/decision", async (req, res) => {
    const parsed = z
      .object({
        decision: z.enum(["approved", "rejected"]),
        note: z.string().trim().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) return res.status(400).json({ error: "Invalid leave decision" });

    try {
      const leave = await prisma.leaveRequest.findUnique({
        where: { id: req.params.id },
      });
      if (!leave) return res.status(404).json({ error: "Leave request not found" });

      const updated = await prisma.leaveRequest.update({
        where: { id: req.params.id },
        data: {
          status: parsed.data.decision as any,
          decisionNote: parsed.data.note || (parsed.data.decision === "approved" ? "Approved by Admin" : "Rejected by Admin"),
          decidedAt: new Date(),
        },
      });

      res.json({ ok: true, leave: updated });
    } catch (err) {
      res.status(500).json({ error: "Failed to record leave decision", detail: String(err) });
    }
  });

  return router;
}
