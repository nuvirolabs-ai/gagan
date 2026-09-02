import type { SessionStore } from "../auth/sessionStore";

export type ApiRequest = (path: string, options?: RequestInit, auth?: boolean) => Promise<any>;

export interface FieldCoordinates {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  devicePlatform?: string;
}

function rangeQuery(from?: string, to?: string) {
  const parts = [from ? `from=${from}` : null, to ? `to=${to}` : null].filter(Boolean);
  return parts.length ? `?${parts.join("&")}` : "";
}

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
    checkIn: (
      retailerId: string,
      body: {
        latitude: number;
        longitude: number;
        accuracyMeters: number;
        devicePlatform?: string;
        purpose?: string;
      }
    ) => post(`/rep/retailers/${retailerId}/check-in`, body),
    checkOut: (
      visitId: string,
      body: {
        latitude: number;
        longitude: number;
        accuracyMeters: number;
        devicePlatform?: string;
        outcome?: string;
        notes?: string;
        followUpAt?: string;
      }
    ) => post(`/rep/visits/${visitId}/check-out`, body),
    visits: () => request("/rep/visits"),

    /* ------------------------------ the field day ----------------------------- */

    today: () => request("/rep/field/today"),
    startDay: (body: FieldCoordinates & { photo?: { contentType: string; bodyBase64: string } }) =>
      post("/rep/field/attendance/start", body),
    endDay: (body: FieldCoordinates & { photo?: { contentType: string; bodyBase64: string }; managerNote?: string }) =>
      post("/rep/field/attendance/end", body),
    salesKit: () => request("/rep/field/sales-kit"),
    schemes: (retailerId?: string) => request(`/rep/field/schemes${retailerId ? `?retailerId=${retailerId}` : ""}`),
    attendance: (from?: string, to?: string) =>
      request(`/rep/field/attendance${rangeQuery(from, to)}`),
    leaveRequests: () => request("/rep/field/leave"),
    requestLeave: (body: { fromDate: string; toDate: string; type: string; reason: string }) =>
      post("/rep/field/leave", body),
    cancelLeave: (id: string) => post(`/rep/field/leave/${id}/cancel`),

    route: (date?: string) => request(`/rep/field/route${date ? `?date=${date}` : ""}`),
    routeHistory: (from?: string, to?: string) =>
      request(`/rep/field/route/history${rangeQuery(from, to)}`),
    skipRouteStop: (stopId: string, reason: string) =>
      post(`/rep/field/route/stops/${stopId}/skip`, { reason }),

    logActivity: (body: {
      retailerId: string;
      type: string;
      visitId?: string;
      notes?: string;
      followUpAt?: string;
      orderId?: string;
      occurredAt?: string;
      clientReference?: string;
    }) => post("/rep/field/activities", body),
    customerActivities: (retailerId: string) =>
      request(`/rep/field/activities?retailerId=${retailerId}`),

    tasks: () => request("/rep/field/tasks"),
    setTaskStatus: (id: string, status: "in_progress" | "done", note?: string) =>
      post(`/rep/field/tasks/${id}/status`, { status, note }),

    trackingState: (permissionGranted: boolean) =>
      request(`/rep/field/tracking/state?permissionGranted=${permissionGranted ? "true" : "false"}`),
    sendPings: (pings: unknown[]) => post("/rep/field/tracking/pings", { pings }),

    expenses: () => request("/rep/field/expenses"),
    submitExpense: (body: {
      expenseDate: string;
      category: string;
      amount: number;
      description: string;
      receipt?: { contentType: string; bodyBase64: string };
    }) => post("/rep/field/expenses", body),

    issues: (retailerId?: string) =>
      request(`/rep/field/issues${retailerId ? `?retailerId=${retailerId}` : ""}`),
    raiseIssue: (body: {
      retailerId: string;
      type: string;
      description: string;
      priority?: string;
      orderId?: string;
      visitId?: string;
    }) => post("/rep/field/issues", body),

    performance: (from?: string, to?: string) =>
      request(`/rep/field/performance${rangeQuery(from, to)}`),
    activityFeed: (from?: string, to?: string) =>
      request(`/rep/field/activity-feed${rangeQuery(from, to)}`),
    /* ------------------------ performance and intelligence ----------------------- */

    targets: () => request("/rep/performance/targets"),
    ranking: () => request("/rep/performance/ranking"),
    achievements: () => request("/rep/performance/achievements"),
    opportunities: (limit?: number) =>
      request(`/rep/intelligence/opportunities${limit ? `?limit=${limit}` : ""}`),
    retailerBaseline: (retailerId: string) =>
      request(`/rep/intelligence/retailers/${retailerId}/baseline`),

    /* ------------------------------ new retailers ------------------------------ */

    retailerProposals: () => request("/rep/retailer-proposals"),
    proposeRetailer: (body: {
      businessName: string;
      ownerName?: string;
      phone: string;
      shopAddress: string;
      latitude?: number;
      longitude?: number;
      accuracyMeters?: number;
      notes?: string;
    }) => post("/rep/retailer-proposals", body),
    withdrawRetailerProposal: (id: string) => post(`/rep/retailer-proposals/${id}/withdraw`),

    customerMap: (origin?: { latitude: number; longitude: number }) =>
      request(
        `/rep/field/customers/map${
          origin ? `?latitude=${origin.latitude}&longitude=${origin.longitude}` : ""
        }`
      ),
  };
}
