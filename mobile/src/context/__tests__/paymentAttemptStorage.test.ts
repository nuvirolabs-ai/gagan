import { describe, expect, it } from "vitest";
import { createPaymentAttemptStorage } from "../paymentAttemptStorage";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    async getItem(key: string) { return values.get(key) ?? null; },
    async setItem(key: string, value: string) { values.set(key, value); },
    async removeItem(key: string) { values.delete(key); },
  };
}

const payload = {
  amountCents: 10000,
  invoiceScopeId: "invoice-1",
  jainCents: 6000,
  padamCents: 4000,
};

describe("payment attempt storage", () => {
  it("reuses the retailer's key for the same payload after storage is reopened", async () => {
    const storage = memoryStorage();
    const first = createPaymentAttemptStorage(storage, () => "attempt-1");
    const key = await first.getOrCreate("retailer-1", payload);
    const reopened = createPaymentAttemptStorage(storage, () => "attempt-2");

    await expect(reopened.getOrCreate("retailer-1", payload)).resolves.toBe(key);
  });

  it("uses new keys when the amount, allocation, or retailer changes", async () => {
    const storage = memoryStorage();
    let sequence = 0;
    const attempts = createPaymentAttemptStorage(storage, () => `attempt-${++sequence}`);

    await expect(attempts.getOrCreate("retailer-1", payload)).resolves.toBe("attempt-1");
    await expect(attempts.getOrCreate("retailer-1", { ...payload, jainCents: 5000, padamCents: 5000 })).resolves.toBe("attempt-2");
    await expect(attempts.getOrCreate("retailer-2", payload)).resolves.toBe("attempt-3");
  });

  it("clears a completed attempt so a later payment gets a fresh key", async () => {
    const storage = memoryStorage();
    let sequence = 0;
    const attempts = createPaymentAttemptStorage(storage, () => `attempt-${++sequence}`);

    await attempts.getOrCreate("retailer-1", payload);
    await attempts.clear("retailer-1");

    await expect(attempts.getOrCreate("retailer-1", payload)).resolves.toBe("attempt-2");
  });
});
