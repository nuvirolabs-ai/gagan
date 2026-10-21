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

async function requestBlob(path: string, allowRefresh = true): Promise<Blob> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: accessToken ? `Bearer ${accessToken}` : "" },
    credentials: "include",
  });
  if (res.status === 401 && allowRefresh) {
    try {
      await refreshAccessToken();
      return requestBlob(path, false);
    } catch {
      clearAccessToken();
      onUnauthorized?.();
    }
  }
  if (!res.ok) throw new ApiError(res.status, await parseResponse(res));
  return res.blob();
}

const post = (path: string, body?: unknown) =>
  request(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
const patch = (path: string, body: unknown) =>
  request(path, { method: "PATCH", body: JSON.stringify(body) });
const remove = (path: string) => request(path, { method: "DELETE" });
const put = (path: string, body: unknown) =>
  request(path, { method: "PUT", body: JSON.stringify(body) });

export const api = {
  exportServiceIssues: (filters?: { status?: string; retailerId?: string; salespersonId?: string; from?: string; through?: string }) => {
    const query = new URLSearchParams();
    if (filters?.status) query.set("status", filters.status);
    if (filters?.retailerId) query.set("retailerId", filters.retailerId);
    if (filters?.salespersonId) query.set("salespersonId", filters.salespersonId);
    if (filters?.from) query.set("from", filters.from);
    if (filters?.through) query.set("through", filters.through);
    return requestBlob(`/admin/exports/service-issues.xlsx${query.size ? `?${query}` : ""}`);
  },
  commercial:()=>request("/admin/commercial"),
  deliveryQuote:(id:string,lines:unknown)=>post(`/admin/commercial/orders/${id}/delivery-quote`,{lines}),
  saveCommercialSku:(id:string,body:unknown)=>request(`/admin/commercial/skus/${id}`,{method:"PUT",body:JSON.stringify(body)}),
  saveCommercialFreight:(id:string,body:unknown)=>request(`/admin/commercial/quotes/${id}/freight`,{method:"PUT",body:JSON.stringify(body)}),
  commercialBalances:(id:string)=>request(`/admin/commercial/invoices/${id}/balances`),
  commercialPayment:(id:string,key:string,body:unknown)=>request(`/admin/commercial/invoices/${id}/payments`,{method:"POST",headers:{"Idempotency-Key":key},body:JSON.stringify(body)}),
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
  collectionAssignments: (collectorStaffId: string) =>
    request(`/admin/collections/collectors/${collectorStaffId}/assignments`),
  collectionAssignmentRetailers: (collectorStaffId: string, search = "") =>
    request(`/admin/collections/assignment-retailers?collectorStaffId=${encodeURIComponent(collectorStaffId)}&search=${encodeURIComponent(search)}`),
  assignCollectionRetailer: (collectorStaffId: string, retailerId: string) =>
    post("/admin/collections/assignments", { collectorStaffId, retailerId }),
  unassignCollectionRetailer: (assignmentId: string) =>
    remove(`/admin/collections/assignments/${assignmentId}`),
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
  setupSellingLeader: (staffId: string, body: { managerId?: string | null; reportIds?: string[]; territory?: string }) =>
    post(`/admin/staff/${staffId}/selling-leader-setup`, body),
  createSellingLeader: (body: { newStaff: { name: string; phone: string; email: string; employeeRef?: string }; managerId?: string | null; reportIds?: string[]; territory?: string }) =>
    post("/admin/staff/selling-leader-setup", body),
  setupSalesperson: (staffId: string, body: { managerId?: string | null; territory?: string }) =>
    post(`/admin/staff/${staffId}/salesperson-setup`, body),
  createSalesperson: (body: { newStaff: { name: string; phone: string; email: string; employeeRef?: string }; managerId?: string | null; territory?: string }) =>
    post("/admin/staff/salesperson-setup", body),
  setupManagerOnly: (staffId: string) => post(`/admin/staff/${staffId}/manager-only-setup`),
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

  orders: (status?: string, warehouseCode?: string) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (warehouseCode && warehouseCode !== "all") params.set("warehouseCode", warehouseCode);
    const qs = params.toString();
    return request(`/admin/orders${qs ? `?${qs}` : ""}`);
  },
  orderCounts: (warehouseCode?: string) => {
    const params = new URLSearchParams();
    if (warehouseCode && warehouseCode !== "all") params.set("warehouseCode", warehouseCode);
    const qs = params.toString();
    return request(`/admin/orders/counts${qs ? `?${qs}` : ""}`);
  },
  order: (id: string) => request(`/admin/orders/${id}`),
  warehouseOrders: (status?: string, warehouseCode?: string) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (warehouseCode && warehouseCode !== "all") params.set("warehouseCode", warehouseCode);
    const qs = params.toString();
    return request(`/admin/warehouse-orders${qs ? `?${qs}` : ""}`);
  },
  warehouseOrder: (id: string) => request(`/admin/warehouse-orders/${id}`),
  warehouseRoutes: () => request("/admin/warehouse-orders/routes"),
  packWarehouseOrder: (id: string) => post(`/admin/warehouse-orders/${id}/pack`),
  dispatchWarehouseOrder: (id: string, routeId: string, deliverySlot?: string) =>
    post(`/admin/warehouse-orders/${id}/dispatch`, { routeId, deliverySlot }),
  deliverWarehouseOrder: (
    id: string,
    podType: string,
    items: { orderItemId: string; qtyDelivered: number; weightDeliveredKg?: number }[],
    transportationAmount?: number
  ) => post(`/admin/warehouse-orders/${id}/deliver`, { podType, items, transportationAmount }),
  downloadWarehouseOrderInvoicePdf: async (orderId: string, invoiceNumber?: number | string) => {
    const blob = await requestBlob(`/admin/warehouse-orders/${orderId}/invoice-pdf`);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Invoice-INV-${invoiceNumber || orderId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
  downloadOrderInvoicePdf: async (orderId: string, invoiceNumber?: number | string) => {
    const blob = await requestBlob(`/admin/orders/${orderId}/invoice-pdf`);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Invoice-INV-${invoiceNumber || orderId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
  approve: (id: string) => post(`/admin/orders/${id}/approve`),
  reject: (id: string, reason?: string) => post(`/admin/orders/${id}/reject`, { reason }),
  pack: (id: string) => post(`/admin/orders/${id}/pack`),
  commercialStatuses: (code?: string) => request(`/admin/commercial-status/orders${code ? `?code=${encodeURIComponent(code)}` : ""}`),
  commercialStatus: (id: string) => request(`/admin/commercial-status/orders/${id}`),
  toggleCommercialStatus: (id: string, code: string, active: boolean, reason?: string) =>
    post(`/admin/commercial-status/orders/${id}/toggle-code`, { code, active, reason }),
  holdOrder: (id: string, reason: string, idempotencyKey?: string) => request(`/admin/commercial-status/orders/${id}/hold`, { method: "POST", headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined, body: JSON.stringify({ reason }) }),
  releaseOrderHold: (id: string, reason?: string, idempotencyKey?: string) => request(`/admin/commercial-status/orders/${id}/release-hold`, { method: "POST", headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined, body: JSON.stringify({ reason }) }),
  assign: (id: string, routeId: string, deliverySlot?: string) =>
    post(`/admin/dispatch/${id}/assign`, { routeId, deliverySlot }),
  capturePod: (
    id: string,
    podType: string,
    items: { orderItemId: string; qtyDelivered: number; weightDeliveredKg?: number }[],
    transportationAmount?: number
  ) => post(`/admin/dispatch/${id}/pod`, { podType, items, transportationAmount }),

  retailers: () => request("/admin/retailers"),
  fieldRetailerMarketingHistory: (retailerId: string) =>
    request(`/admin/field/retailers/${retailerId}/marketing-history`),
  retailer: (id: string) => request(`/admin/retailers/${id}`),
  retailerProposal: (id: string) => request(`/admin/retailer-proposals/${id}`),
  createRetailer: (data: unknown) => post("/admin/retailers", data),
  setTier: (id: string, tierId: string) => post(`/admin/retailers/${id}/tier`, { tierId }),
  setInternalSegment: (id: string, internalSegment: "A" | "B" | "C" | null) =>
    post(`/admin/retailers/${id}/internal-segment`, { internalSegment }),
  setDeliveryCity: (id: string, deliveryCity: string) => post(`/admin/retailers/${id}/delivery-city`, { deliveryCity }),
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
  products: (view?: "all") => request(`/admin/products${view === "all" ? "?view=all" : ""}`),
  orderingSetup: (id: string) => request(`/admin/variants/${id}/ordering-setup`),
  saveOrderingDraft: (id: string, body: unknown) => request(`/admin/variants/${id}/ordering-draft`, { method: "PUT", body: JSON.stringify(body) }),
  enableOrdering: (id: string, body: unknown) => post(`/admin/variants/${id}/enable-ordering`, body),
  createProduct: (body: unknown) => post("/admin/products", body),
  createAndPublishProduct: (body: unknown) => post("/admin/products/publish", body),
  saveCatalogueSku: (body: unknown) => post("/admin/catalogue-skus", body),
  updateCatalogueSku: (variantId: string, body: unknown) => request(`/admin/catalogue-skus/${variantId}`, { method: "PUT", body: JSON.stringify(body) }),
  updateProduct: (id: string, body: unknown) => request(`/admin/products/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  updateVariant: (id: string, body: unknown) => request(`/admin/variants/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  addVariant: (productId: string, body: unknown) => post(`/admin/products/${productId}/variants`, body),
  publishCatalogue: (variantId: string, body: unknown) => post(`/admin/variants/${variantId}/publish-catalogue`, body),
  publishCatalogueFromBusiness: (variantId: string, body: unknown) => post(`/admin/variants/${variantId}/publish-catalogue-business`, body),
  setPrice: (tierId: string, variantId: string, price: number, rateBasis?: "case" | "quintal") =>
    post("/admin/price-list", { tierId, variantId, price, ...(rateBasis ? { rateBasis } : {}) }),
  quickEditVariant: (id: string, body: unknown) =>
    request(`/admin/variants/${id}/quick-edit`, { method: "PUT", body: JSON.stringify(body) }),
  quickEditProduct: (id: string, body: unknown) =>
    request(`/admin/products/${id}/quick-edit`, { method: "PUT", body: JSON.stringify(body) }),
  updateProductStatus: (id: string, status: "active" | "inactive") =>
    request(`/admin/products/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }),
  deleteProduct: (id: string) =>
    request(`/admin/products/${id}`, { method: "DELETE" }),
  updateVariantStatus: (id: string, status: "active" | "inactive") =>
    request(`/admin/variants/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }),
  deleteVariant: (id: string) =>
    request(`/admin/variants/${id}`, { method: "DELETE" }),
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
  beatTemplates: (salespersonId?: string) => request(`/admin/field/beat-templates${salespersonId ? `?salespersonId=${encodeURIComponent(salespersonId)}` : ""}`),
  saveBeatTemplate: (body: { salespersonId: string; name: string; stops: Array<{ retailerId: string; purpose?: string; note?: string }> }) =>
    post("/admin/field/beat-templates", body),
  updateBeatTemplate: (id: string, body: { salespersonId: string; name: string; stops: Array<{ retailerId: string; purpose?: string; note?: string }> }) =>
    request(`/admin/field/beat-templates/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  applyBeatTemplate: (id: string, body: { salespersonId: string; planDate: string }) =>
    post(`/admin/field/beat-templates/${id}/apply`, body),

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
  expenseHistory: (salespersonId: string, cursor?: string) =>
    request(`/admin/field/expenses/staff/${encodeURIComponent(salespersonId)}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`),
  expenseReceipt: (salespersonId: string, expenseId: string) =>
    request(`/admin/field/expenses/staff/${encodeURIComponent(salespersonId)}/receipts/${encodeURIComponent(expenseId)}`),
  expenseClaimants: () => request("/admin/field/expenses/claimants"),
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
  salespersonFeedback: (cursor?: string) => request(`/admin/salesperson-feedback${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`),

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

  retailerProposals: (status?: string, salespersonId?: string) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (salespersonId) params.set("salespersonId", salespersonId);
    const qs = params.toString();
    return request(`/admin/retailer-proposals${qs ? `?${qs}` : ""}`);
  },
  approveRetailerProposal: (id: string, tierId?: string) =>
    post(`/admin/retailer-proposals/${id}/approve`, tierId ? { tierId } : {}),
  rejectRetailerProposal: (id: string, reason: string) =>
    post(`/admin/retailer-proposals/${id}/reject`, { reason }),

  /* ----------------------------- market surveys ----------------------------- */
  surveys: (status?: string) => request(`/admin/surveys${status ? `?status=${status}` : ""}`),
  survey: (id: string) => request(`/admin/surveys/${id}`),
  createSurvey: (body: unknown) => post("/admin/surveys", body),
  updateSurvey: (id: string, body: unknown) => patch(`/admin/surveys/${id}`, body),
  activateSurvey: (id: string) => post(`/admin/surveys/${id}/activate`),
  closeSurvey: (id: string) => post(`/admin/surveys/${id}/close`),
  surveyResponses: (id: string, respondentType?: string) => request(`/admin/surveys/${id}/responses${respondentType ? `?respondentType=${respondentType}` : ""}`),
  surveySummary: (id: string) => request(`/admin/surveys/${id}/summary`),

  salesTargets: (salespersonId?: string, scope: "PERSONAL" | "TEAM" | "all" = "all") =>
    request(`/admin/field/targets?scope=${scope}${salespersonId ? `&salespersonId=${encodeURIComponent(salespersonId)}` : ""}`),
  setSalesTarget: (body: {
    salespersonId: string;
    scope: "PERSONAL" | "TEAM";
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

  importTypes: () => request("/admin/imports/types"),
  imports: () => request("/admin/imports"),
  importJob: (id: string) => request(`/admin/imports/${id}`),
  importPreview: async (type: string, mode: string, file: File) => {
    const res = await fetch(`${BASE_URL}/admin/imports/preview`, {
      method: "POST",
      body: file,
      headers: {
        Authorization: accessToken ? `Bearer ${accessToken}` : "",
        "Content-Type": "application/octet-stream",
        "X-File-Name": file.name,
        "X-Import-Type": type,
        "X-Import-Mode": mode,
      },
      credentials: "include",
    });
    const body = await parseResponse(res);
    if (!res.ok) throw new ApiError(res.status, body);
    return body;
  },
  applyImport: (id: string) => post(`/admin/imports/${id}/apply`, { confirm: true }),
  importTemplate: async (type: string, format: "csv" | "xlsx") => {
    const res = await fetch(`${BASE_URL}/admin/imports/templates/${type}.${format}`, {
      headers: { Authorization: accessToken ? `Bearer ${accessToken}` : "" },
      credentials: "include",
    });
    if (!res.ok) throw new ApiError(res.status, await parseResponse(res));
    return res.blob();
  },
  importErrors: async (id: string) => {
    const res = await fetch(`${BASE_URL}/admin/imports/${id}/errors.csv`, {
      headers: { Authorization: accessToken ? `Bearer ${accessToken}` : "" },
      credentials: "include",
    });
    if (!res.ok) throw new ApiError(res.status, await parseResponse(res));
    return res.blob();
  },

  // Warehouses & Routing (Gap 1)
  warehouses: () => request("/admin/warehouses"),
  createWarehouse: (body: unknown) => post("/admin/warehouses", body),
  updateWarehouse: (id: string, body: unknown) => put(`/admin/warehouses/${id}`, body),
  cityRoutings: () => request("/admin/warehouses/routing"),
  upsertCityRouting: (body: unknown) => post("/admin/warehouses/routing", body),
  deleteCityRouting: (id: string) => remove(`/admin/warehouses/routing/${id}`),

  // Staff Profile CRUD (Gap 2)
  updateStaffProfile: (id: string, body: unknown) => patch(`/admin/staff/${id}`, body),

  // Bulk Retailer Reassignment (Gap 3)
  bulkReassignRetailers: (retailerIds: string[], salesRepId: string) =>
    post("/admin/retailers/bulk-reassign", { retailerIds, salesRepId }),

  // Target Setting Matrix (Gap 4)
  targetMatrix: () => request("/admin/field/targets/matrix"),
  saveTargetMatrix: (updates: unknown[]) => post("/admin/field/targets/matrix", { updates }),

  // Global AppConfig & Policies (Gap 5)
  appConfig: () => request("/admin/app-config"),
  updateAppConfig: (body: unknown) => put("/admin/app-config", body),

  // Gap 6: Pricing Tier & Slab Rule Editor
  tiersWithSlabs: () => request("/admin/commercial/tiers"),
  createTier: (body: unknown) => post("/admin/commercial/tiers", body),
  updateTier: (id: string, body: unknown) => put(`/admin/commercial/tiers/${id}`, body),
  deleteTier: (id: string) => remove(`/admin/commercial/tiers/${id}`),
  createSlab: (tierId: string, body: unknown) => post(`/admin/commercial/tiers/${tierId}/slabs`, body),
  updateSlab: (tierId: string, slabId: string, body: unknown) => put(`/admin/commercial/tiers/${tierId}/slabs/${slabId}`, body),
  deleteSlab: (tierId: string, slabId: string) => remove(`/admin/commercial/tiers/${tierId}/slabs/${slabId}`),

  // Gap 7: Credit Policy & Mode Gate
  creditPolicy: () => request("/admin/credit/policy"),
  setCreditMode: (mode: "shadow" | "enforce") => post("/admin/credit/policy/mode", { mode }),
  overrideRetailerCreditLimit: (retailerId: string, body: { newLimit: number; reason: string; expiresDays?: number }) =>
    post(`/admin/credit/retailers/${retailerId}/override-limit`, body),
  setRetailerPaymentTerms: (retailerId: string, body: { paymentTermsDays?: number; creditLimit?: number }) =>
    post(`/admin/credit/retailers/${retailerId}/payment-terms`, body),

  // Gap 8: Full Retailer Profile & KYC Master Editor
  retailerFullProfile: (id: string) => request(`/admin/retailers/${id}/full-profile`),
  updateRetailerFullProfile: (id: string, body: unknown) => put(`/admin/retailers/${id}/full-profile`, body),
  updateRetailerCoordinates: (id: string, body: { lat: number; lng: number; reason?: string }) =>
    post(`/admin/retailers/${id}/coordinates`, body),
  decideRetailerKyc: (id: string, body: { decision: "APPROVE" | "REJECT"; reason?: string; rejectionReason?: string }) =>
    post(`/admin/retailers/${id}/kyc-decision`, body),

  // Gap 9: Catalog Category & Brand Hierarchy Master
  categories: () => request("/admin/categories"),
  createCategory: (body: unknown) => post("/admin/categories", body),
  updateCategory: (id: string, body: unknown) => put(`/admin/categories/${id}`, body),
  deleteCategory: (id: string) => remove(`/admin/categories/${id}`),
  brands: () => request("/admin/brands"),
  createBrand: (body: unknown) => post("/admin/brands", body),
  updateBrand: (id: string, body: unknown) => put(`/admin/brands/${id}`, body),
  deleteBrand: (id: string) => remove(`/admin/brands/${id}`),

  // Gap 10: Product Media & Asset Manager
  catalogMedia: () => request("/admin/catalog/media"),
  updateProductImage: (id: string, imageUrl: string, cascadeToVariants = true) => post(`/admin/catalog/products/${id}/image`, { imageUrl, cascadeToVariants }),
  updateVariantImage: (id: string, imageUrl: string) => post(`/admin/catalog/variants/${id}/image`, { imageUrl }),

  // Gap 11: Tax / GST Rates & HSN Code Master
  taxHsnCodes: () => request("/admin/tax/hsn"),
  createHsnCode: (body: unknown) => post("/admin/tax/hsn", body),
  updateHsnCode: (id: string, body: unknown) => put(`/admin/tax/hsn/${id}`, body),
  deleteHsnCode: (id: string) => remove(`/admin/tax/hsn/${id}`),
  applyHsnToVariants: (hsnCode: string, variantIds: string[]) =>
    post("/admin/tax/apply-hsn-to-variants", { hsnCode, variantIds }),

  // Gap 12: Inventory Stock Adjustments & Transfer Manager
  inventorySummary: (warehouseCode?: string) =>
    request(`/admin/inventory/summary${warehouseCode ? `?warehouseCode=${encodeURIComponent(warehouseCode)}` : ""}`),
  inventoryMovements: (warehouseCode?: string) =>
    request(`/admin/inventory/movements${warehouseCode ? `?warehouseCode=${encodeURIComponent(warehouseCode)}` : ""}`),
  recordStockAdjustment: (body: unknown) => post("/admin/inventory/adjustments", body),
  inventoryTransfers: () => request("/admin/inventory/transfers"),
  createStockTransfer: (body: unknown) => post("/admin/inventory/transfers", body),
  updateTransferStatus: (id: string, status: string) => post(`/admin/inventory/transfers/${id}/status`, { status }),
  setVariantLowStockThreshold: (id: string, threshold: number) =>
    post(`/admin/inventory/variants/${id}/low-stock-threshold`, { threshold }),

  // Gap 13: Delivery Fleet & Vehicle Run Dispatcher
  fleetVehicles: () => request("/admin/fleet/vehicles"),
  createFleetVehicle: (body: unknown) => post("/admin/fleet/vehicles", body),
  updateFleetVehicle: (id: string, body: unknown) => put(`/admin/fleet/vehicles/${id}`, body),
  deleteFleetVehicle: (id: string) => remove(`/admin/fleet/vehicles/${id}`),
  deliveryRuns: (warehouseCode?: string) =>
    request(`/admin/fleet/runs${warehouseCode ? `?warehouseCode=${encodeURIComponent(warehouseCode)}` : ""}`),
  createDeliveryRun: (body: unknown) => post("/admin/fleet/runs", body),
  updateRunStatus: (id: string, status: string) => post(`/admin/fleet/runs/${id}/status`, { status }),

  // Gap 14: Customer Schemes & Trade Promotion Engine
  promotionalSchemes: () => request("/admin/promotions/schemes"),
  createScheme: (body: unknown) => post("/admin/promotions/schemes", body),
  updateScheme: (id: string, body: unknown) => put(`/admin/promotions/schemes/${id}`, body),
  toggleSchemeActive: (id: string) => post(`/admin/promotions/schemes/${id}/toggle-active`, {}),
  deleteScheme: (id: string) => remove(`/admin/promotions/schemes/${id}`),

  // Gap 15: Market Surveys & Field Task Creator
  fieldTasksList: (status?: string, salespersonId?: string) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (salespersonId) params.set("salespersonId", salespersonId);
    const qs = params.toString();
    return request(`/admin/field-tasks${qs ? `?${qs}` : ""}`);
  },
  createFieldTask: (body: unknown) => post("/admin/field-tasks", body),
  fieldTaskEvidence: (id: string) => request(`/admin/field-tasks/${id}/evidence`),

  // Gap 16: Salesperson Expense & Leave Approvals Portal
  portalExpenses: (status?: string) =>
    request(`/admin/field-approvals/expenses${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  decidePortalExpense: (id: string, decision: "approved" | "rejected", note?: string) =>
    post(`/admin/field-approvals/expenses/${id}/decision`, { decision, note }),
  portalLeaves: (status?: string) =>
    request(`/admin/field-approvals/leaves${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  decidePortalLeave: (id: string, decision: "approved" | "rejected", note?: string) =>
    post(`/admin/field-approvals/leaves/${id}/decision`, { decision, note }),

  // Gap 17: Notification & Broadcast Center
  broadcasts: (params?: { search?: string; status?: string; audience?: string }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.status) qs.set("status", params.status);
    if (params?.audience) qs.set("audience", params.audience);
    const queryString = qs.toString();
    return request(`/admin/broadcasts${queryString ? `?${queryString}` : ""}`);
  },
  createBroadcast: (body: unknown) => post("/admin/broadcasts", body),
  cancelBroadcast: (id: string) => patch(`/admin/broadcasts/${id}/cancel`, {}),
  resendBroadcast: (id: string) => post(`/admin/broadcasts/${id}/resend`, {}),
  deleteBroadcast: (id: string) => remove(`/admin/broadcasts/${id}`),

  // Gap 18: Role-Based Access Control (RBAC) & Permissions Editor
  rbacRoles: () => request("/admin/rbac/roles"),
  rbacPermissions: () => request("/admin/rbac/permissions"),
  createRbacRole: (body: unknown) => post("/admin/rbac/roles", body),
  updateRbacRole: (id: string, body: unknown) => put(`/admin/rbac/roles/${id}`, body),
  updateRbacRolePermissions: (id: string, permissionIds: string[]) =>
    put(`/admin/rbac/roles/${id}/permissions`, { permissionIds }),
  deleteRbacRole: (id: string) => remove(`/admin/rbac/roles/${id}`),
  rbacAuditTrail: () => request("/admin/rbac/audit-trail"),
};

export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
