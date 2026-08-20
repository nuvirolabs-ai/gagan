import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// iOS simulator reaches the host's localhost directly; the Android emulator
// needs 10.0.2.2. For a physical device, point this at the host's LAN IP.
const BASE_URL = Platform.select({
  ios: "http://localhost:4000",
  android: "http://10.0.2.2:4000",
  default: "http://localhost:4000",
});

const REP_TOKEN_KEY = "gagan_rep_token";

export const getRepToken = () => AsyncStorage.getItem(REP_TOKEN_KEY);
export const setRepToken = (t: string) => AsyncStorage.setItem(REP_TOKEN_KEY, t);
export const clearRepToken = () => AsyncStorage.removeItem(REP_TOKEN_KEY);

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, body: any) {
    super(body?.error || `Request failed with status ${status}`);
    this.status = status;
    this.body = body;
  }
}

// Set by RepProvider so a rejected session can drop the app back to Login from
// anywhere, without every caller having to handle 401 itself.
let onRepUnauthorized: (() => void) | null = null;
export const setRepUnauthorizedHandler = (fn: (() => void) | null) => {
  onRepUnauthorized = fn;
};

async function request(path: string, options: RequestInit = {}, auth = true) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (auth) {
    const token = await getRepToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));

  if (res.status === 401 && auth) {
    await clearRepToken();
    onRepUnauthorized?.();
  }
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

export const repApi = {
  requestOtp: (phone: string) =>
    request("/rep/auth/otp/request", { method: "POST", body: JSON.stringify({ phone }) }, false),
  verifyOtp: (phone: string, otp: string) =>
    request("/rep/auth/otp/verify", { method: "POST", body: JSON.stringify({ phone, otp }) }, false),
  me: () => request("/rep/me"),
  retailers: () => request("/rep/retailers"),
  retailer: (id: string) => request(`/rep/retailers/${id}`),
  catalogFor: (id: string) => request(`/rep/retailers/${id}/catalog`),
  createOrder: (retailerId: string, items: { variantId: string; qty: number }[]) =>
    request("/rep/orders", { method: "POST", body: JSON.stringify({ retailerId, items }) }),
};
