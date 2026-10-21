import "dotenv/config";
import { createApp } from "./app";
import { startScheduledJobs } from "./jobs";
import { prisma } from "./lib/prisma";
import { loadEnv } from "./platform/config/env";

const env = loadEnv();
const stopJobs =
  env.NODE_ENV === "staging" && env.STAGING_RUN_JOBS_IN_API
    ? startScheduledJobs()
    : () => undefined;
const server = createApp({ corsOrigins: env.CORS_ORIGINS }).listen(env.PORT, () => {
  console.log(`Gagan backend listening on port ${env.PORT}`);

  // Auto-sync product images to variants so apps reading variant images always reflect uploads
  prisma.$executeRawUnsafe(`
    UPDATE "Variant" v
    SET "imageUrl" = p."imageUrl",
        "catalogImageStatus" = CASE WHEN p."imageUrl" IS NOT NULL THEN 'exact' ELSE v."catalogImageStatus" END
    FROM "Product" p
    WHERE v."productId" = p.id
      AND p."imageUrl" IS NOT NULL
      AND p."imageUrl" LIKE 'data:image/%';
  `).then((count) => {
    if (Number(count) > 0) console.log(`[STARTUP] Synced ${count} variant images from uploaded product images`);
  }).catch((err) => {
    console.warn("[STARTUP] Variant image sync warning:", err);
  });
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; shutting down API`);
  stopJobs();

  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
