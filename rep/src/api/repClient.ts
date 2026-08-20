import { Platform } from "react-native";
import { createSessionFetch, SessionFetchError } from "../auth/sessionFetch";
import { staffSessionStore } from "../auth/secureSession";
import { resolveApiBaseUrl, type ApiPlatform } from "./config";
import { createStaffApi } from "./staffApi";

const BASE_URL = resolveApiBaseUrl(
  process.env.EXPO_PUBLIC_API_URL,
  __DEV__,
  Platform.OS as ApiPlatform
);

let onUnauthorized: (() => void) | null = null;
export const setRepUnauthorizedHandler = (handler: (() => void) | null) => {
  onUnauthorized = handler;
};

const request = createSessionFetch({
  baseUrl: BASE_URL,
  refreshPath: "/rep/auth/refresh",
  store: staffSessionStore,
  onUnauthorized: () => onUnauthorized?.(),
});

export const repApi = createStaffApi(request, staffSessionStore);
export { SessionFetchError as ApiError, staffSessionStore };
