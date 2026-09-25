import { describe, expect, it } from "vitest";
import { MockPaymentProvider } from "./mockProvider";

describe("mock payment intent idempotency", () => {
  it("returns the same provider intent for a repeated stable payment reference", async () => {
    const provider = new MockPaymentProvider();
    const params = {
      amount: 100,
      currency: "INR" as const,
      retailerId: "retailer-1",
      reference: "payment-attempt-1",
    };

    const first = await provider.createIntent(params);
    const retry = await provider.createIntent(params);
    const separatePayment = await provider.createIntent({ ...params, reference: "payment-attempt-2" });

    expect(retry).toEqual(first);
    expect(separatePayment.providerRef).not.toBe(first.providerRef);
  });
});
