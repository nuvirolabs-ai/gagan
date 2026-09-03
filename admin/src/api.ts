const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
let accessToken: string | null = null;
let refreshPromise: Promise<string> | null = null;

export const getAccessToken = () => accessToken;
export const setAccessToken = (token: string) => {
  accessToken = token;
};
export const clearAccessToken = () => {
  accessToken = null;
};

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, body: any) {
    super(body?.error || `Request failed (${status})`);
    this.status = status;
    this.body = body;
  }
}

async function parseResponse(res: Response) {
  return res.json().catch(() => ({}));
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await fetch(`${BASE_URL}/admin/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-Gagan-Client": "admin-web",
        },
      });
      const body = await parseResponse(res);
      if (!res.ok || typeof body.accessToken !== "string") {
        clearAccessToken();
        throw new ApiError(res.status, body);
      }
      setAccessToken(body.accessToken);
      return body.accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function request(
  path: string,
  options: RequestInit = {},
  auth = true,
  allowRefresh = true
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
  const body = await parseResponse(res);

  if (res.status === 401 && auth && allowRefresh) {
    try {
      await refreshAccessToken();
      return request(path, options, auth, false);
    } catch {
      clearAccessToken();
      onUnauthorized?.();
    }
  }
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

const post = (path: string, body?: unknown) =>
  request(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
const patch = (path: string, body: unknown) =>
  request(path, { method: "PATCH", body: JSON.stringify(body) });
const remove = (path: string) => request(path, { method: "DELETE" });

export const api = {
  login: (email: string, password: string) =>
    request(
      "/admin/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
      false
    ),
  refresh: refreshAccessToken,
  logout: () => post("/admin/auth/logout"),
  me: () => request("/admin/auth/me"),
  requestAdminStepUp: () => post("/admin/auth/step-up/request"),
  async completeAdminStepUp(challengeId: string, otp: string) {
    const result = await post("/admin/auth/step-up", { challengeId, otp });
    setAccessToken(result.accessToken);
    return result;
  },

  approvals: () => request("/admin/approvals"),
  approval: (id: string) => request(`/admin/approvals/${id}`),
  decideApproval: (id: string, result: "approved" | "rejected", reason?: string) =>
    post(`/admin/approvals/${id}/decision`, { result, reason }),
  raiseApprovalDispute: (id: string, writtenPosition: string) =>
    post(`/admin/approvals/${id}/disputes`, { writtenPosition }),
  resolveApprovalDispute: (id: string, outcome: "approved" | "rejected", resolution: string) =>
    post(`/admin/approval-disputes/${id}/resolve`, { outcome, resolution }),
  collections: () => request("/admin/collections"),
  confirmCollection: (id: string) => post(`/admin/collections/${id}/confirm`),
  rejectCollection: (id: string, reason: string) => post(`/admin/collections/${id}/reject`, { reason }),
  recoveryCases: () => request("/admin/recovery"),
  recoveryTimeline: (caseId: string) => request(`/admin/recovery/${caseId}`),
  recoveryLetter: (id: string) => request(`/admin/recovery/letters/${id}`),
  createRecoveryLetter: (caseId: string, body: unknown) => post(`/admin/recovery/${caseId}/letters`, body),
  recordRecoveryDelivery: (letterId: string, body: unknown) => post(`/admin/recovery/letters/${letterId}/deliveries`, body),
  createLegalCase: (caseId: string, body: unknown) => post(`/admin/recovery/${caseId}/legal`, body),
  decideLegalCase: (id: string, body: unknown) => post(`/admin/recovery/legal/${id}/decision`, body),
  logRecoveryCall: (caseId: string, body: unknown) => post(`/admin/recovery/${caseId}/calls`, body),
  createRecoveryPromise: (caseId: string, body: unknown) => post(`/admin/recovery/${caseId}/promises`, body),
  setRecoveryPromiseStatus: (promiseId: string, status: "kept" | "missed") => post(`/admin/recovery/promises/${promiseId}/status`, { status }),
  ratingProposals: () => request("/admin/credit/rating-proposals"),
  kycPending: () => request("/admin/credit/kyc-pending"),
  confirmKyc: (retailerId: string, evidenceReference: string, reason: string) =>
    post(`/admin/credit/kyc/${retailerId}/confirm`, { evidenceReference, reason }),
  confirmRatingProposal: (id: string, reason: string) =>
    post(`/admin/credit/rating-proposals/${id}/confirm`, { reason }),
  shadowComparisons: () => request("/admin/credit/shadow-comparisons"),
  setShadowDisposition: (id: string, disposition: string) =>
    patch(`/admin/credit/shadow-comparisons/${id}`, { disposition }),
  kycCases: () => request("/admin/kyc/pending"),
  kycCase: (id: string) => request(`/admin/kyc/${id}`),
  startKyc: (retailerId: string) => post("/admin/kyc", { retailerId }),
  uploadKycDocument: (caseId: string, body: { type: string; contentType: string; bodyBase64: string; checksum?: string }) =>
    post(`/admin/kyc/${caseId}/documents`, body),
  submitKyc: (caseId: string) => post(`/admin/kyc/${caseId}/submit`),
  approveKycCase: (caseId: string, reason: string) => post(`/admin/kyc/${caseId}/approve`, { reason }),
  rejectKycCase: (caseId: string, reason: string) => post(`/admin/kyc/${caseId}/reject`, { reason }),

  staff: () => request("/admin/staff"),
  roles: () => request("/admin/roles"),
  createStaff: (data: unknown) => post("/admin/staff", data),
  setStaffStatus: (id: string, status: "active" | "suspended" | "revoked") =>
    patch(`/admin/staff/${id}/status`, { status }),
  assignStaffRole: (id: string, roleId: string) =>
    post(`/admin/staff/${id}/roles`, { roleId }),
  removeStaffRole: (id: string, roleId: string) =>
    remove(`/admin/staff/${id}/roles/${roleId}`),
  createDelegation: (delegateeId: string, data: unknown) =>
    post(`/admin/staff/${delegateeId}/delegations`, data),
  revokeDelegation: (id: string) => remove(`/admin/staff/delegations/${id}`),

  orders: (status?: string) => request(`/admin/orders${status ? `?status=${status}` : ""}`),
  order: (id: string) => request(`/admin/orders/${id}`),
  approve: (id: string) => post(`/admin/orders/${id}/approve`),
  reject: (id: string) => post(`/admin/orders/${id}/reject`),
  pack: (id: string) => post(`/admin/orders/${id}/pack`),
  assign: (id: string, routeId: string, deliverySlot?: string) =>
    post(`/admin/dispatch/${id}/assign`, { routeId, deliverySlot }),
  capturePod: (
    id: string,
    podType: string,
    items: { orderItemId: string; qtyDelivered: number; weightDeliveredKg?: number }[]
  ) => post(`/admin/dispatch/${id}/pod`, { podType, items }),

  retailers: () => request("/admin/retailers"),
  retailer: (id: string) => request(`/admin/retailers/${id}`),
  retailerProposals: () => request("/admin/retailer-proposals"),
  retailerProposal: (id: string) => request(`/admin/retailer-proposals/${id}`),
  approveRetailerProposal: (id: string, reason?: string) =>
    post(`/admin/retailer-proposals/${id}/approve`, { reason }),
  rejectRetailerProposal: (id: string, reason: string) =>
    post(`/admin/retailer-proposals/${id}/reject`, { reason }),
  createRetailer: (data: unknown) => post("/admin/retailers", data),
  setTier: (id: string, tierId: string) => post(`/admin/retailers/${id}/tier`, { tierId }),
  setCreditLimit: (id: string, creditLimit: number) =>
    post(`/admin/retailers/${id}/credit-limit`, { creditLimit }),
  setPriceOverride: (id: string, variantId: string, price: number) =>
    post(`/admin/retailers/${id}/price-override`, { variantId, price }),
  ledger: (id: string) => request(`/admin/retailers/${id}/ledger`),
  recordPayment: (retailerId: string, amount: number, idempotencyKey: string) =>
    post("/admin/payments", { retailerId, amount, idempotencyKey }),
  correctionTargets: () => request("/admin/financial/correction-targets"),
  issueCreditNote: (
    invoiceId: string,
    amount: number,
    reason: string,
    idempotencyKey: string
  ) =>
    post("/admin/financial/credit-notes", {
      invoiceId,
      amount,
      reason,
      idempotencyKey,
    }),
  reversePayment: (
    paymentId: string,
    amount: number,
    reason: string,
    idempotencyKey: string
  ) =>
    post("/admin/financial/payment-reversals", {
      paymentId,
      amount,
      reason,
      idempotencyKey,
    }),

  tiers: () => request("/admin/tiers"),
  products: () => request("/admin/products"),
  setPrice: (tierId: string, variantId: string, price: number) =>
    post("/admin/price-list", { tierId, variantId, price }),
  locations: () => request("/admin/locations"),
  location: (retailerId: string) => request(`/admin/locations/${retailerId}`),
  locationHistory: (retailerId: string) => request(`/admin/locations/${retailerId}/history`),
  correctLocation: (retailerId: string, body: unknown) => post(`/admin/locations/${retailerId}/correct`, body),
  visits: (filters?: { status?: string; retailerId?: string; salespersonId?: string; territory?: string; from?: string; to?: string }) => {
    const query = new URLSearchParams();
    if (filters?.status) query.set("status", filters.status);
    if (filters?.retailerId) query.set("retailerId", filters.retailerId);
    if (filters?.salespersonId) query.set("salespersonId", filters.salespersonId);
    if (filters?.territory) query.set("territory", filters.territory);
    if (filters?.from) query.set("from", filters.from);
    if (filters?.to) query.set("to", filters.to);
    const suffix = query.toString();
    return request(`/admin/visits${suffix ? `?${suffix}` : ""}`);
  },
};

export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
