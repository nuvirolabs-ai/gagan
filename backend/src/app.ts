import "express-async-errors";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import adminAuthRoutes from "./routes/admin/auth";
import adminCatalogRoutes from "./routes/admin/catalog";
import adminOrderRoutes from "./routes/admin/orders";
import adminRetailerRoutes from "./routes/admin/retailers";
import adminSapRoutes from "./routes/admin/sap";
import authRoutes from "./routes/auth";
import catalogRoutes from "./routes/catalog";
import deliveryRoutes from "./routes/delivery";
import homeRoutes from "./routes/home";
import ledgerRoutes from "./routes/ledger";
import orderRoutes from "./routes/orders";
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

  app.use("/rep", repRoutes);

  app.use("/admin", adminAuthRoutes);
  app.use("/admin", adminOrderRoutes);
  app.use("/admin", adminRetailerRoutes);
  app.use("/admin", adminCatalogRoutes);
  app.use("/admin", adminSapRoutes);

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
