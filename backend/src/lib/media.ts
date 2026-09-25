import type { Request } from "express";

/**
 * Demo/local catalog images are stored as root-relative paths so the same
 * product rows work on localhost, over USB port forwarding, and in a hosted
 * deployment. Absolute SAP/CDN URLs pass through unchanged.
 */
export function publicMediaUrl(req: Request, value: string | null): string | null {
  if (!value || !value.startsWith("/")) return value;
  const forwardedProto = req.header("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || req.protocol;
  return `${protocol}://${req.get("host")}${value}`;
}
