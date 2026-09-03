import "express-async-errors";
import cors from "cors";
import express from "express";
import helmet from "helmet";
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
import { createRatingRouter } from "./modules/credit/ratingRoutes";
import { createCreditRolloutRouter } from "./modules/credit/rolloutRoutes";
import { createRetailerFormRouter } from "./modules/retailers/retailerProposalRoutes";
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
  app.use("/admin/kyc", express.json({ limit: "15mb" }));
  app.use("/rep/retailer-evidence", express.json({ limit: "15mb" }));
  app.use("/admin/retailer-evidence", express.json({ limit: "15mb" }));
  app.use(express.json({ limit: "100kb" }));

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

  app.use(
    createLocationRouter({
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
    createRetailerFormRouter({
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
    createRetailerFormRouter({ authenticate: requireAdminIdentity })
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
