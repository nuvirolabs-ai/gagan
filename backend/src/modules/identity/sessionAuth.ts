import type { NextFunction, RequestHandler, Response } from "express";
import type { StaffAuthedRequest } from "./permissions";
import {
  SessionError,
  type AccessTokenClaims,
  type SessionRealm,
} from "./sessionService";

export interface SessionAuthenticator {
  authenticateAccessToken(
    token: string,
    expectedRealm: SessionRealm
  ): Promise<AccessTokenClaims>;
}

export interface IdentityAuthedRequest extends StaffAuthedRequest {
  identityAuth?: {
    subjectId: string;
    realm: SessionRealm;
    sessionId: string;
    permissions: string[];
    delegationIds: string[];
    stepUpUntil?: Date;
  };
}

export function createRequireSession(
  realm: SessionRealm,
  authenticator: SessionAuthenticator
): RequestHandler {
  return async (req: IdentityAuthedRequest, res: Response, next: NextFunction) => {
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "authentication_required" });
    }
    try {
      const claims = await authenticator.authenticateAccessToken(
        authorization.slice(7),
        realm
      );
      const identityAuth = {
        subjectId: claims.sub,
        realm: claims.realm,
        sessionId: claims.sessionId,
        permissions: claims.permissions,
        delegationIds: claims.delegationIds,
        stepUpUntil: claims.stepUpUntil
          ? new Date(claims.stepUpUntil * 1000)
          : undefined,
      };
      req.identityAuth = identityAuth;
      req.staffAuth = {
        staffId: claims.sub,
        sessionId: identityAuth.sessionId,
        permissions: identityAuth.permissions,
        delegationIds: identityAuth.delegationIds,
        stepUpUntil: identityAuth.stepUpUntil,
      };
      next();
    } catch (error) {
      if (error instanceof SessionError) {
        return res.status(error.status).json({ error: error.code });
      }
      next(error);
    }
  };
}

export function requireRecentStepUp(
  req: StaffAuthedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.staffAuth?.stepUpUntil || req.staffAuth.stepUpUntil <= new Date()) {
    return res.status(403).json({ error: "step_up_required" });
  }
  next();
}
