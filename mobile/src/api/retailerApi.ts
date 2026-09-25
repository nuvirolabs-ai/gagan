import type { SessionStore } from "../auth/sessionStore";

export type ApiRequest = (path: string, options?: RequestInit, auth?: boolean) => Promise<any>;

export function createRetailerApi(request: ApiRequest, store: SessionStore) {
  const post = (path: string, body?: unknown, auth = true) =>
    request(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }, auth);

  return {
    requestOtp: (phone: string) => post("/auth/otp/request", { phone }, false),
    async verifyOtp(challengeId: string, phone: string, otp: string) {
      const result = await post("/auth/otp/verify", { challengeId, phone, otp }, false);
      await store.save({ accessToken: result.accessToken, refreshToken: result.refreshToken });
      return result;
    },
    async logout() {
      try { await post("/auth/logout"); } finally { await store.clear(); }
    },
    me: () => request("/auth/me"),
    getHome: () => request("/home"),
    getCatalog: () => request("/catalog"),
    getProduct: (id: string) => request(`/products/${id}`),
    commercialQuote: (items: {variantId:string;qty:number}[]) => post("/commercial/quotes",{items}),
    refreshCommercialQuote: (id:string) => request(`/commercial/quotes/${id}`),
    createOrder: (items: { variantId: string; qty: number }[], idempotencyKey: string, commercial?:{quoteId:string;revision:number}) =>
      request(
        "/orders",
        {
          method: "POST",
          headers: { "Idempotency-Key": idempotencyKey },
          body: JSON.stringify({ items, ...(commercial ? {commercial}:{}) }),
        }
      ),
    getOrders: () => request("/orders"),
    getOrder: (id: string) => request(`/orders/${id}`),
    getLedger: (retailerId: string) => request(`/ledger/${retailerId}`),
    getDues: () => request("/payments/dues"),
    createPaymentIntent: (
      amount: number,
      idempotencyKey: string,
      allocation?: { invoiceScopeId: string; jainAmount: number; padamAmount: number }
    ) => request("/payments/intent", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ amount, ...allocation }),
    }, true),
    confirmMockPayment: (providerRef: string, signature: string, outcome = "succeeded") =>
      post("/payments/callback", { providerRef, signature, outcome }, false),
    getPayment: (id: string) => request(`/payments/${id}`),
    getPayments: () => request("/payments"),
    attachPaymentEvidence: (id: string, evidence: { contentType: string; bodyBase64: string; checksum?: string }) =>
      post(`/payments/${encodeURIComponent(id)}/evidence`, evidence),
    getDeliveryStatus: (orderId: string) => request(`/delivery/${orderId}/status`),
    getLocation: () => request("/location"),
    captureLocation: (body: { latitude: number; longitude: number; accuracyMeters: number; devicePlatform?: string }) => post("/location/capture", body),
    verifyLocation: (body: { latitude: number; longitude: number; accuracyMeters: number; devicePlatform?: string }) => post("/location/verify", body),
    requestLocationChange: (reason: string) => post("/location/change-request", { reason }),
    serviceRequests: () => request("/service-requests"),
    submitServiceRequest: (description: string, clientReference: string) => post("/service-requests", { description, clientReference }),
    withdrawServiceRequest: (id: string) => post(`/service-requests/${encodeURIComponent(id)}/withdraw`),
    surveys: () => request("/surveys"),
    survey: (id: string) => request(`/surveys/${id}`),
    submitSurvey: (id: string, body: { idempotencyKey: string; answers: Array<{ questionId: string; optionIds?: string[]; value?: string | number | boolean | null }> }) =>
      post(`/surveys/${id}/responses`, body),
  };
}
