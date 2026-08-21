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
    resolveApprovalDispute: (id: string, outcome: "approved" | "rejected", resolution: string) =>
      post(`/rep/approval-disputes/${id}/resolve`, { outcome, resolution }),
    ratingProposals: () => request("/rep/credit/rating-proposals"),
    confirmRatingProposal: (id: string, reason: string) =>
      post(`/rep/credit/rating-proposals/${id}/confirm`, { reason }),
    retailers: () => request("/rep/retailers"),
    retailer: (id: string) => request(`/rep/retailers/${id}`),
    startKyc: (retailerId: string) => post("/rep/kyc", { retailerId }),
    kycCase: (id: string) => request(`/rep/kyc/${id}`),
    uploadKycDocument: (caseId: string, body: { type: string; contentType: string; bodyBase64: string; checksum?: string }) => post(`/rep/kyc/${caseId}/documents`, body),
    submitKyc: (caseId: string) => post(`/rep/kyc/${caseId}/submit`),
    catalogFor: (id: string) => request(`/rep/retailers/${id}/catalog`),
    createOrder: (retailerId: string, items: { variantId: string; qty: number }[]) =>
      post("/rep/orders", { retailerId, items }),
    collectionRetailers: () => request("/rep/collections/assigned-retailers"),
    collectionSubmissions: () => request("/rep/collections"),
    submitCollection: (input: {
      retailerId: string;
      amount: number;
      method: "cash" | "cheque" | "neft" | "upi";
      reference?: string;
      notes?: string;
      idempotencyKey: string;
      evidence?: { contentType: string; bodyBase64: string; checksum?: string };
    }) => post("/rep/collections", input),
    confirmCollection: (id: string) => post(`/rep/collections/${id}/confirm`),
    rejectCollection: (id: string, reason: string) => post(`/rep/collections/${id}/reject`, { reason }),
  };
}
