import { SessionFetchError } from "../auth/sessionFetch";

/**
 * Only transport failures may enter the existing activity outbox. HTTP
 * responses, including validation and permission failures, must remain visible
 * errors even when their text happens to contain a network-like word.
 */
export function isOfflineTransportError(error: unknown): boolean {
  if (error instanceof SessionFetchError) return false;
  if (error instanceof TypeError) return true;

  const raw = error instanceof Error ? error.message : String(error ?? "");
  return /network request failed|failed to fetch|load failed|unknownhostexception|unable to resolve host|dns(?: resolution| lookup)?(?: failed| error)|connection (?:refused|reset|timed out)|network is unreachable|no route to host|(?:request|connection) timed out/i.test(raw);
}
