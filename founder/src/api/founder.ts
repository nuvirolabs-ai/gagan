import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { resolveApiBaseUrl } from "./config";
import { createSessionFetch } from "../auth/sessionFetch";
import { createSessionStore } from "../auth/sessionStore";
import type { FounderPulse } from "../pulse/viewState";

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
};
