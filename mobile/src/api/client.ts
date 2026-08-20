import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// iOS simulator can reach the host's localhost directly.
// Android emulator needs 10.0.2.2. Physical devices need the host machine's LAN IP.
const BASE_URL = Platform.select({
  ios: "http://localhost:4000",
  android: "http://10.0.2.2:4000",
  default: "http://localhost:4000",
});

const TOKEN_KEY = "gagan_token";

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

// Set by AuthProvider so a rejected session can drop the app back to Login from
// anywhere, without every caller having to handle 401 itself.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, body: any) {
    super(body?.error || `Request failed with status ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function request(path: string, options: RequestInit = {}, auth = true) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 && auth) {
    await clearToken();
    onUnauthorized?.();
  }
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

export const api = {
  requestOtp: (phone: string) =>
    request("/auth/otp/request", { method: "POST", body: JSON.stringify({ phone }) }, false),
  verifyOtp: (phone: string, otp: string) =>
    request("/auth/otp/verify", { method: "POST", body: JSON.stringify({ phone, otp }) }, false),
  me: () => request("/auth/me"),
  getHome: () => request("/home"),
  getCatalog: () => request("/catalog"),
  getProduct: (id: string) => request(`/products/${id}`),
  createOrder: (items: { variantId: string; qty: number }[]) =>
    request("/orders", { method: "POST", body: JSON.stringify({ items }) }),
  getOrders: () => request("/orders"),
  getOrder: (id: string) => request(`/orders/${id}`),
  getLedger: (retailerId: string) => request(`/ledger/${retailerId}`),

  getDues: () => request("/payments/dues"),
  createPaymentIntent: (amount: number) =>
    request("/payments/intent", { method: "POST", body: JSON.stringify({ amount }) }),
  /**
   * Dev-only: stands in for the retailer authorising in a real UPI app. The
   * server still verifies the signature, so this can't fake a payment.
   */
  confirmMockPayment: (providerRef: string, signature: string, outcome = "succeeded") =>
    request(
      "/payments/callback",
      { method: "POST", body: JSON.stringify({ providerRef, signature, outcome }) },
      false
    ),
  getPayment: (id: string) => request(`/payments/${id}`),
  getPayments: () => request("/payments"),
  getDeliveryStatus: (orderId: string) => request(`/delivery/${orderId}/status`),
};
