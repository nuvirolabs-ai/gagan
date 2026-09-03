import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { resolveApiBaseUrl, useFixturePulse } from "./config";
import { createSessionFetch } from "../auth/sessionFetch";
import { createSessionStore } from "../auth/sessionStore";
import { PULSE_FIXTURE } from "../fixtures/pulse";
import { composeCeoPayload, isCeoPulsePayload } from "../pulse/composeCeo";
import { mapSeriesBoard, mapTodayBoard } from "../pulse/mapPulse";
import type { SeriesPeriod } from "../pulse/types";
import type { FounderPulse } from "../pulse/viewState";
import type {
  FounderBrief,
  FounderDecision,
  FounderDecisions,
  FounderIssue,
  FounderIssueDetail,
  FounderTeam,
  FounderTrends,
  TrendPeriod,
} from "./types";

const memory = new Map<string, string>();
const webStore = {
  async getItemAsync(key: string) {
    if (Platform.OS === "web") return memory.get(key) ?? (await AsyncStorage.getItem(key));
    return SecureStore.getItemAsync(key);
  },
  async setItemAsync(key: string, value: string) {
    if (Platform.OS === "web") {
      memory.set(key, value);
      await AsyncStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async deleteItemAsync(key: string) {
    if (Platform.OS === "web") {
      memory.delete(key);
      await AsyncStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

const store = createSessionStore(webStore);
const baseUrl = resolveApiBaseUrl(
  process.env.EXPO_PUBLIC_API_URL,
  typeof __DEV__ !== "undefined" ? __DEV__ : false,
  Platform.OS as "ios" | "android" | "web"
);

let onUnauthorized: () => void = () => undefined;

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

const request = createSessionFetch({
  baseUrl,
  refreshPath: "/founder/auth/refresh",
  store,
  onUnauthorized: () => onUnauthorized(),
});

export const founderApi = {
  baseUrl,
  store,
  requestOtp(phone: string) {
    return request("/founder/auth/otp/request", { method: "POST", body: JSON.stringify({ phone }) }, false);
  },
  verifyOtp(input: { challengeId: string; phone: string; otp: string }) {
    return request("/founder/auth/otp/verify", { method: "POST", body: JSON.stringify(input) }, false);
  },
  me() {
    return request("/founder/me");
  },
  pulse(): Promise<FounderPulse> {
    return request("/founder/pulse");
  },
  trends(period: TrendPeriod): Promise<FounderTrends> {
    return request(`/founder/trends?period=${period}`);
  },
  issues(status: "open" | "resolved" | "all" = "open"): Promise<{ issues: FounderIssue[]; status: string }> {
    return request(`/founder/issues?status=${status}`);
  },
  issue(id: string): Promise<FounderIssueDetail> {
    return request(`/founder/issues/${id}`);
  },
  decisions(segment: "open" | "history"): Promise<FounderDecisions> {
    return request(`/founder/decisions?segment=${segment}`);
  },
  decision(id: string): Promise<FounderDecision> {
    return request(`/founder/decisions/${id}`);
  },
  approve(id: string, reason?: string): Promise<FounderDecision> {
    return request(`/founder/decisions/${id}/approve`, { method: "POST", body: JSON.stringify({ reason }) });
  },
  decline(id: string, reason: string): Promise<FounderDecision> {
    return request(`/founder/decisions/${id}/decline`, { method: "POST", body: JSON.stringify({ reason }) });
  },
  brief(kind: "morning" | "evening"): Promise<FounderBrief> {
    return request(`/founder/brief?kind=${kind}`);
  },
  team(): Promise<FounderTeam> {
    return request("/founder/team");
  },
};

const FORCE_FIXTURE =
  useFixturePulse(process.env.EXPO_PUBLIC_FOUNDER_USE_FIXTURE) ||
  process.env.EXPO_PUBLIC_PULSE_PREVIEW === "1";

async function loadCeoPayload() {
  if (FORCE_FIXTURE) {
    return {
      payload: { ...PULSE_FIXTURE, stagingGaps: ["preview-fixture"] },
      source: "fixture" as const,
    };
  }

  try {
    const pulse = await founderApi.pulse();
    if (isCeoPulsePayload(pulse)) {
      return { payload: pulse, source: "live" as const };
    }
    const candidate = (pulse as { pulse?: unknown }).pulse;
    if (isCeoPulsePayload(candidate)) {
      return { payload: candidate, source: "live" as const };
    }

    const [trends7, trends30, team, issuesWrap, decisionsWrap] = await Promise.all([
      founderApi.trends("7D").catch(() => null),
      founderApi.trends("30D").catch(() => null),
      founderApi.team().catch(() => null),
      founderApi.issues("open").catch(() => ({ issues: [] as FounderIssue[] })),
      founderApi.decisions("open").catch(() => ({ decisions: [] as FounderDecision[] })),
    ]);

    return composeCeoPayload({
      pulse,
      trends7,
      trends30,
      team,
      issues: issuesWrap.issues ?? [],
      decisions: decisionsWrap.decisions ?? [],
    });
  } catch {
    return {
      payload: { ...PULSE_FIXTURE, stagingGaps: ["all"] },
      source: "fixture" as const,
    };
  }
}

export async function loadTodayBoard() {
  const { payload, source } = await loadCeoPayload();
  const board = mapTodayBoard(payload, source);
  return { ...board, stagingGaps: payload.stagingGaps ?? [] };
}

export async function loadSeriesBoard(period: SeriesPeriod) {
  const { payload, source } = await loadCeoPayload();
  return mapSeriesBoard(payload, period, source);
}
