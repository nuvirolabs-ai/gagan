import { Platform } from "react-native";
import { createSessionFetch, SessionFetchError } from "../auth/sessionFetch";
import { retailerSessionStore } from "../auth/secureSession";
import { resolveApiBaseUrl, type ApiPlatform } from "./config";
import { createRetailerApi } from "./retailerApi";

const BASE_URL = resolveApiBaseUrl(
  process.env.EXPO_PUBLIC_API_URL,
  __DEV__,
  Platform.OS as ApiPlatform
);

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

const request = createSessionFetch({
  baseUrl: BASE_URL,
  refreshPath: "/auth/refresh",
  store: retailerSessionStore,
  onUnauthorized: () => onUnauthorized?.(),
});

export const api = createRetailerApi(request, retailerSessionStore);
export { SessionFetchError as ApiError, retailerSessionStore };
