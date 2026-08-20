import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { StaffAuthedRequest } from "../../identity/permissions";
import { Permissions } from "../../identity/roleCatalog";
import { FinancialCorrectionError } from "../creditNoteService";
import { createFinancialCorrectionsRouter } from "../financialCorrectionsRoutes";

function setup(permissions = [Permissions.FINANCIAL_CORRECT]) {
  const service = {
    listTargets: vi.fn().mockResolvedValue([{ id: "retailer-1" }]),
    issueCreditNote: vi.fn().mockResolvedValue({ id: "credit-1" }),
    reversePayment: vi.fn().mockResolvedValue({ id: "reversal-1" }),
  };
  const app = express();
  app.use(express.json());
  app.use(
    createFinancialCorrectionsRouter({
      service,
      authenticate: (req: StaffAuthedRequest, _res, next) => {
        req.staffAuth = {
          staffId: "staff-accounts",
          permissions,
          delegationIds: [],
        };
        next();
      },
    })
  );
  return { app, service };
}

describe("financial correction routes", () => {
  it("requires financial.correct even for an authenticated staff member", async () => {
    const { app, service } = setup([]);

    const response = await request(app).post("/financial/credit-notes").send({
      invoiceId: "invoice-1",
      amount: 100,
      reason: "Verified shortage",
      idempotencyKey: "credit-request-1",
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "permission_required",
      permission: Permissions.FINANCIAL_CORRECT,
    });
    expect(service.issueCreditNote).not.toHaveBeenCalled();
  });

  it("lists only correction targets through the protected surface", async () => {
    const { app, service } = setup();

    const response = await request(app).get("/financial/correction-targets");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ retailers: [{ id: "retailer-1" }] });
    expect(service.listTargets).toHaveBeenCalledOnce();
  });

  it("uses the authenticated actor for a credit note", async () => {
    const { app, service } = setup();

    const response = await request(app).post("/financial/credit-notes").send({
      invoiceId: "invoice-1",
      amount: 100,
      reason: "Verified shortage",
      idempotencyKey: "credit-request-1",
    });

    expect(response.status).toBe(201);
    expect(service.issueCreditNote).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: "invoice-1",
        amount: 100,
        reason: "Verified shortage",
        idempotencyKey: "credit-request-1",
        actorStaffId: "staff-accounts",
        occurredAt: expect.any(Date),
      })
    );
  });

  it("returns a safe conflict response when a reversal exceeds the payment", async () => {
    const { app, service } = setup();
    service.reversePayment.mockRejectedValue(
      new FinancialCorrectionError("payment_reversal_exceeds_settled_amount")
    );

    const response = await request(app).post("/financial/payment-reversals").send({
      paymentId: "payment-1",
      amount: 301,
      reason: "Bank reversal notice",
      idempotencyKey: "reversal-request-1",
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "payment_reversal_exceeds_settled_amount" });
  });
});
