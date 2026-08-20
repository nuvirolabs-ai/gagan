import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncRoute } from "../../platform/http/asyncRoute";
import { requirePermission, type StaffAuthedRequest } from "../identity/permissions";
import { Permissions } from "../identity/roleCatalog";
import { requireRecentStepUp } from "../identity/sessionAuth";

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function createCreditRolloutRouter(options: { authenticate: RequestHandler }) {
  const router = Router();
  router.use(options.authenticate, requirePermission(Permissions.CREDIT_RATING_CONFIRM));

  router.get("/credit/shadow-comparisons", asyncRoute(async (req, res) => {
    const comparisons = await prisma.creditDecisionComparison.findMany({
      where: { mismatch: true },
      include: {
        retailer: { select: { name: true } },
        order: { select: { orderNo: true } },
        assessment: { select: { reasons: true, projectedExposure: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 1_000,
    });
    if (req.query.format === "csv") {
      const rows = [
        ["created_at", "retailer", "order_no", "legacy", "engine", "effective", "reasons", "disposition"],
        ...comparisons.map((item) => [
          item.createdAt.toISOString(), item.retailer.name, item.order?.orderNo ?? "",
          item.legacyResult, item.engineResult, item.effectiveResult,
          JSON.stringify(item.assessment.reasons), item.creditTeamDisposition ?? "",
        ]),
      ];
      res.type("text/csv").send(rows.map((row) => row.map(csvCell).join(",")).join("\n"));
      return;
    }
    res.json({ comparisons });
  }));

  router.patch("/credit/shadow-comparisons/:id", asyncRoute(async (req, res) => {
    const parsed = z.object({ disposition: z.string().trim().min(3) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
    res.json({ comparison: await prisma.creditDecisionComparison.update({
      where: { id: req.params.id }, data: { creditTeamDisposition: parsed.data.disposition },
    }) });
  }));

  router.post(
    "/credit/activate-enforcement",
    requireRecentStepUp,
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      const parsed = z.object({ policyVersion: z.number().int().positive(), signedStatement: z.literal("I approve enforcement of this policy") }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "signed_policy_approval_required" });
      const policy = await prisma.creditPolicyVersion.findFirst({ where: { active: true } });
      if (!policy || policy.version !== parsed.data.policyVersion) return res.status(409).json({ error: "active_policy_version_mismatch" });
      const appConfig = await prisma.appConfig.findUnique({ where: { id: "singleton" }, select: { id: true } });
      if (!appConfig) return res.status(409).json({ error: "app_config_missing" });
      const now = new Date();
      await prisma.appConfig.update({
        where: { id: "singleton" },
        data: {
          creditRolloutMode: "enforce",
          creditPolicyApprovedAt: now,
          creditPolicyApprovedByStaffId: req.staffAuth!.staffId,
          creditPolicyApprovedVersion: policy.version,
        },
      });
      await prisma.auditEvent.create({
        data: {
          actorStaffId: req.staffAuth!.staffId,
          action: "credit_policy.enforcement_activated",
          subjectType: "credit_policy_version",
          subjectId: policy.id,
          metadata: { version: policy.version, signedStatement: parsed.data.signedStatement },
        },
      });
      res.json({ mode: "enforce", policyVersion: policy.version, approvedAt: now });
    })
  );
  return router;
}
