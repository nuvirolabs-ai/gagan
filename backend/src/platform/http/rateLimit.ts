import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

type RateLimitOptions = {
  name: string;
  limit: number;
  windowMs: number;
  now?: () => number;
  key?: (req: any) => string;
};

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const now = options.now ?? Date.now;
  return (req, res, next) => {
    const authedReq = req as any;
    const identity = options.key?.(req) ?? authedReq.retailerId ?? authedReq.staffId ?? authedReq.adminId ?? req.ip ?? "unknown";
    const bucketKey = `${options.name}:${identity}`;
    const current = now();
    const bucket = buckets.get(bucketKey);
    if (!bucket || bucket.resetAt <= current) {
      buckets.set(bucketKey, { count: 1, resetAt: current + options.windowMs });
      return next();
    }
    if (bucket.count < options.limit) {
      bucket.count += 1;
      return next();
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - current) / 1000));
    const requestId = res.locals?.requestId ?? randomUUID();
    res.setHeader("retry-after", String(retryAfterSeconds));
    res.setHeader("x-request-id", requestId);
    return res.status(429).json({ error: "rate_limited", requestId, retryAfterSeconds });
  };
}

export function resetRateLimits() {
  buckets.clear();
}
