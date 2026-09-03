import { Platform } from "react-native";
import { createSessionFetch, SessionFetchError } from "../auth/sessionFetch";
import { founderSessionStore } from "../auth/secureSession";
import { resolveApiBaseUrl, useFixturePulse, type ApiPlatform } from "./config";
import { PULSE_FIXTURE } from "../fixtures/pulse";
import { mapSeriesBoard, mapTodayBoard } from "../pulse/mapPulse";
import type { FounderPulsePayload, SeriesPeriod } from "../pulse/types";

/**
 * Founder pulse client.
 *
 * BACKEND TODO: add GET /founder/pulse returning `FounderPulsePayload`.
 * Until that aggregate exists, this maps the Quiet Instrument fixture so Today
 * and Series stay informationally real. Staff OTP still uses /rep/auth so
 * Login/Settings work against the existing identity API.
 */
const BASE_URL = resolveApiBaseUrl(
  process.env.EXPO_PUBLIC_API_URL,
  __DEV__,
  Platform.OS as ApiPlatform
);

const FORCE_FIXTURE = useFixturePulse(process.env.EXPO_PUBLIC_FOUNDER_USE_FIXTURE);

export const DEMO_PHONE = "9000000001";
export const DEMO_OTP = "123456";
export const FIXTURE_TOKEN = "fixture.founder.local";

let onUnauthorized: (() => void) | null = null;
export const setFounderUnauthorizedHandler = (handler: (() => void) | null) => {
  onUnauthorized = handler;
};

const request = createSessionFetch({
  baseUrl: BASE_URL,
  refreshPath: "/rep/auth/refresh",
  store: founderSessionStore,
  onUnauthorized: () => onUnauthorized?.(),
});

function isFounderPulsePayload(value: unknown): value is FounderPulsePayload {
  if (!value || typeof value !== "object") return false;
  const v = value as FounderPulsePayload;
  return Boolean(v.sales && v.present && v.otif && v.payments && v.inventory && v.health);
}

export type StaffIdentity = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  permissions: string[];
};

const FIXTURE_STAFF: StaffIdentity = {
  id: "founder-fixture",
  name: "Ananya",
  phone: DEMO_PHONE,
  email: "ananya@gagan.test",
  permissions: ["legal.decide", "recovery.view"],
};

export const founderApi = {
  baseUrl: BASE_URL,
  forceFixture: FORCE_FIXTURE,

  requestOtp: (phone: string) => request("/rep/auth/otp/request", { method: "POST", body: JSON.stringify({ phone }) }, false),

  async verifyOtp(challengeId: string, phone: string, otp: string) {
    const result = await request(
      "/rep/auth/otp/verify",
      { method: "POST", body: JSON.stringify({ challengeId, phone, otp }) },
      false
    );
    await founderSessionStore.save({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    return result;
  },

  async logout() {
    try {
      const session = await founderSessionStore.load();
      if (session?.accessToken !== FIXTURE_TOKEN) {
        await request("/rep/auth/logout", { method: "POST" });
      }
    } finally {
      await founderSessionStore.clear();
    }
  },

  me: () => request("/rep/me"),

  async loadPulse(): Promise<{ payload: FounderPulsePayload; source: "live" | "fixture" }> {
    if (FORCE_FIXTURE) return { payload: PULSE_FIXTURE, source: "fixture" };
    try {
      const body = await request("/founder/pulse");
      const candidate = body?.pulse ?? body;
      if (isFounderPulsePayload(candidate)) return { payload: candidate, source: "live" };
    } catch (error) {
      if (error instanceof SessionFetchError && error.status !== 404 && error.status !== 401) {
        // Fall through to fixture so the board still renders.
      }
    }
    return { payload: PULSE_FIXTURE, source: "fixture" };
  },
};

export async function loadTodayBoard() {
  const { payload, source } = await founderApi.loadPulse();
  return mapTodayBoard(payload, source);
}

export async function loadSeriesBoard(period: SeriesPeriod) {
  const { payload, source } = await founderApi.loadPulse();
  return mapSeriesBoard(payload, period, source);
}

export function isDemoPhone(phone: string): boolean {
  return phone.replace(/\D/g, "") === DEMO_PHONE;
}

export function isDemoOtp(otp: string): boolean {
  return otp === DEMO_OTP;
}

export { SessionFetchError as ApiError, founderSessionStore, FIXTURE_STAFF, PULSE_FIXTURE };
