import { Router } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../../lib/auth";
import type { IdentityAuthedRequest } from "../identity/sessionAuth";
import { Permissions } from "../identity/roleCatalog";
import { LocationServiceError, defaultLocationService, type LocationService } from "./locationService";

const coordinateSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracyMeters: z.number().finite().positive(),
});

function permission(permissionName: string) {
  return (req: IdentityAuthedRequest, res: any, next: any) => {
    if (!req.staffAuth?.permissions.includes(permissionName)) {
      return res.status(403).json({ error: "permission_required", permission: permissionName });
    }
    next();
  };
}

function sendError(error: unknown, res: any, next: any) {
  if (error instanceof LocationServiceError) return res.status(error.status).json({ error: error.code });
  return next(error);
}

export function createLocationRouter(options: {
  service?: LocationService;
  retailerAuthenticate: any;
  staffAuthenticate: any;
  adminAuthenticate: any;
}) {
  const service = options.service ?? defaultLocationService;
  const router = Router();

  router.get("/location", options.retailerAuthenticate, async (req: AuthedRequest, res, next) => {
    try { res.json({ location: await service.getLocation(req.retailerId!) }); } catch (error) { sendError(error, res, next); }
  });

  router.post("/location/capture", options.retailerAuthenticate, async (req: AuthedRequest, res, next) => {
    const parsed = coordinateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_location_coordinates" });
    try {
      const location = await service.captureLocation({ ...parsed.data, retailerId: req.retailerId!, actorUserId: req.retailerId!, source: "RETAILER_ONBOARDING" });
      res.status(201).json({ location });
    } catch (error) { sendError(error, res, next); }
  });

  router.post("/location/change-request", options.retailerAuthenticate, async (req: AuthedRequest, res, next) => {
    const parsed = z.object({ reason: z.string().trim().min(1).max(500) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "location_change_reason_required" });
    try { res.json({ location: await service.requestLocationChange(req.retailerId!, req.retailerId!, parsed.data.reason) }); } catch (error) { sendError(error, res, next); }
  });

  router.post("/location/verify", options.retailerAuthenticate, async (req: AuthedRequest, res, next) => {
    const parsed = coordinateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_location_coordinates" });
    try {
      const location = await service.verifyLocation({ ...parsed.data, retailerId: req.retailerId!, actorUserId: req.retailerId!, source: "RETAILER_ONBOARDING" });
      res.json({ location });
    } catch (error) { sendError(error, res, next); }
  });

  router.get("/rep/retailers/:retailerId/location", options.staffAuthenticate, permission(Permissions.LOCATION_VIEW), async (req: IdentityAuthedRequest, res, next) => {
    try { await service.assertAssignedSalesperson(req.identityAuth!.subjectId, req.params.retailerId); res.json({ location: await service.getLocation(req.params.retailerId) }); } catch (error) { sendError(error, res, next); }
  });

  router.post("/rep/retailers/:retailerId/location/capture", options.staffAuthenticate, permission(Permissions.LOCATION_CAPTURE), async (req: IdentityAuthedRequest, res, next) => {
    const parsed = coordinateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_location_coordinates" });
    try {
      await service.assertAssignedSalesperson(req.identityAuth!.subjectId, req.params.retailerId);
      const location = await service.captureLocation({ ...parsed.data, retailerId: req.params.retailerId, actorUserId: req.identityAuth!.subjectId, source: "SALESPERSON_VISIT" });
      res.status(201).json({ location });
    } catch (error) { sendError(error, res, next); }
  });

  router.post("/rep/retailers/:retailerId/location/verify", options.staffAuthenticate, permission(Permissions.LOCATION_VERIFY), async (req: IdentityAuthedRequest, res, next) => {
    const parsed = coordinateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_location_coordinates" });
    try {
      await service.assertAssignedSalesperson(req.identityAuth!.subjectId, req.params.retailerId);
      const location = await service.verifyLocation({ ...parsed.data, retailerId: req.params.retailerId, actorUserId: req.identityAuth!.subjectId, source: "SALESPERSON_VISIT" });
      res.json({ location });
    } catch (error) { sendError(error, res, next); }
  });

  router.post("/rep/retailers/:retailerId/check-in", options.staffAuthenticate, permission(Permissions.LOCATION_CAPTURE), async (req: IdentityAuthedRequest, res, next) => {
    const parsed = coordinateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_location_coordinates" });
    try {
      await service.assertAssignedSalesperson(req.identityAuth!.subjectId, req.params.retailerId);
      res.status(201).json({ visit: await service.checkIn({ ...parsed.data, retailerId: req.params.retailerId, salespersonId: req.identityAuth!.subjectId }) });
    } catch (error) { sendError(error, res, next); }
  });

  router.post("/rep/visits/:visitId/check-out", options.staffAuthenticate, permission(Permissions.LOCATION_CAPTURE), async (req: IdentityAuthedRequest, res, next) => {
    const parsed = coordinateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_location_coordinates" });
    try { res.json({ visit: await service.checkOut({ ...parsed.data, visitId: req.params.visitId, salespersonId: req.identityAuth!.subjectId }) }); } catch (error) { sendError(error, res, next); }
  });

  router.get("/rep/visits", options.staffAuthenticate, permission(Permissions.VISIT_VIEW), async (req: IdentityAuthedRequest, res, next) => {
    try { res.json({ visits: await service.listVisits({ salespersonId: req.identityAuth!.subjectId }) }); } catch (error) { sendError(error, res, next); }
  });

  router.get("/admin/locations", options.adminAuthenticate, permission(Permissions.LOCATION_VIEW), async (_req, res, next) => {
    try { res.json({ locations: await service.listLocations() }); } catch (error) { sendError(error, res, next); }
  });

  router.get("/admin/locations/:retailerId", options.adminAuthenticate, permission(Permissions.LOCATION_VIEW), async (req, res, next) => {
    try { res.json({ location: await service.getLocation(req.params.retailerId) }); } catch (error) { sendError(error, res, next); }
  });

  router.get("/admin/locations/:retailerId/history", options.adminAuthenticate, permission(Permissions.LOCATION_VIEW), async (req, res, next) => {
    try { res.json({ history: await service.history(req.params.retailerId) }); } catch (error) { sendError(error, res, next); }
  });

  router.post("/admin/locations/:retailerId/correct", options.adminAuthenticate, permission(Permissions.LOCATION_CAPTURE), async (req: IdentityAuthedRequest, res, next) => {
    const parsed = coordinateSchema.and(z.object({ reason: z.string().trim().min(1).max(500) })).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "location_change_reason_required" });
    try {
      const location = await service.correctLocation({ ...parsed.data, reasonForChange: parsed.data.reason, retailerId: req.params.retailerId, actorUserId: req.staffAuth!.staffId, source: "ADMIN_CORRECTION" });
      res.status(201).json({ location });
    } catch (error) { sendError(error, res, next); }
  });

  router.get("/admin/visits", options.adminAuthenticate, permission(Permissions.VISIT_VIEW), async (req, res, next) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const retailerId = typeof req.query.retailerId === "string" ? req.query.retailerId : undefined;
      const salespersonId = typeof req.query.salespersonId === "string" ? req.query.salespersonId : undefined;
      const territory = typeof req.query.territory === "string" ? req.query.territory : undefined;
      const from = typeof req.query.from === "string" && !Number.isNaN(Date.parse(req.query.from)) ? new Date(req.query.from) : undefined;
      const to = typeof req.query.to === "string" && !Number.isNaN(Date.parse(req.query.to)) ? new Date(req.query.to) : undefined;
      res.json({ visits: await service.listVisits({ verificationStatus: status, retailerId, salespersonId, territory, from, to }) });
    } catch (error) { sendError(error, res, next); }
  });

  router.get("/internal/logistics/retailers/:retailerId/location", async (req, res, next) => {
    const configuredToken = process.env.LOGISTICS_SERVICE_TOKEN;
    if (!configuredToken) return res.status(503).json({ error: "logistics_service_not_configured" });
    if (req.header("x-gagan-service-token") !== configuredToken) return res.status(401).json({ error: "service_authentication_required" });
    try {
      const location = await service.logisticsLocation(req.params.retailerId);
      if (!location) return res.status(404).json({ error: "verified_location_not_available" });
      res.json({ location });
    } catch (error) { sendError(error, res, next); }
  });

  return router;
}
