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
