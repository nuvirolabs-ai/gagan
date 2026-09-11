import { describe, expect, it } from "vitest";
import { SessionFetchError } from "../../auth/sessionFetch";
import { createOutbox } from "../outbox";
import { isOfflineTransportError } from "../networkErrors";

describe("offline transport classification", () => {
  it("classifies Android UnknownHost failures as transport failures", async () => {
    const error = new Error(
      'fetch failed: java.net.UnknownHostException: Unable to resolve host "gagan-staging-api.onrender.com"'
    );
    expect(isOfflineTransportError(error)).toBe(true);

    const data = new Map<string, string>();
    const outbox = createOutbox({
      accountId: "staff-a",
      isCurrentAccount: () => true,
      storage: {
        getItem: async (key) => data.get(key) ?? null,
        setItem: async (key, value) => { data.set(key, value); },
      },
      senders: { customer_activity: async () => undefined, location_ping: async () => undefined },
    });
    if (isOfflineTransportError(error)) await outbox.queueActivity("activity-a", { retailerId: "retailer-a" });
    expect(await outbox.summary()).toMatchObject({ pending: 1 });
  });

  it.each([
    [400, "invalid activity"],
    [401, "unauthorized"],
    [403, "permission required"],
  ])("does not classify HTTP %s as offline", (status, message) => {
    expect(isOfflineTransportError(new SessionFetchError(status, { error: message }))).toBe(false);
  });

  it("does not classify business validation errors as offline", () => {
    expect(isOfflineTransportError(new Error("no_order_reason_required"))).toBe(false);
    expect(isOfflineTransportError(new Error("insufficient stock"))).toBe(false);
  });
});
