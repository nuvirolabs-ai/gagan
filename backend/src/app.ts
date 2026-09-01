import "express-async-errors";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import path from "node:path";
import adminAuthRoutes from "./routes/admin/auth";
import adminCatalogRoutes from "./routes/admin/catalog";
import adminOrderRoutes from "./routes/admin/orders";
import adminRetailerRoutes from "./routes/admin/retailers";
import adminSapRoutes from "./routes/admin/sap";
import { createAdminStaffRouter } from "./modules/identity/adminStaffRoutes";
import { StaffManagementService } from "./modules/identity/staffManagementService";
import { requireAdmin, requireAdminIdentity } from "./lib/adminAuth";
import { createFinancialCorrectionsRouter } from "./modules/payments/financialCorrectionsRoutes";
import { createApprovalsRouter } from "./modules/approvals/approvalRoutes";
import { createCollectionRouter } from "./modules/collections/collectionRoutes";
import { createKycRouter } from "./modules/kyc/kycRoutes";
import { createRecoveryRouter } from "./modules/recovery/recoveryRoutes";
import { createLocationRouter } from "./modules/location/locationRoutes";
import { LocationService } from "./modules/location/locationService";
import { loadLocationConfig } from "./modules/location/locationConfig";
import { createFieldRouter } from "./modules/field/fieldRoutes";
import { createFieldAdminRouter } from "./modules/field/fieldAdminRoutes";
import {
  createPerformanceRouter,
  createSalesLeaderRouter,
} from "./modules/performance/performanceRoutes";
import {
  createRetailerProposalAdminRouter,
  createRetailerProposalRouter,
} from "./modules/customers/proposalRoutes";
import { defaultRouteService } from "./modules/field/routeService";
import { prisma } from "./lib/prisma";
import { createRatingRouter } from "./modules/credit/ratingRoutes";
import { createCreditRolloutRouter } from "./modules/credit/rolloutRoutes";
import { createRequireSession } from "./modules/identity/sessionAuth";
import { lazyIdentitySessionService } from "./modules/identity/sessionRuntime";
import authRoutes from "./routes/auth";
import catalogRoutes from "./routes/catalog";
import deliveryRoutes from "./routes/delivery";
import homeRoutes from "./routes/home";
import ledgerRoutes from "./routes/ledger";
import orderRoutes from "./routes/orders";
import { requireAuth } from "./lib/auth";
import paymentRoutes from "./routes/payments";
import repRoutes from "./routes/rep";
import {
  databaseReadiness,
  ReadinessProbe,
  readinessHandler,
} from "./platform/health/readiness";
import { requestId } from "./platform/http/requestId";

interface CreateAppOptions {
  readinessProbe?: ReadinessProbe;
  corsOrigins?: string[];
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();

  app.use(requestId);
  app.use(helmet());
  app.use(cors({ origin: options.corsOrigins ?? [], credentials: true }));
  // Keep the default request body small. KYC evidence is the only JSON route
  // that accepts a bounded base64 payload, so opt it into the larger parser
  // before the default parser runs.
  app.use("/rep/kyc", express.json({ limit: "15mb" }));
  // Attendance photos and expense receipts are bounded base64 payloads, the
  // same shape as KYC evidence.
  app.use("/rep/field/attendance", express.json({ limit: "8mb" }));
  app.use("/rep/field/expenses", express.json({ limit: "15mb" }));
  app.use("/admin/kyc", express.json({ limit: "15mb" }));
  app.use(express.json({ limit: "100kb" }));

  // The demo catalog ships with local product photography. SAP/CDN image
  // URLs still pass through the catalog payload unchanged when synced later.
  app.use(
    "/catalog-images",
    express.static(path.resolve(__dirname, "../assets/catalog"), {
      maxAge: "1d",
    })
  );

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.get("/health/live", (_req, res) => res.json({ ok: true }));
  app.get("/health/ready", readinessHandler(options.readinessProbe ?? databaseReadiness));

  app.use("/auth", authRoutes);
  app.use(homeRoutes);
  app.use(catalogRoutes);
  app.use(orderRoutes);
  app.use(ledgerRoutes);
  app.use(deliveryRoutes);
  app.use(paymentRoutes);

  // Composition root for the visit/day-plan seam: checking in at a store also
  // settles that store's planned route stop, without the location module
  // depending on the field module.
  const locationService = new LocationService(prisma, loadLocationConfig(), {
    afterCheckIn: (visit) =>
      defaultRouteService.linkVisitToPlannedStop({
        visitId: visit.id,
        salespersonId: visit.salespersonId,
        retailerId: visit.retailerId,
      }),
  });

  app.use(
    createLocationRouter({
      service: locationService,
      retailerAuthenticate: requireAuth,
      staffAuthenticate: createRequireSession("staff", lazyIdentitySessionService),
      adminAuthenticate: requireAdminIdentity,
    })
  );

  app.use("/rep", repRoutes);
  app.use(
    "/rep",
    createApprovalsRouter({
      authenticate: createRequireSession("staff", lazyIdentitySessionService),
    })
  );
  app.use(
    "/rep",
    createCollectionRouter({
      authenticate: createRequireSession("staff", lazyIdentitySessionService),
    })
  );
  app.use(
    "/rep",
    createKycRouter({
      authenticate: createRequireSession("staff", lazyIdentitySessionService),
    })
  );
  app.use(
    "/rep",
    createRecoveryRouter({
      authenticate: createRequireSession("staff", lazyIdentitySessionService),
    })
  );
  app.use(
    "/rep",
    createRatingRouter({
      authenticate: createRequireSession("staff", lazyIdentitySessionService),
    })
  );
  app.use(
    "/rep",
    createFieldRouter({
      authenticate: createRequireSession("staff", lazyIdentitySessionService),
    })
  );
  app.use(
    "/rep",
    createPerformanceRouter({
      authenticate: createRequireSession("staff", lazyIdentitySessionService),
    })
  );
  app.use(
    "/rep",
    createRetailerProposalRouter({
      authenticate: createRequireSession("staff", lazyIdentitySessionService),
    })
  );

  app.use("/admin", adminAuthRoutes);
  app.use(
    "/admin",
    createFinancialCorrectionsRouter({ authenticate: requireAdminIdentity })
  );
  app.use(
    "/admin",
    createApprovalsRouter({ authenticate: requireAdminIdentity })
  );
  app.use(
    "/admin",
    createCollectionRouter({ authenticate: requireAdminIdentity })
  );
  app.use(
    "/admin",
    createKycRouter({ authenticate: requireAdminIdentity })
  );
  app.use(
    "/admin",
    createRecoveryRouter({ authenticate: requireAdminIdentity })
  );
  app.use(
    "/admin",
    createRatingRouter({ authenticate: requireAdminIdentity })
  );
  app.use(
    "/admin",
    createCreditRolloutRouter({ authenticate: requireAdminIdentity })
  );
  app.use("/admin", createFieldAdminRouter({ authenticate: requireAdminIdentity }));
  app.use("/admin", createSalesLeaderRouter({ authenticate: requireAdminIdentity }));
  app.use("/admin", createRetailerProposalAdminRouter({ authenticate: requireAdminIdentity }));
  app.use("/admin", adminOrderRoutes);
  app.use("/admin", adminRetailerRoutes);
  app.use("/admin", adminCatalogRoutes);
  app.use("/admin", adminSapRoutes);
  app.use(
    "/admin",
    createAdminStaffRouter({
      service: new StaffManagementService(),
      authenticate: requireAdmin,
    })
  );

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error("Unhandled error:", err);
      if (res.headersSent) return;
      res.status(500).json({ error: "Something went wrong" });
    }
  );

  return app;
}
