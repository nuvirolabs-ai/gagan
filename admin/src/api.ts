const BASE_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV
    ? "http://localhost:4000"
    : (() => {
        throw new Error("VITE_API_URL is required outside local development");
      })());
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

  /* ------------------------- field operations back office ------------------------ */

  fieldAttendance: (date?: string) =>
    request(`/admin/field/attendance${date ? `?date=${date}` : ""}`),
  fieldAttendanceFor: (salespersonId: string, from?: string, to?: string) => {
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    const suffix = query.toString();
    return request(`/admin/field/attendance/${salespersonId}${suffix ? `?${suffix}` : ""}`);
  },
  leaveRequests: (status?: string) =>
    request(`/admin/field/leave${status ? `?status=${status}` : ""}`),
  decideLeave: (id: string, decision: "approved" | "rejected", note?: string) =>
    post(`/admin/field/leave/${id}/decision`, { decision, note }),

  routePlans: (filters?: { salespersonId?: string; from?: string; to?: string }) => {
    const query = new URLSearchParams();
    if (filters?.salespersonId) query.set("salespersonId", filters.salespersonId);
    if (filters?.from) query.set("from", filters.from);
    if (filters?.to) query.set("to", filters.to);
    const suffix = query.toString();
    return request(`/admin/field/routes${suffix ? `?${suffix}` : ""}`);
  },
  saveRoutePlan: (body: {
    salespersonId: string;
    planDate: string;
    name?: string;
    stops: Array<{ retailerId: string; purpose?: string; note?: string }>;
  }) => post("/admin/field/routes", body),
  publishRoutePlan: (id: string) => post(`/admin/field/routes/${id}/publish`),

  fieldTasks: (filters?: { salespersonId?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (filters?.salespersonId) query.set("salespersonId", filters.salespersonId);
    if (filters?.status) query.set("status", filters.status);
    const suffix = query.toString();
    return request(`/admin/field/tasks${suffix ? `?${suffix}` : ""}`);
  },
  assignFieldTask: (body: {
    assignedToStaffId: string;
    title: string;
    description?: string;
    retailerId?: string;
    priority?: string;
    dueAt?: string;
  }) => post("/admin/field/tasks", body),
  cancelFieldTask: (id: string) => post(`/admin/field/tasks/${id}/cancel`),

  fieldExpenses: (filters?: { status?: string; salespersonId?: string }) => {
    const query = new URLSearchParams();
    if (filters?.status) query.set("status", filters.status);
    if (filters?.salespersonId) query.set("salespersonId", filters.salespersonId);
    const suffix = query.toString();
    return request(`/admin/field/expenses${suffix ? `?${suffix}` : ""}`);
  },
  decideExpense: (id: string, decision: "approved" | "rejected", note?: string) =>
    post(`/admin/field/expenses/${id}/decision`, { decision, note }),

  serviceIssues: (filters?: { status?: string; retailerId?: string }) => {
    const query = new URLSearchParams();
    if (filters?.status) query.set("status", filters.status);
    if (filters?.retailerId) query.set("retailerId", filters.retailerId);
    const suffix = query.toString();
    return request(`/admin/field/issues${suffix ? `?${suffix}` : ""}`);
  },
  updateServiceIssue: (
    id: string,
    body: { status: string; assignedTeam?: string; resolutionNote?: string }
  ) => post(`/admin/field/issues/${id}/status`, body),

  fieldTeam: (date?: string) => request(`/admin/field/team${date ? `?to=${date}` : ""}`),
  liveFieldPositions: () => request("/admin/field/tracking/live"),
  fieldTrack: (salespersonId: string, date?: string) =>
    request(`/admin/field/tracking/${salespersonId}${date ? `?date=${date}` : ""}`),

  /* --------------------------- sales leadership --------------------------- */

  // The team is the caller's reporting tree, resolved on the server; a
  // salespersonId narrows within it and is rejected if it falls outside.
  salesLeader: (salespersonId?: string) =>
    request(`/admin/sales-leader${salespersonId ? `?salespersonId=${salespersonId}` : ""}`),
  salesLeaderRanking: (scope: "team" | "territory" | "company", territory?: string) => {
    const query = new URLSearchParams({ scope });
    if (territory) query.set("territory", territory);
    return request(`/admin/sales-leader/ranking?${query.toString()}`);
  },
  salesLeaderOpportunities: (view: "team" | "direct" | "person", salespersonId?: string) => {
    const query = new URLSearchParams({ view });
    if (salespersonId) query.set("salespersonId", salespersonId);
    return request(`/admin/sales-leader/opportunities?${query.toString()}`);
  },

  /* --------------------------- sales organisation ------------------------- */

  orgTree: () => request("/admin/org/tree"),
  orgUnassigned: () => request("/admin/org/unassigned"),
  orgStaff: (staffId: string) => request(`/admin/org/staff/${staffId}`),
  orgEligibleManagers: (staffId: string) => request(`/admin/org/staff/${staffId}/eligible-managers`),
  setOrgManager: (staffId: string, managerId: string | null, reason?: string) =>
    post(`/admin/org/staff/${staffId}/manager`, { managerId, reason }),

  retailerProposals: (status?: string) =>
    request(`/admin/retailer-proposals${status ? `?status=${status}` : ""}`),
  approveRetailerProposal: (id: string, tierId?: string) =>
    post(`/admin/retailer-proposals/${id}/approve`, tierId ? { tierId } : {}),
  rejectRetailerProposal: (id: string, reason: string) =>
    post(`/admin/retailer-proposals/${id}/reject`, { reason }),

  salesTargets: (salespersonId?: string) =>
    request(`/admin/field/targets${salespersonId ? `?salespersonId=${salespersonId}` : ""}`),
  setSalesTarget: (body: {
    salespersonId: string;
    metric: string;
    periodStart: string;
    periodEnd: string;
    targetValue: number;
  }) => post("/admin/field/targets", body),

  sapStatus: () => request("/admin/sap/status"),
  sapSync: (entity: "customers" | "materials" | "pricing" | "stock" | "all" = "all") =>
    post("/admin/sap/sync", { entity }),
  sapOutbox: (status?: string) =>
    request(`/admin/sap/outbox${status ? `?status=${status}` : ""}`),
  sapDrain: () => post("/admin/sap/outbox/drain"),
  sapRetry: (id: string) => post(`/admin/sap/outbox/${id}/retry`),
};

export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
