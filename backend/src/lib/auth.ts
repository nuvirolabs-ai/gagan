import { Request, Response, NextFunction } from "express";
import { SessionError } from "../modules/identity/sessionService";
import { lazyIdentitySessionService } from "../modules/identity/sessionRuntime";

export interface AuthedRequest extends Request {
  retailerId?: string;
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  try {
    const claims = await lazyIdentitySessionService.authenticateAccessToken(
      header.slice(7),
      "retailer"
    );
    req.retailerId = claims.sub;
    next();
  } catch (error) {
    if (error instanceof SessionError) {
      return res.status(error.status).json({ error: error.code });
    }
    next(error);
  }
}
