import type { SessionStore } from "../auth/sessionStore";

export type ApiRequest = (path: string, options?: RequestInit, auth?: boolean) => Promise<any>;

export function createStaffApi(request: ApiRequest, store: SessionStore) {
  const post = (path: string, body?: unknown, auth = true) =>
    request(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }, auth);

  return {
    requestOtp: (phone: string) => post("/rep/auth/otp/request", { phone }, false),
    async verifyOtp(challengeId: string, phone: string, otp: string) {
      const result = await post("/rep/auth/otp/verify", { challengeId, phone, otp }, false);
      await store.save({ accessToken: result.accessToken, refreshToken: result.refreshToken });
      return result;
    },
    async logout() {
      try { await post("/rep/auth/logout"); } finally { await store.clear(); }
    },
    requestStepUp: () => post("/rep/auth/step-up/request"),
    async completeStepUp(challengeId: string, otp: string) {
      const result = await post("/rep/auth/step-up", { challengeId, otp });
      const existing = await store.load();
      if (!existing || typeof result.accessToken !== "string") throw new Error("invalid_step_up_session");
      await store.save({ accessToken: result.accessToken, refreshToken: existing.refreshToken });
      return result;
    },
    me: () => request("/rep/me"),
    approvals: () => request("/rep/approvals"),
    approval: (id: string) => request(`/rep/approvals/${id}`),
    decideApproval: (id: string, result: "approved" | "rejected", reason?: string) =>
      post(`/rep/approvals/${id}/decision`, { result, reason }),
    raiseApprovalDispute: (id: string, writtenPosition: string) =>
      post(`/rep/approvals/${id}/disputes`, { writtenPosition }),
    retailers: () => request("/rep/retailers"),
    retailer: (id: string) => request(`/rep/retailers/${id}`),
    catalogFor: (id: string) => request(`/rep/retailers/${id}/catalog`),
    createOrder: (retailerId: string, items: { variantId: string; qty: number }[]) =>
      post("/rep/orders", { retailerId, items }),
  };
}
