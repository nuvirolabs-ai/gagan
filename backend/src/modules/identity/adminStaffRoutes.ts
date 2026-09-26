import { Router, type ErrorRequestHandler, type RequestHandler } from "express";
import { z } from "zod";
import { asyncRoute } from "../../platform/http/asyncRoute";
import { requirePermission, type StaffAuthedRequest } from "./permissions";
import { Permissions } from "./roleCatalog";
import { StaffManagementError } from "./staffManagementService";

export interface StaffManagement {
  listStaff(): Promise<unknown[]>;
  listRoles(): Promise<unknown[]>;
  createStaff(input: StaffCreateInput, actorStaffId: string): Promise<unknown>;
  setStatus(id: string, status: "active" | "suspended" | "revoked", actorStaffId: string): Promise<unknown>;
  assignRole(staffId: string, roleId: string, actorStaffId: string): Promise<void>;
  removeRole(staffId: string, roleId: string, actorStaffId: string): Promise<void>;
  createDelegation(input: DelegationInput, actorStaffId: string): Promise<unknown>;
  revokeDelegation(id: string, actorStaffId: string): Promise<void>;
  setupSellingLeader(input: SellingLeaderSetupInput, actorStaffId: string): Promise<unknown>;
  setupSalesperson(input: SalespersonSetupInput, actorStaffId: string): Promise<unknown>;
  setupManagerOnly(staffId: string, actorStaffId: string): Promise<unknown>;
}

export interface SellingLeaderSetupInput {
  staffId?: string;
  newStaff?: StaffCreateInput;
  managerId?: string | null;
  reportIds?: string[];
  territory?: string;
}

export type SalespersonSetupInput = Omit<SellingLeaderSetupInput, "reportIds">;

export interface StaffCreateInput {
  name: string;
  phone: string;
  email: string;
  employeeRef?: string;
}

export interface DelegationInput {
  delegatorStaffId: string;
  delegateeStaffId: string;
  roleId: string;
  startsAt: Date;
  endsAt: Date;
}

interface AdminStaffRouterOptions {
  service: StaffManagement;
  authenticate: RequestHandler;
}

const manageStaff = requirePermission(Permissions.STAFF_MANAGE);
const sellingLeaderSetupSchema = z.object({
  managerId: z.string().uuid().nullable().optional(),
  reportIds: z.array(z.string().uuid()).max(500).optional(),
  territory: z.string().trim().max(100).optional(),
}).strict();
const salespersonSetupSchema = sellingLeaderSetupSchema.omit({ reportIds: true });

export function createAdminStaffRouter(options: AdminStaffRouterOptions) {
  const router = Router();
  // Scoped to this router's own paths so unrelated routes on the same mount
  // prefix are not answered with 403.
  router.use(["/staff", "/roles"], options.authenticate, manageStaff);

  router.get(
    "/staff",
    asyncRoute(async (_req, res) => {
      res.json({ staff: await options.service.listStaff() });
    })
  );

  router.get(
    "/roles",
    asyncRoute(async (_req, res) => {
      res.json({ roles: await options.service.listRoles() });
    })
  );

  router.post(
    "/staff",
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      const parsed = z
        .object({
          name: z.string().trim().min(2).max(100),
          phone: z.string().min(10).max(20),
          email: z.string().email(),
          employeeRef: z.string().trim().min(1).max(50).optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      const staff = await options.service.createStaff(parsed.data, req.staffAuth!.staffId);
      res.status(201).json({ staff });
    })
  );

  const setupSellingLeader: RequestHandler = asyncRoute(async (req: StaffAuthedRequest, res) => {
    const body = sellingLeaderSetupSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "invalid_input" });
    if ((body.data.managerId !== undefined || body.data.reportIds !== undefined) &&
        !req.staffAuth!.permissions.includes(Permissions.ORG_MANAGE)) {
      return res.status(403).json({ error: "permission_required", permission: Permissions.ORG_MANAGE });
    }
    const result = await options.service.setupSellingLeader(
      { staffId: req.params.id, ...body.data }, req.staffAuth!.staffId
    );
    res.json(result);
  });
  router.post("/staff/:id/selling-leader-setup", setupSellingLeader);
  router.post(
    "/staff/selling-leader-setup",
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      const parsed = sellingLeaderSetupSchema.extend({
        newStaff: z.object({
          name: z.string().trim().min(2).max(100),
          phone: z.string().min(10).max(20),
          email: z.string().email(),
          employeeRef: z.string().trim().min(1).max(50).optional(),
        }),
      }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      if ((parsed.data.managerId !== undefined || parsed.data.reportIds !== undefined) &&
          !req.staffAuth!.permissions.includes(Permissions.ORG_MANAGE)) {
        return res.status(403).json({ error: "permission_required", permission: Permissions.ORG_MANAGE });
      }
      const result = await options.service.setupSellingLeader(parsed.data, req.staffAuth!.staffId);
      res.status(201).json(result);
    })
  );
  router.post(
    "/staff/:id/salesperson-setup",
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      const parsed = salespersonSetupSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      if (parsed.data.managerId !== undefined && !req.staffAuth!.permissions.includes(Permissions.ORG_MANAGE)) {
        return res.status(403).json({ error: "permission_required", permission: Permissions.ORG_MANAGE });
      }
      res.json(await options.service.setupSalesperson({ staffId: req.params.id, ...parsed.data }, req.staffAuth!.staffId));
    })
  );
  router.post(
    "/staff/salesperson-setup",
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      const parsed = salespersonSetupSchema.extend({
        newStaff: z.object({
          name: z.string().trim().min(2).max(100),
          phone: z.string().min(10).max(20),
          email: z.string().email(),
          employeeRef: z.string().trim().min(1).max(50).optional(),
        }),
      }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      if (parsed.data.managerId !== undefined && !req.staffAuth!.permissions.includes(Permissions.ORG_MANAGE)) {
        return res.status(403).json({ error: "permission_required", permission: Permissions.ORG_MANAGE });
      }
      res.status(201).json(await options.service.setupSalesperson(parsed.data, req.staffAuth!.staffId));
    })
  );
  router.post(
    "/staff/:id/manager-only-setup",
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      const result = await options.service.setupManagerOnly(req.params.id, req.staffAuth!.staffId);
      res.json(result);
    })
  );

  router.patch(
    "/staff/:id/status",
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      const parsed = z
        .object({ status: z.enum(["active", "suspended", "revoked"]) })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      const staff = await options.service.setStatus(
        req.params.id,
        parsed.data.status,
        req.staffAuth!.staffId
      );
      res.json({ staff });
    })
  );

  router.post(
    "/staff/:id/roles",
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      const parsed = z.object({ roleId: z.string().min(1) }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      await options.service.assignRole(
        req.params.id,
        parsed.data.roleId,
        req.staffAuth!.staffId
      );
      res.status(204).send();
    })
  );

  router.delete(
    "/staff/:id/roles/:roleId",
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      await options.service.removeRole(
        req.params.id,
        req.params.roleId,
        req.staffAuth!.staffId
      );
      res.status(204).send();
    })
  );

  router.post(
    "/staff/:id/delegations",
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      const parsed = z
        .object({
          delegatorStaffId: z.string().min(1),
          roleId: z.string().min(1),
          startsAt: z.coerce.date(),
          endsAt: z.coerce.date(),
        })
        .refine((value) => value.endsAt > value.startsAt, {
          message: "endsAt must be after startsAt",
        })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      const delegation = await options.service.createDelegation(
        { ...parsed.data, delegateeStaffId: req.params.id },
        req.staffAuth!.staffId
      );
      res.status(201).json({ delegation });
    })
  );

  router.delete(
    "/staff/delegations/:id",
    asyncRoute(async (req: StaffAuthedRequest, res) => {
      await options.service.revokeDelegation(req.params.id, req.staffAuth!.staffId);
      res.status(204).send();
    })
  );

  const handleStaffManagementError: ErrorRequestHandler = (error, _req, res, next) => {
    if (error instanceof StaffManagementError) {
      res.status(error.status).json({ error: error.code });
      return;
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      res.status(409).json({ error: "identity_already_exists" });
      return;
    }
    next(error);
  };
  router.use(handleStaffManagementError);

  return router;
}
