import { loadEnv } from "../../platform/config/env";
import { SessionService } from "./sessionService";

let cachedService: SessionService | undefined;

export function identitySessionService(): SessionService {
  if (cachedService) return cachedService;
  const env = loadEnv();
  cachedService = new SessionService({
    jwtSecret: env.JWT_SECRET,
    tokenHashSecret: env.REFRESH_TOKEN_SECRET,
  });
  return cachedService;
}

export const lazyIdentitySessionService: SessionService = new Proxy({} as SessionService, {
  get(_target, property) {
    const service = identitySessionService() as unknown as Record<PropertyKey, unknown>;
    const value = service[property];
    return typeof value === "function" ? value.bind(service) : value;
  },
});
