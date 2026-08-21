import { randomUUID } from "node:crypto";
import { SapB1HttpError, SapB1MalformedResponseError, SapB1TimeoutError } from "./errors";
import { SapB1SessionStore } from "./sessionStore";

type FetchImplementation = (input: string, init?: RequestInit) => Promise<Response>;

export interface SapB1HttpClientOptions {
  baseUrl: string;
  fetchImpl?: FetchImplementation;
  sessionStore?: SapB1SessionStore;
  timeoutMs?: number;
  correlationId?: () => string;
  reauthenticate?: () => Promise<void>;
}

function parseErrorCode(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const error = (body as Record<string, unknown>).error;
  if (!error || typeof error !== "object") return undefined;
  const code = (error as Record<string, unknown>).code;
  return code == null ? undefined : String(code);
}

export class SapB1HttpClient {
  private readonly fetchImpl: FetchImplementation;
  private readonly sessionStore: SapB1SessionStore;
  private readonly timeoutMs: number;
  private readonly correlationId: () => string;
  private readonly reauthenticate?: () => Promise<void>;

  constructor(private readonly options: SapB1HttpClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sessionStore = options.sessionStore ?? new SapB1SessionStore();
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.correlationId = options.correlationId ?? randomUUID;
    this.reauthenticate = options.reauthenticate;
    if (!options.baseUrl.startsWith("https://")) {
      throw new Error("SAP B1 Service Layer requires an HTTPS base URL");
    }
  }

  get sessions(): SapB1SessionStore {
    return this.sessionStore;
  }

  async login<T>(path: string, body: unknown): Promise<T> {
    const result = await this.request<T>("POST", path, body, { retryOnUnauthorized: false });
    return result;
  }

  async request<T>(method: string, path: string, body?: unknown, options: { retryOnUnauthorized?: boolean } = {}, retried = false): Promise<T> {
    const correlationId = this.correlationId();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers: Record<string, string> = {
      accept: "application/json",
      "x-correlation-id": correlationId,
    };
    if (body !== undefined) headers["content-type"] = "application/json";
    const cookie = this.sessionStore.getRequestCookie();
    if (cookie) headers.cookie = cookie;

    try {
      const response = await this.fetchImpl(new URL(path, this.options.baseUrl).toString(), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await response.text();
      let parsed: unknown = null;
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new SapB1MalformedResponseError(correlationId);
        }
      }
      if (response.status === 401 && options.retryOnUnauthorized !== false && !retried && this.reauthenticate) {
        this.sessionStore.clear();
        await this.reauthenticate();
        return this.request<T>(method, path, body, options, true);
      }
      if (!response.ok) {
        throw new SapB1HttpError(correlationId, response.status, parseErrorCode(parsed));
      }
      const setCookie = response.headers.get("set-cookie");
      if (setCookie) this.sessionStore.setCookie(setCookie);
      return parsed as T;
    } catch (error) {
      if (error instanceof SapB1HttpError || error instanceof SapB1MalformedResponseError) throw error;
      if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
        throw new SapB1TimeoutError(correlationId);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
