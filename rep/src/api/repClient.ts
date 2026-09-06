import { Platform } from "react-native";
import { createSessionFetch, SessionFetchError } from "../auth/sessionFetch";
import { staffSessionStore } from "../auth/secureSession";
import { resolveApiBaseUrl, type ApiPlatform } from "./config";
import { createStaffApi } from "./staffApi";
import { createAccountBoundary } from "../auth/accountBoundary";

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
const accountBoundary = createAccountBoundary();
export const setRepAccount = accountBoundary.set;
export function accountReplayApi(accountId: string) {
  const isCurrentAccount = accountBoundary.bind(accountId);
  const assertAccount = () => { if (!isCurrentAccount()) throw new Error("outbox_account_changed"); };
  const scopedStore = {
    ...staffSessionStore,
    async load() {
      assertAccount();
      const tokens = await staffSessionStore.load();
      assertAccount();
      if (!tokens) throw new Error("outbox_session_required");
      return tokens;
    },
  };
  const scopedRequest = createSessionFetch({ baseUrl: BASE_URL, refreshPath: "/rep/auth/refresh", store: scopedStore });
  // Replay never refreshes/clears a possibly replaced login. Normal foreground
  // session restoration refreshes credentials; a 401 retains queued work.
  const api = createStaffApi((path, options, auth) => scopedRequest(path, options, auth, false), scopedStore);
  return { api, isCurrentAccount };
}
export { SessionFetchError as ApiError, staffSessionStore };
