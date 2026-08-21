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
    createOrder: (items: { variantId: string; qty: number }[], idempotencyKey: string) =>
      request(
        "/orders",
        {
          method: "POST",
          headers: { "Idempotency-Key": idempotencyKey },
          body: JSON.stringify({ items }),
        }
      ),
    getOrders: () => request("/orders"),
    getOrder: (id: string) => request(`/orders/${id}`),
    getLedger: (retailerId: string) => request(`/ledger/${retailerId}`),
    getDues: () => request("/payments/dues"),
    createPaymentIntent: (amount: number) => post("/payments/intent", { amount }),
    confirmMockPayment: (providerRef: string, signature: string, outcome = "succeeded") =>
      post("/payments/callback", { providerRef, signature, outcome }, false),
    getPayment: (id: string) => request(`/payments/${id}`),
    getPayments: () => request("/payments"),
    getDeliveryStatus: (orderId: string) => request(`/delivery/${orderId}/status`),
    getLocation: () => request("/location"),
    captureLocation: (body: { latitude: number; longitude: number; accuracyMeters: number; devicePlatform?: string }) => post("/location/capture", body),
    verifyLocation: (body: { latitude: number; longitude: number; accuracyMeters: number; devicePlatform?: string }) => post("/location/verify", body),
    requestLocationChange: (reason: string) => post("/location/change-request", { reason }),
  };
}
