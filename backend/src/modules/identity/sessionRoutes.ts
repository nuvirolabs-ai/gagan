import { randomUUID } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { asyncRoute } from "../../platform/http/asyncRoute";
import { OtpError, type OtpChallengeRecord } from "./otpService";
import type { OtpRouteService } from "./otpRoutes";
import {
  createRequireSession,
  type IdentityAuthedRequest,
  type SessionAuthenticator,
} from "./sessionAuth";
import {
  SessionError,
  type DeviceSessionRecord,
  type SessionRealm,
  type SessionResult,
} from "./sessionService";

export interface SessionRouteService extends SessionAuthenticator {
  refresh(refreshToken: string): Promise<SessionResult>;
  revokeSession(id: string, realm: SessionRealm, subjectId: string): Promise<void>;
  revokeAll(realm: SessionRealm, subjectId: string): Promise<void>;
  listSessions(realm: SessionRealm, subjectId: string): Promise<DeviceSessionRecord[]>;
  elevateSession(
    sessionId: string,
    realm: SessionRealm,
    subjectId: string
  ): Promise<{ accessToken: string; stepUpUntil: Date }>;
}

interface SessionRouterOptions {
  realm: SessionRealm;
  sessions: SessionRouteService;
  otpService: OtpRouteService;
  resolvePhone(subjectId: string): Promise<string>;
}

function publicSession(session: DeviceSessionRecord) {
  return {
    id: session.id,
    deviceName: session.deviceName,
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    expiresAt: session.expiresAt,
    revokedAt: session.revokedAt,
  };
}

function publicSessionResult(result: SessionResult) {
  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    session: publicSession(result.session),
  };
}

export function createSessionRouter(options: SessionRouterOptions) {
  const router = Router();
  const requireSession = createRequireSession(options.realm, options.sessions);

  router.post(
    "/refresh",
    asyncRoute(async (req, res) => {
      const parsed = z.object({ refreshToken: z.string().min(20) }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      res.json(publicSessionResult(await options.sessions.refresh(parsed.data.refreshToken)));
    })
  );

  router.post(
    "/logout",
    requireSession,
    asyncRoute(async (req: IdentityAuthedRequest, res) => {
      const identity = req.identityAuth!;
      await options.sessions.revokeSession(
        identity.sessionId,
        options.realm,
        identity.subjectId
      );
      res.status(204).send();
    })
  );

  router.post(
    "/logout-all",
    requireSession,
    asyncRoute(async (req: IdentityAuthedRequest, res) => {
      await options.sessions.revokeAll(options.realm, req.identityAuth!.subjectId);
      res.status(204).send();
    })
  );

  router.get(
    "/sessions",
    requireSession,
    asyncRoute(async (req: IdentityAuthedRequest, res) => {
      const sessions = await options.sessions.listSessions(
        options.realm,
        req.identityAuth!.subjectId
      );
      res.json({ sessions: sessions.map(publicSession) });
    })
  );

  router.post(
    "/sessions/:id/revoke",
    requireSession,
    asyncRoute(async (req: IdentityAuthedRequest, res) => {
      await options.sessions.revokeSession(
        req.params.id,
        options.realm,
        req.identityAuth!.subjectId
      );
      res.status(204).send();
    })
  );

  router.post(
    "/step-up/request",
    requireSession,
    asyncRoute(async (req: IdentityAuthedRequest, res) => {
      const phone = await options.resolvePhone(req.identityAuth!.subjectId);
      const result = await options.otpService.request({
        realm: options.realm,
        phone,
        correlationId: req.header("x-request-id") ?? randomUUID(),
        requestIp: req.ip,
        accountExists: true,
      });
      res.status(202).json(result);
    })
  );

  router.post(
    "/step-up",
    requireSession,
    asyncRoute(async (req: IdentityAuthedRequest, res) => {
      const parsed = z
        .object({
          challengeId: z.string().min(1),
          otp: z.string().regex(/^\d{6}$/),
        })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
      const identity = req.identityAuth!;
      const phone = await options.resolvePhone(identity.subjectId);
      await options.otpService.verify({
        challengeId: parsed.data.challengeId,
        realm: options.realm,
        phone,
        code: parsed.data.otp,
      });
      res.json(
        await options.sessions.elevateSession(
          identity.sessionId,
          options.realm,
          identity.subjectId
        )
      );
    })
  );

  router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (error instanceof SessionError || error instanceof OtpError) {
      return res.status(error.status).json({ error: error.code });
    }
    next(error);
  });

  return router;
}
