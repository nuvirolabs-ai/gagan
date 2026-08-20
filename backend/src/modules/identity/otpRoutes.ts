import { randomUUID } from "node:crypto";
import { Router, type Request } from "express";
import { z } from "zod";
import { asyncRoute } from "../../platform/http/asyncRoute";
import { OtpError } from "./otpService";

type Realm = "retailer" | "staff" | "admin";

export interface OtpRouteService {
  request(input: {
    realm: Realm;
    phone: string;
    correlationId: string;
    requestIp?: string;
    accountExists: boolean;
  }): Promise<{ accepted: true; challengeId?: string }>;
  verify(input: {
    challengeId: string;
    realm: Realm;
    phone: string;
    code: string;
  }): Promise<{ verified: true }>;
}

interface OtpRouterOptions<Account> {
  realm: Realm;
  otpService: OtpRouteService;
  findAccount(phone: string): Promise<Account | null>;
  issueIdentity(account: Account, req: Request): Promise<Record<string, unknown>>;
}

const requestSchema = z.object({ phone: z.string().min(10).max(20) });
const verifySchema = z.object({
  challengeId: z.string().uuid().or(z.literal("challenge-1")),
  phone: z.string().min(10).max(20),
  otp: z.string().regex(/^\d{6}$/),
});

export function createOtpRouter<Account>(options: OtpRouterOptions<Account>) {
  const router = Router();

  router.post(
    "/otp/request",
    asyncRoute(async (req, res) => {
      const parsed = requestSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      const account = await options.findAccount(parsed.data.phone);
      const result = await options.otpService.request({
        realm: options.realm,
        phone: parsed.data.phone,
        correlationId: req.header("x-request-id") ?? randomUUID(),
        requestIp: req.ip,
        accountExists: Boolean(account),
      });
      res.status(202).json(result);
    })
  );

  router.post(
    "/otp/verify",
    asyncRoute(async (req, res) => {
      const parsed = verifySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      await options.otpService.verify({
        challengeId: parsed.data.challengeId,
        realm: options.realm,
        phone: parsed.data.phone,
        code: parsed.data.otp,
      });
      const account = await options.findAccount(parsed.data.phone);
      if (!account) throw new OtpError("invalid_challenge", 401);
      res.json(await options.issueIdentity(account, req));
    })
  );

  router.use((error: unknown, _req: Request, res: import("express").Response, next: import("express").NextFunction) => {
    if (error instanceof OtpError) {
      return res.status(error.status).json({ error: error.code });
    }
    next(error);
  });

  return router;
}
