import { PaymentProvider } from "./provider";
import { MockPaymentProvider } from "./mockProvider";

export * from "./provider";

/**
 * Selects the active provider. When the gateway decision in spec §9 is made,
 * add the implementation and a case here — nothing else changes.
 */
export function getPaymentProvider(): PaymentProvider {
  const configured = (process.env.PAYMENT_PROVIDER || "mock").toLowerCase();

  switch (configured) {
    case "mock":
      return new MockPaymentProvider();
    default:
      throw new Error(
        `Unknown PAYMENT_PROVIDER "${configured}". Implement it under src/lib/payments/ and register it here.`
      );
  }
}

export const paymentsEnabled = () => (process.env.PAYMENT_PROVIDER || "mock") !== "off";
