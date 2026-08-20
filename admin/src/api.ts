const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "gagan_admin_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

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

async function request(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));

  if (res.status === 401) {
    clearToken();
    onUnauthorized?.();
  }
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

const post = (path: string, body?: unknown) =>
  request(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });

export const api = {
  login: (email: string, password: string) => post("/admin/auth/login", { email, password }),
  me: () => request("/admin/auth/me"),

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
  recordPayment: (retailerId: string, amount: number) =>
    post("/admin/payments", { retailerId, amount }),

  tiers: () => request("/admin/tiers"),
  products: () => request("/admin/products"),
  setPrice: (tierId: string, variantId: string, price: number) =>
    post("/admin/price-list", { tierId, variantId, price }),
};

export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
