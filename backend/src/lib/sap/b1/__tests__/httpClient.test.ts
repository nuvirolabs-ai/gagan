import { describe, expect, it, vi } from "vitest";
import { SapB1HttpClient } from "../httpClient";
import { SapB1SessionStore } from "../sessionStore";
import { SapB1HttpError, SapB1TimeoutError } from "../errors";

function response(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("SapB1HttpClient", () => {
  it("captures the login session cookie and sends a correlation id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({ ok: true }, { headers: { "set-cookie": "B1SESSION=session-1; Path=/" } })
    );
    const store = new SapB1SessionStore();
    const client = new SapB1HttpClient({
      baseUrl: "https://sap.example.invalid",
      fetchImpl,
      sessionStore: store,
      correlationId: () => "corr-login",
    });

    await client.login("/login", { opaque: "payload" });

    expect(store.getCookie()).toBe("B1SESSION=session-1; Path=/");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://sap.example.invalid/login",
      expect.objectContaining({ headers: expect.objectContaining({ "x-correlation-id": "corr-login" }) })
    );
  });

  it("reauthenticates once after a 401 and retries with the new session", async () => {
    const store = new SapB1SessionStore("B1SESSION=old-session");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response({ message: "expired" }, { status: 401 }))
      .mockResolvedValueOnce(response({ ok: true }));
    const reauthenticate = vi.fn(async () => {
      store.setCookie("B1SESSION=new-session");
    });
    const client = new SapB1HttpClient({
      baseUrl: "https://sap.example.invalid",
      fetchImpl,
      sessionStore: store,
      reauthenticate,
      correlationId: () => "corr-retry",
    });

    await expect(client.request("GET", "/orders")).resolves.toEqual({ ok: true });
    expect(reauthenticate).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("maps SAP HTTP errors without exposing request credentials", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ error: { code: "-1000", message: "bad" } }, { status: 400 }));
    const client = new SapB1HttpClient({ baseUrl: "https://sap.example.invalid", fetchImpl, correlationId: () => "corr-error" });

    await expect(client.request("POST", "/orders", { Password: "secret" })).rejects.toMatchObject({
      kind: "http",
      status: 400,
      correlationId: "corr-error",
      sapCode: "-1000",
    });
  });

  it("maps an aborted request to a typed timeout", async () => {
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      });
    });
    const client = new SapB1HttpClient({ baseUrl: "https://sap.example.invalid", fetchImpl, timeoutMs: 5 });

    await expect(client.request("GET", "/slow")).rejects.toBeInstanceOf(SapB1TimeoutError);
  });
});
