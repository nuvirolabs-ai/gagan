import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { asyncRoute } from "../../platform/http/asyncRoute";
import { requirePermission, type StaffAuthedRequest } from "../identity/permissions";
import { Permissions } from "../identity/roleCatalog";
import { createRateLimiter } from "../../platform/http/rateLimit";
import {
  AttendanceService,
  FieldServiceError,
  defaultAttendanceService,
} from "./attendanceService";
import { RouteService, defaultRouteService } from "./routeService";
import { ActivityService, defaultActivityService } from "./activityService";
import { TaskService, defaultTaskService } from "./taskService";
import { TrackingService, MAX_BATCH_SIZE, defaultTrackingService } from "./trackingService";
import { ExpenseService, defaultExpenseService } from "./expenseService";
import { IssueService, defaultIssueService } from "./issueService";
import {
  FieldDashboardService,
  defaultFieldDashboardService,
} from "./dashboardService";
import {
  SalespersonTodayService,
  defaultSalespersonTodayService,
} from "../readmodels/salespersonTodayService";
import { CUSTOMER_ACTIVITY_TYPES, startOfDay } from "./fieldDomain";

export interface FieldServices {
  attendance: AttendanceService;
  routes: RouteService;
  activities: ActivityService;
  tasks: TaskService;
  tracking: TrackingService;
  expenses: ExpenseService;
  issues: IssueService;
  dashboard: FieldDashboardService;
  /** Today is composed from the field day plus targets, standing and actions. */
  todayReadModel: SalespersonTodayService;
}

export const defaultFieldServices: FieldServices = {
  attendance: defaultAttendanceService,
  routes: defaultRouteService,
  activities: defaultActivityService,
  tasks: defaultTaskService,
  tracking: defaultTrackingService,
  expenses: defaultExpenseService,
  issues: defaultIssueService,
  dashboard: defaultFieldDashboardService,
  todayReadModel: defaultSalespersonTodayService,
};

const coordinate = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracyMeters: z.number().finite().positive(),
  devicePlatform: z.string().trim().max(30).optional(),
});

const photo = z.object({
  contentType: z.string().trim().min(3).max(60),
  bodyBase64: z.string().min(4).max(6_000_000),
});

const isoDate = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: "invalid_date" })
  .transform((value) => new Date(value));

function parseDateParam(value: unknown, fallback: Date): Date {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return fallback;
  return new Date(value);
}

export function sendFieldError(error: unknown, res: any, next: any) {
  if (error instanceof FieldServiceError) {
    return res.status(error.status).json({ error: error.code, details: error.details });
  }
  return next(error);
}

/**
 * Everything a salesperson's own app can do with their field day. Every route
 * here acts on `req.staffAuth.staffId` — a salesperson can never name another
 * salesperson in a request, so there is nothing to enforce beyond the session
 * itself and the per-action permission.
 */
export function createFieldRouter(options: {
  authenticate: RequestHandler;
  services?: Partial<FieldServices>;
}) {
  const services = { ...defaultFieldServices, ...options.services };
  const router = Router();
  router.use(options.authenticate);

  /* -------------------------------- today -------------------------------- */

  router.get(
    "/field/today",
    requirePermission(Permissions.ROUTE_EXECUTE),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      try {
        // One request for the whole screen: field day, targets, standing,
        // recognition and next best actions.
        res.json(await services.todayReadModel.load({ salespersonId: req.staffAuth!.staffId }));
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  /* ------------------------------ attendance ----------------------------- */

  router.post(
    "/field/attendance/start",
    requirePermission(Permissions.ATTENDANCE_MANAGE_SELF),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const parsed = coordinate.extend({ photo: photo.optional() }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_location_coordinates" });
      try {
        const session = await services.attendance.clockIn({
          ...parsed.data,
          salespersonId: req.staffAuth!.staffId,
        });
        res.status(201).json({ session });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  router.post(
    "/field/attendance/end",
    requirePermission(Permissions.ATTENDANCE_MANAGE_SELF),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const parsed = coordinate.extend({ photo: photo.optional() }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_location_coordinates" });
      try {
        const session = await services.attendance.clockOut({
          ...parsed.data,
          salespersonId: req.staffAuth!.staffId,
        });
        res.json({ session });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  router.get(
    "/field/attendance",
    requirePermission(Permissions.ATTENDANCE_MANAGE_SELF),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const to = parseDateParam(req.query.to, new Date());
      const from = parseDateParam(
        req.query.from,
        new Date(startOfDay(to).getTime() - 29 * 86_400_000)
      );
      try {
        res.json({
          days: await services.attendance.attendanceHistory({
            salespersonId: req.staffAuth!.staffId,
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
    requirePermission(Permissions.ATTENDANCE_MANAGE_SELF),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      try {
        res.json({
          requests: await services.attendance.listLeave({ salespersonId: req.staffAuth!.staffId }),
        });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  router.post(
    "/field/leave",
    requirePermission(Permissions.ATTENDANCE_MANAGE_SELF),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const parsed = z
        .object({
          fromDate: isoDate,
          toDate: isoDate,
          type: z.enum(["casual", "sick", "unpaid", "other"]).default("casual"),
          reason: z.string().trim().min(3).max(500),
        })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      try {
        const request = await services.attendance.requestLeave({
          ...parsed.data,
          salespersonId: req.staffAuth!.staffId,
        });
        res.status(201).json({ request });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  router.post(
    "/field/leave/:id/cancel",
    requirePermission(Permissions.ATTENDANCE_MANAGE_SELF),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      try {
        res.json({
          request: await services.attendance.cancelLeave({
            leaveId: req.params.id,
            salespersonId: req.staffAuth!.staffId,
          }),
        });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  /* --------------------------------- route -------------------------------- */

  router.get(
    "/field/route",
    requirePermission(Permissions.ROUTE_EXECUTE),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const date = parseDateParam(req.query.date, new Date());
      try {
        res.json({ route: await services.routes.routeForDate(req.staffAuth!.staffId, date) });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  router.get(
    "/field/route/history",
    requirePermission(Permissions.ROUTE_EXECUTE),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const to = parseDateParam(req.query.to, new Date());
      const from = parseDateParam(
        req.query.from,
        new Date(startOfDay(to).getTime() - 29 * 86_400_000)
      );
      try {
        res.json({ plans: await services.routes.routeHistory(req.staffAuth!.staffId, from, to) });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  router.post(
    "/field/route/stops/:id/skip",
    requirePermission(Permissions.ROUTE_EXECUTE),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const parsed = z.object({ reason: z.string().trim().min(3).max(300) }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "skip_reason_required" });
      try {
        res.json({
          stop: await services.routes.skipStop({
            stopId: req.params.id,
            salespersonId: req.staffAuth!.staffId,
            reason: parsed.data.reason,
          }),
        });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  /* ------------------------------- activities ------------------------------ */

  router.post(
    "/field/activities",
    requirePermission(Permissions.ACTIVITY_LOG),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const parsed = z
        .object({
          retailerId: z.string().uuid(),
          type: z.enum(CUSTOMER_ACTIVITY_TYPES),
          visitId: z.string().uuid().optional(),
          notes: z.string().trim().max(1000).optional(),
          followUpAt: isoDate.optional(),
          orderId: z.string().uuid().optional(),
          collectionId: z.string().uuid().optional(),
          occurredAt: isoDate.optional(),
          clientReference: z.string().trim().min(8).max(120).optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      try {
        const result = await services.activities.log({
          ...parsed.data,
          salespersonId: req.staffAuth!.staffId,
        });
        res.status(result.idempotent ? 200 : 201).json(result);
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  router.get(
    "/field/activities",
    requirePermission(Permissions.ACTIVITY_LOG),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const retailerId = typeof req.query.retailerId === "string" ? req.query.retailerId : undefined;
      try {
        res.json({
          activities: retailerId
            ? await services.activities.forRetailer({
                retailerId,
                salespersonId: req.staffAuth!.staffId,
              })
            : await services.activities.forSalesperson({ salespersonId: req.staffAuth!.staffId }),
        });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  /* --------------------------------- tasks -------------------------------- */

  router.get(
    "/field/tasks",
    requirePermission(Permissions.TASK_COMPLETE),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      try {
        res.json({
          tasks: await services.tasks.forSalesperson({
            salespersonId: req.staffAuth!.staffId,
            includeClosed: req.query.includeClosed === "true",
          }),
        });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  router.post(
    "/field/tasks/:id/status",
    requirePermission(Permissions.TASK_COMPLETE),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const parsed = z
        .object({
          status: z.enum(["in_progress", "done"]),
          note: z.string().trim().max(500).optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      try {
        res.json({
          task: await services.tasks.updateStatus({
            taskId: req.params.id,
            salespersonId: req.staffAuth!.staffId,
            ...parsed.data,
          }),
        });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  /* -------------------------------- tracking ------------------------------- */

  router.get(
    "/field/tracking/state",
    requirePermission(Permissions.ATTENDANCE_MANAGE_SELF),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      try {
        res.json(
          await services.tracking.state({
            salespersonId: req.staffAuth!.staffId,
            permissionGranted: req.query.permissionGranted !== "false",
          })
        );
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  router.post(
    "/field/tracking/pings",
    requirePermission(Permissions.ATTENDANCE_MANAGE_SELF),
    createRateLimiter({ name: "field-pings", limit: 60, windowMs: 60_000 }),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const parsed = z
        .object({
          pings: z
            .array(
              z.object({
                clientReference: z.string().trim().min(8).max(120),
                recordedAt: isoDate,
                latitude: z.number().finite().min(-90).max(90),
                longitude: z.number().finite().min(-180).max(180),
                accuracyMeters: z.number().finite().positive(),
                speedMps: z.number().finite().nonnegative().optional(),
                headingDegrees: z.number().finite().min(0).max(360).optional(),
                batteryPct: z.number().int().min(0).max(100).optional(),
              })
            )
            .max(MAX_BATCH_SIZE),
        })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      try {
        res.json(
          await services.tracking.ingest({
            salespersonId: req.staffAuth!.staffId,
            pings: parsed.data.pings,
          })
        );
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  /* -------------------------------- expenses ------------------------------- */

  router.get(
    "/field/expenses",
    requirePermission(Permissions.EXPENSE_SUBMIT),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      try {
        res.json({
          expenses: await services.expenses.list({ salespersonId: req.staffAuth!.staffId }),
        });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  router.post(
    "/field/expenses",
    requirePermission(Permissions.EXPENSE_SUBMIT),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const parsed = z
        .object({
          expenseDate: isoDate,
          category: z.enum(["travel", "fuel", "food", "lodging", "telephone", "other"]),
          amount: z.number().finite().positive(),
          description: z.string().trim().min(3).max(500),
          receipt: z
            .object({
              contentType: z.string().trim().min(3).max(60),
              bodyBase64: z.string().min(4).max(14_000_000),
              checksum: z.string().regex(/^[a-f0-9]{64}$/).optional(),
            })
            .optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      try {
        const expense = await services.expenses.submit({
          ...parsed.data,
          salespersonId: req.staffAuth!.staffId,
        });
        res.status(201).json({ expense });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  /* --------------------------------- issues -------------------------------- */

  router.get(
    "/field/issues",
    requirePermission(Permissions.ISSUE_RAISE),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      try {
        res.json({
          issues: await services.issues.list({
            salespersonId: req.staffAuth!.staffId,
            retailerId: typeof req.query.retailerId === "string" ? req.query.retailerId : undefined,
          }),
        });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  router.post(
    "/field/issues",
    requirePermission(Permissions.ISSUE_RAISE),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const parsed = z
        .object({
          retailerId: z.string().uuid(),
          type: z.enum([
            "damaged_product",
            "delivery_issue",
            "invoice_issue",
            "payment_issue",
            "quality_complaint",
            "service_request",
            "other",
          ]),
          description: z.string().trim().min(3).max(1000),
          priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
          orderId: z.string().uuid().optional(),
          invoiceId: z.string().uuid().optional(),
          visitId: z.string().uuid().optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      try {
        const issue = await services.issues.raise({
          ...parsed.data,
          salespersonId: req.staffAuth!.staffId,
        });
        res.status(201).json({ issue });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  /* ------------------------------ performance ------------------------------ */

  router.get(
    "/field/performance",
    requirePermission(Permissions.ROUTE_EXECUTE),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const now = new Date();
      const to = parseDateParam(req.query.to, now);
      const from = parseDateParam(
        req.query.from,
        new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1))
      );
      try {
        res.json(
          await services.dashboard.performance({
            salespersonId: req.staffAuth!.staffId,
            from,
            to,
          })
        );
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  router.get(
    "/field/activity-feed",
    requirePermission(Permissions.ROUTE_EXECUTE),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const to = parseDateParam(req.query.to, new Date());
      const from = parseDateParam(
        req.query.from,
        new Date(startOfDay(to).getTime() - 13 * 86_400_000)
      );
      try {
        res.json({
          entries: await services.dashboard.activityFeed({
            salespersonId: req.staffAuth!.staffId,
            from,
            to,
          }),
        });
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  router.get(
    "/field/customers/map",
    requirePermission(Permissions.LOCATION_VIEW),
    asyncRoute(async (req: StaffAuthedRequest, res, next) => {
      const latitude = Number(req.query.latitude);
      const longitude = Number(req.query.longitude);
      const origin =
        Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
      try {
        res.json(
          await services.dashboard.customerMap({
            salespersonId: req.staffAuth!.staffId,
            origin,
          })
        );
      } catch (error) {
        sendFieldError(error, res, next);
      }
    })
  );

  return router;
}
