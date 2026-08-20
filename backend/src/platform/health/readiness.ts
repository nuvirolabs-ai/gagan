import { RequestHandler } from "express";
import { prisma } from "../../lib/prisma";

export type ReadinessProbe = () => Promise<void>;

export const databaseReadiness: ReadinessProbe = async () => {
  await prisma.$queryRaw`SELECT 1`;
};

export function readinessHandler(probe: ReadinessProbe): RequestHandler {
  return async (_req, res) => {
    try {
      await probe();
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  };
}
