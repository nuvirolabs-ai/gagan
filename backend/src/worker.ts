import "dotenv/config";
import { startScheduledJobs } from "./jobs";
import { prisma } from "./lib/prisma";
import { loadEnv } from "./platform/config/env";

loadEnv();
const stopJobs = startScheduledJobs();
console.log("Gagan worker started");

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; shutting down worker`);
  stopJobs();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
