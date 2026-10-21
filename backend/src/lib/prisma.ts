import { PrismaClient } from "@prisma/client";

function getDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  if (url.includes("connection_limit=")) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}connection_limit=20&pool_timeout=20`;
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getDatasourceUrl(),
    },
  },
});
