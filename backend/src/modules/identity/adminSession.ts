import type { Response } from "express";
import type { SessionResult } from "./sessionService";
import { setRefreshCookie, type RefreshCookieConfig } from "./sessionRoutes";

export const ADMIN_REFRESH_COOKIE_NAME = "gagan_admin_refresh";

export function adminRefreshCookieConfig(
  environment = process.env.NODE_ENV
): RefreshCookieConfig {
  return {
    name: ADMIN_REFRESH_COOKIE_NAME,
    // Staging is served over HTTPS too, so its refresh cookie must not be
    // downgraded to an insecure browser cookie merely because it is not live
    // production.
    secure: environment === "production" || environment === "staging",
    path: "/admin/auth",
    csrfHeader: { name: "x-gagan-client", value: "admin-web" },
  };
}

interface PublicAdmin {
  id: string;
  name: string;
  email: string;
}

export function sendAdminSession(
  res: Response,
  result: SessionResult,
  admin: PublicAdmin,
  environment = process.env.NODE_ENV
) {
  setRefreshCookie(
    res,
    result.refreshToken,
    adminRefreshCookieConfig(environment)
  );
  res.json({
    accessToken: result.accessToken,
    session: { id: result.session.id, expiresAt: result.session.expiresAt },
    admin,
  });
}
