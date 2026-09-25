import { Router, type ErrorRequestHandler, type RequestHandler } from "express";
import { z } from "zod";
import { asyncRoute } from "../../platform/http/asyncRoute";
import { prisma } from "../../lib/prisma";
import { requirePermission, type StaffAuthedRequest } from "../identity/permissions";
import { Permissions } from "../identity/roleCatalog";
import {
  FinancialCorrectionError,
  issueCreditNote,
  type IssueCreditNoteInput,
} from "./creditNoteService";
import { reversePayment, type ReversePaymentInput } from "./reversalService";

export interface FinancialCorrectionsService {
  listTargets(): Promise<unknown[]>;
  issueCreditNote(input: IssueCreditNoteInput): Promise<unknown>;
  reversePayment(input: ReversePaymentInput): Promise<unknown>;
}

interface FinancialCorrectionsRouterOptions {
  service?: FinancialCorrectionsService;
  authenticate: RequestHandler;
}

const defaultService: FinancialCorrectionsService = {
  listTargets: listCorrectionTargets,
  issueCreditNote,
  reversePayment,
};

export async function listCorrectionTargets() {
  const retailers = await prisma.retailer.findMany({
    where: {
      OR: [
        { invoices: { some: { status: { not: "voided" } } } },
        { payments: { some: { status: "succeeded" } } },
      ],
    },
    orderBy: { name: "asc" },
    include: {
      invoices: {
        where: { status: { not: "voided" } },
        orderBy: { invoiceDate: "desc" },
        include: { creditNotes: { where: { status: "issued" } } },
      },
      payments: {
        where: { status: "succeeded" },
        orderBy: { settledAt: "desc" },
        include: { reversals: true },
      },
    },
  });

  return retailers
    .map((retailer) => ({
      id: retailer.id,
      name: retailer.name,
      currentBalance: Number(retailer.currentBalance),
      invoices: retailer.invoices
        .map((invoice) => ({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.invoiceDate,
          total: Number(invoice.total),
          outstandingAmount: Number(invoice.outstandingAmount),
          status: invoice.status,
          creditableAmount:
            Math.round(
              (Number(invoice.total) -
                invoice.creditNotes.reduce(
                  (sum, creditNote) => sum + Number(creditNote.amount),
                  0
                )) *
                100
            ) / 100,
        }))
        .filter((invoice) => invoice.creditableAmount > 0),
      payments: retailer.payments
        .map((payment) => ({
          id: payment.id,
          amount: Number(payment.amount),
          channel: payment.channel,
          providerRef: payment.providerRef,
          settledAt: payment.settledAt,
          reversibleAmount:
            Math.round(
              (Number(payment.amount) -
                payment.reversals.reduce(
                  (sum, reversal) => sum + Number(reversal.amount),
                  0
                )) *
                100
            ) / 100,
        }))
        .filter((payment) => payment.reversibleAmount > 0),
    }))
    .filter((retailer) => retailer.invoices.length > 0 || retailer.payments.length > 0);
}

const correctionSchema = z.object({
  amount: z.number().finite().positive().multipleOf(0.01),
  reason: z.string().trim().min(5).max(500),
  idempotencyKey: z.string().trim().min(8).max(100),
});

export function createFinancialCorrectionsRouter(
  options: FinancialCorrectionsRouterOptions
) {
  const router = Router();
  const service = options.service ?? defaultService;
  // Scoped to this router's own paths so unrelated routes on the same mount
  // prefix are not answered with 403.
  router.use("/financial", options.authenticate, requirePermission(Permissions.FINANCIAL_CORRECT));

  router.get(
    "/financial/correction-targets",
    asyncRoute(async (_req, res) => {
      res.json({ retailers: await service.listTargets() });
    })
  );

  router.post(
    "/financial/credit-notes",
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      const parsed = correctionSchema
        .extend({ invoiceId: z.string().min(1) })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

      const creditNote = await service.issueCreditNote({
        ...parsed.data,
        actorStaffId: req.staffAuth!.staffId,
        occurredAt: new Date(),
      });
      res.status(201).json({ creditNote });
    })
  );

  router.post(
    "/financial/payment-reversals",
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      const parsed = correctionSchema
        .extend({ paymentId: z.string().min(1) })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

      const paymentReversal = await service.reversePayment({
        ...parsed.data,
        actorStaffId: req.staffAuth!.staffId,
        occurredAt: new Date(),
      });
      res.status(201).json({ paymentReversal });
    })
  );

  const handleCorrectionError: ErrorRequestHandler = (error, _req, res, next) => {
    if (!(error instanceof FinancialCorrectionError)) return next(error);

    const status = error.code.endsWith("_not_found")
      ? 404
      : error.code.startsWith("invalid_") ||
          error.code.endsWith("_required") ||
          error.code === "actor_required"
        ? 400
        : 409;
    res.status(status).json({ error: error.code });
  };
  router.use(handleCorrectionError);

  return router;
}
