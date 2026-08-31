import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { asyncRoute } from "../../platform/http/asyncRoute";
import { requirePermission, type StaffAuthedRequest } from "../identity/permissions";
import { Permissions } from "../identity/roleCatalog";
import { prisma } from "../../lib/prisma";
import { defaultFieldServices, sendFieldError, type FieldServices } from "./fieldRoutes";
import { FieldServiceError } from "./attendanceService";
import { startOfDay } from "./fieldDomain";

const isoDate = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: "invalid_date" })
  .transform((value) => new Date(value));

function parseDateParam(value: unknown, fallback: Date): Date {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return fallback;
  return new Date(value);
}

/**
 * The back-office half of the field module: planning a team's day and
 * reviewing what it did. These permissions are deliberately not held by the
 * roles that do the field work, so nobody approves their own leave, expense or
 * route.
 */
export function createFieldAdminRouter(options: {
  authenticate: RequestHandler;
  services?: Partial<FieldServices>;
}) {
  const services = { ...defaultFieldServices, ...options.services };
  const router = Router();
  router.use(options.authenticate);

  /* ------------------------------ attendance ------------------------------ */

  router.get(
    "/field/attendance",
    requirePermission(Permissions.ATTENDANCE_REVIEW),
    asyncRoute(async (req, res, next) => {
      const date = parseDateParam(req.query.date, new Date());
      try {
        res.json({
          date: startOfDay(date).toISOString().slice(0, 10),
          team: await services.attendance.teamAttendance(date),
        });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  router.get(
    "/field/attendance/:salespersonId",
    requirePermission(Permissions.ATTENDANCE_REVIEW),
    asyncRoute(async (req, res, next) => {
      const to = parseDateParam(req.query.to, new Date());
      const from = parseDateParam(
        req.query.from,
        new Date(startOfDay(to).getTime() - 29 * 86_400_000)
      );
      try {
        res.json({
          days: await services.attendance.attendanceHistory({
            salespersonId: req.params.salespersonId,
            from,
            to,
          }),
        });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  /* --------------------------------- leave -------------------------------- */

  router.get(
    "/field/leave",
    requirePermission(Permissions.ATTENDANCE_REVIEW),
    asyncRoute(async (req, res, next) => {
      try {
        res.json({
          requests: await services.attendance.listLeave({
            status: typeof req.query.status === "string" ? req.query.status : undefined,
          }),
        });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  router.post(
    "/field/leave/:id/decision",
    requirePermission(Permissions.ATTENDANCE_REVIEW),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const parsed = z
        .object({
          decision: z.enum(["approved", "rejected"]),
          note: z.string().trim().max(500).optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      try {
        res.json({
          request: await services.attendance.decideLeave({
            leaveId: req.params.id,
            decidedByStaffId: req.staffAuth!.staffId,
            ...parsed.data,
          }),
        });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  /* --------------------------------- routes ------------------------------- */

  router.get(
    "/field/routes",
    requirePermission(Permissions.ROUTE_MANAGE),
    asyncRoute(async (req, res, next) => {
      const to = parseDateParam(req.query.to, new Date());
      const from = parseDateParam(req.query.from, new Date(startOfDay(to).getTime() - 6 * 86_400_000));
      try {
        res.json({
          plans: await services.routes.listPlans({
            salespersonId:
              typeof req.query.salespersonId === "string" ? req.query.salespersonId : undefined,
            from,
            to,
          }),
        });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  router.post(
    "/field/routes",
    requirePermission(Permissions.ROUTE_MANAGE),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const parsed = z
        .object({
          salespersonId: z.string().uuid(),
          planDate: isoDate,
          name: z.string().trim().max(120).optional(),
          stops: z
            .array(
              z.object({
                retailerId: z.string().uuid(),
                purpose: z
                  .enum(["sales_call", "collection", "service", "onboarding", "merchandising", "other"])
                  .optional(),
                note: z.string().trim().max(300).optional(),
              })
            )
            .min(1)
            .max(60),
        })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      try {
        const plan = await services.routes.upsertPlan({
          ...parsed.data,
          createdByStaffId: req.staffAuth!.staffId,
        });
        res.status(201).json({ plan });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  router.post(
    "/field/routes/:id/publish",
    requirePermission(Permissions.ROUTE_MANAGE),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      try {
        res.json({
          plan: await services.routes.publishPlan({
            planId: req.params.id,
            actorStaffId: req.staffAuth!.staffId,
          }),
        });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  /* --------------------------------- tasks -------------------------------- */

  router.get(
    "/field/tasks",
    requirePermission(Permissions.ROUTE_MANAGE),
    asyncRoute(async (req, res, next) => {
      try {
        res.json({
          tasks: await services.tasks.list({
            assignedToStaffId:
              typeof req.query.salespersonId === "string" ? req.query.salespersonId : undefined,
            status: typeof req.query.status === "string" ? req.query.status : undefined,
          }),
        });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  router.post(
    "/field/tasks",
    requirePermission(Permissions.ROUTE_MANAGE),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const parsed = z
        .object({
          assignedToStaffId: z.string().uuid(),
          title: z.string().trim().min(3).max(160),
          description: z.string().trim().max(1000).optional(),
          retailerId: z.string().uuid().optional(),
          priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
          dueAt: isoDate.optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      try {
        const task = await services.tasks.assign({
          ...parsed.data,
          createdByStaffId: req.staffAuth!.staffId,
        });
        res.status(201).json({ task });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  router.post(
    "/field/tasks/:id/cancel",
    requirePermission(Permissions.ROUTE_MANAGE),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      try {
        res.json({
          task: await services.tasks.cancel({
            taskId: req.params.id,
            actorStaffId: req.staffAuth!.staffId,
          }),
        });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  /* -------------------------------- expenses ------------------------------ */

  router.get(
    "/field/expenses",
    requirePermission(Permissions.EXPENSE_REVIEW),
    asyncRoute(async (req, res, next) => {
      try {
        res.json({
          expenses: await services.expenses.list({
            status: typeof req.query.status === "string" ? req.query.status : undefined,
            salespersonId:
              typeof req.query.salespersonId === "string" ? req.query.salespersonId : undefined,
          }),
        });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  router.post(
    "/field/expenses/:id/decision",
    requirePermission(Permissions.EXPENSE_REVIEW),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const parsed = z
        .object({
          decision: z.enum(["approved", "rejected"]),
          note: z.string().trim().max(500).optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      try {
        res.json({
          expense: await services.expenses.decide({
            expenseId: req.params.id,
            decidedByStaffId: req.staffAuth!.staffId,
            ...parsed.data,
          }),
        });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  /* --------------------------------- issues ------------------------------- */

  router.get(
    "/field/issues",
    requirePermission(Permissions.ISSUE_REVIEW),
    asyncRoute(async (req, res, next) => {
      try {
        res.json({
          issues: await services.issues.list({
            status: typeof req.query.status === "string" ? req.query.status : undefined,
            retailerId: typeof req.query.retailerId === "string" ? req.query.retailerId : undefined,
          }),
        });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  router.post(
    "/field/issues/:id/status",
    requirePermission(Permissions.ISSUE_REVIEW),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const parsed = z
        .object({
          status: z.enum(["in_progress", "resolved", "closed", "rejected"]),
          assignedTeam: z.string().trim().max(80).optional(),
          resolutionNote: z.string().trim().max(1000).optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      try {
        res.json({
          issue: await services.issues.updateStatus({
            issueId: req.params.id,
            actorStaffId: req.staffAuth!.staffId,
            ...parsed.data,
          }),
        });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  /* -------------------------------- tracking ------------------------------ */

  router.get(
    "/field/tracking/live",
    requirePermission(Permissions.LOCATION_VIEW),
    asyncRoute(async (_req, res, next) => {
      try {
        res.json({ salespeople: await services.tracking.lastKnownPositions() });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  router.get(
    "/field/tracking/:salespersonId",
    requirePermission(Permissions.LOCATION_VIEW),
    asyncRoute(async (req, res, next) => {
      const date = parseDateParam(req.query.date, new Date());
      try {
        const history = await services.tracking.history({
          salespersonId: req.params.salespersonId,
          date,
        });
        res.json({
          session: history.session,
          pings: history.pings.map((ping: any) => ({
            recordedAt: ping.recordedAt,
            latitude: Number(ping.latitude),
            longitude: Number(ping.longitude),
            accuracyMeters: Number(ping.accuracyMeters),
            speedMps: ping.speedMps == null ? null : Number(ping.speedMps),
          })),
        });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  /* --------------------------------- team --------------------------------- */

  router.get(
    "/field/team",
    requirePermission(Permissions.ATTENDANCE_REVIEW),
    asyncRoute(async (req, res, next) => {
      const to = parseDateParam(req.query.to, new Date());
      const from = parseDateParam(req.query.from, startOfDay(to));
      try {
        const team = await services.attendance.teamAttendance(to);
        const members = await Promise.all(
          team.map(async (member: any) => ({
            ...member,
            metrics: await services.dashboard.metricsFor({
              salespersonId: member.salespersonId,
              from,
              to,
            }),
            route: await services.routes.routeForDate(member.salespersonId, to),
          }))
        );
        res.json({
          from: from.toISOString(),
          to: to.toISOString(),
          members: members.map((member) => ({
            ...member,
            // The team view reports route progress, not the full stop list.
            route: member.route
              ? { id: member.route.id, status: member.route.status, progress: member.route.progress }
              : null,
          })),
        });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  /* -------------------------------- targets ------------------------------- */

  router.get(
    "/field/targets",
    requirePermission(Permissions.ROUTE_MANAGE),
    asyncRoute(async (req, res, next) => {
      try {
        const targets = await prisma.salesTarget.findMany({
          where:
            typeof req.query.salespersonId === "string"
              ? { salespersonId: req.query.salespersonId }
              : {},
          include: { salesperson: { select: { id: true, name: true } } },
          orderBy: [{ periodStart: "desc" }, { metric: "asc" }],
          take: 200,
        });
        res.json({
          targets: targets.map((target) => ({ ...target, targetValue: Number(target.targetValue) })),
        });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  router.post(
    "/field/targets",
    requirePermission(Permissions.ROUTE_MANAGE),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const parsed = z
        .object({
          salespersonId: z.string().uuid(),
          metric: z.enum(["order_value", "visits", "collection_value", "new_customers"]),
          periodStart: isoDate,
          periodEnd: isoDate,
          targetValue: z.number().finite().positive(),
        })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      try {
        const periodStart = startOfDay(parsed.data.periodStart);
        const periodEnd = startOfDay(parsed.data.periodEnd);
        if (periodEnd < periodStart) throw new FieldServiceError("target_period_invalid", 400);
        const target = await prisma.salesTarget.upsert({
          where: {
            salespersonId_metric_periodStart_periodEnd: {
              salespersonId: parsed.data.salespersonId,
              metric: parsed.data.metric,
              periodStart,
              periodEnd,
            },
          },
          create: {
            salespersonId: parsed.data.salespersonId,
            metric: parsed.data.metric,
            periodStart,
            periodEnd,
            targetValue: parsed.data.targetValue,
            createdByStaffId: req.staffAuth!.staffId,
          },
          update: { targetValue: parsed.data.targetValue },
        });
        res.status(201).json({ target: { ...target, targetValue: Number(target.targetValue) } });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  return router;
}
