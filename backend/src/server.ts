import "dotenv/config";
import { createApp } from "./app";
import { prisma } from "./lib/prisma";
import { loadEnv } from "./platform/config/env";

const env = loadEnv();
const server = createApp({ corsOrigins: env.CORS_ORIGINS }).listen(env.PORT, () => {
  console.log(`Gagan backend listening on http://localhost:${env.PORT}`);
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; shutting down API`);

  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
