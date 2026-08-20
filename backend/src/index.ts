import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import homeRoutes from "./routes/home";
import catalogRoutes from "./routes/catalog";
import orderRoutes from "./routes/orders";
import ledgerRoutes from "./routes/ledger";
import deliveryRoutes from "./routes/delivery";
import paymentRoutes from "./routes/payments";
import repRoutes from "./routes/rep";
import adminAuthRoutes from "./routes/admin/auth";
import adminSapRoutes from "./routes/admin/sap";
import { startScheduledJobs } from "./jobs";
import adminOrderRoutes from "./routes/admin/orders";
import adminRetailerRoutes from "./routes/admin/retailers";
import adminCatalogRoutes from "./routes/admin/catalog";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

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

// Anything that reaches here threw. Log it server-side and return a generic
// message rather than leaking stack traces or Prisma internals to the client.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Something went wrong" });
});

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`Gagan backend listening on http://localhost:${port}`);
  startScheduledJobs();
});
