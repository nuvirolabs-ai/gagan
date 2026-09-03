import type { SessionStore, SessionTokens } from "./sessionStore";

export class SessionFetchError extends Error {
  constructor(public readonly status: number, public readonly body: { error?: string }) {
    super(typeof body.error === "string" ? body.error : `Request failed with status ${status}`);
  }
}

export function isAuthenticationFailure(error: unknown): boolean {
  return error instanceof SessionFetchError && (error.status === 401 || error.status === 403);
}

export function createSessionFetch(options: {
  baseUrl: string;
  refreshPath: string;
  store: SessionStore;
  fetcher?: typeof fetch;
  onUnauthorized?: () => void;
}) {
  const fetcher = options.fetcher ?? fetch;
  let refreshPromise: Promise<SessionTokens> | null = null;
  const readBody = (response: Response) => response.json().catch(() => ({}));

  async function refresh() {
    if (!refreshPromise) {
      refreshPromise = (async () => {
        const current = await options.store.load();
        if (!current) throw new SessionFetchError(401, { error: "session_required" });
        const response = await fetcher(`${options.baseUrl}${options.refreshPath}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        });
        const body = await readBody(response);
        if (!response.ok || typeof body.accessToken !== "string" || typeof body.refreshToken !== "string") {
          throw new SessionFetchError(response.status, body);
        }
        const next = { accessToken: body.accessToken, refreshToken: body.refreshToken };
        await options.store.save(next);
        return next;
      })().finally(() => {
        refreshPromise = null;
      });
    }
    return refreshPromise;
  }

  async function request(path: string, init: RequestInit = {}, auth = true, allowRefresh = true): Promise<any> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    };
    if (auth) {
      const current = await options.store.load();
      if (current) headers.Authorization = `Bearer ${current.accessToken}`;
    }
    const response = await fetcher(`${options.baseUrl}${path}`, { ...init, headers });
    const body = await readBody(response);
    if (response.status === 401 && auth && allowRefresh) {
      try {
        await refresh();
        return request(path, init, true, false);
      } catch {
        await options.store.clear();
        options.onUnauthorized?.();
      }
    }
    if (!response.ok) throw new SessionFetchError(response.status, body);
    return body;
  }

  return request;
}
