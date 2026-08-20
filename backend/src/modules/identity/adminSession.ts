import type { Response } from "express";
import type { SessionResult } from "./sessionService";
import { setRefreshCookie, type RefreshCookieConfig } from "./sessionRoutes";

export const ADMIN_REFRESH_COOKIE_NAME = "gagan_admin_refresh";

export function adminRefreshCookieConfig(
  environment = process.env.NODE_ENV
): RefreshCookieConfig {
  return {
    name: ADMIN_REFRESH_COOKIE_NAME,
    secure: environment === "production",
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
