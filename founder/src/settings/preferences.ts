import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TrendPeriod } from "../api/types";

export type AppearancePref = "system" | "light" | "dark";

export interface FounderPreferences {
  defaultPeriod: TrendPeriod;
  appearance: AppearancePref;
}

const KEY = "founder.preferences.v1";
export const DEFAULT_PREFERENCES: FounderPreferences = { defaultPeriod: "30D", appearance: "system" };

export async function loadPreferences(): Promise<FounderPreferences> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const parsed = JSON.parse(raw) as Partial<FounderPreferences>;
    return {
      defaultPeriod: parsed.defaultPeriod === "7D" || parsed.defaultPeriod === "90D" ? parsed.defaultPeriod : "30D",
      appearance: parsed.appearance === "light" || parsed.appearance === "dark" ? parsed.appearance : "system",
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function savePreferences(next: FounderPreferences): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export function schemeFrom(pref: AppearancePref, system: string | null | undefined): "light" | "dark" {
  if (pref === "light" || pref === "dark") return pref;
  return system === "dark" ? "dark" : "light";
}
