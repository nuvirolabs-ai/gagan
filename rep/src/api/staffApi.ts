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
    recoveryCases: () => request("/rep/recovery"),
    recoveryTimeline: (caseId: string) => request(`/rep/recovery/${caseId}`),
    recoveryLetter: (id: string) => request(`/rep/recovery/letters/${id}`),
    logRecoveryCall: (caseId: string, body: unknown) => post(`/rep/recovery/${caseId}/calls`, body),
    createRecoveryPromise: (caseId: string, body: unknown) => post(`/rep/recovery/${caseId}/promises`, body),
    setRecoveryPromiseStatus: (promiseId: string, status: "kept" | "missed") => post(`/rep/recovery/promises/${promiseId}/status`, { status }),
    catalogFor: (id: string) => request(`/rep/retailers/${id}/catalog`),
    retailerMasters: () => request("/rep/retailer-masters"),
    uploadAadhaar: (body: { contentType: string; bodyBase64: string; checksum?: string }) =>
      post("/rep/retailer-evidence/aadhaar", body),
    proposeRetailer: (body: unknown) => post("/rep/retailer-proposals", body),
    retailerProposals: () => request("/rep/retailer-proposals"),
    updateRetailerProfile: (id: string, body: unknown) =>
      request(`/rep/retailers/${id}/profile`, { method: "PATCH", body: JSON.stringify(body) }, true),
    createOrder: (retailerId: string, items: { variantId: string; qty: number }[], idempotencyKey: string) =>
      request(
        "/rep/orders",
        {
          method: "POST",
          headers: { "Idempotency-Key": idempotencyKey },
          body: JSON.stringify({ retailerId, items }),
        }
      ),
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
    getLocation: (retailerId: string) => request(`/rep/retailers/${retailerId}/location`),
    captureLocation: (retailerId: string, body: { latitude: number; longitude: number; accuracyMeters: number; devicePlatform?: string }) => post(`/rep/retailers/${retailerId}/location/capture`, body),
    verifyLocation: (retailerId: string, body: { latitude: number; longitude: number; accuracyMeters: number; devicePlatform?: string }) => post(`/rep/retailers/${retailerId}/location/verify`, body),
    checkIn: (retailerId: string, body: { latitude: number; longitude: number; accuracyMeters: number; devicePlatform?: string }) => post(`/rep/retailers/${retailerId}/check-in`, body),
    checkOut: (visitId: string, body: { latitude: number; longitude: number; accuracyMeters: number; devicePlatform?: string }) => post(`/rep/visits/${visitId}/check-out`, body),
    visits: () => request("/rep/visits"),
  };
}
