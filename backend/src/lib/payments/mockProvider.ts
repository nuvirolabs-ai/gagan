import crypto from "crypto";
import { PaymentProvider, PaymentIntent, VerifiedEvent } from "./provider";

/**
 * Development stand-in for a real UPI gateway.
 *
 * It signs its callbacks with MOCK_PAYMENT_SECRET using the same
 * verify-signature-before-acting flow a real provider requires, so the
 * settlement path is exercised honestly rather than trusting any POST.
 *
 * Not for production: it authorises whatever it is told to.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";
  private readonly secret = process.env.MOCK_PAYMENT_SECRET || "dev-payment-secret";

  async createIntent(params: {
    amount: number;
    currency: "INR";
    retailerId: string;
    reference: string;
  }): Promise<PaymentIntent> {
    const providerRef = `mock_${crypto.randomBytes(8).toString("hex")}`;
    return {
      providerRef,
      // A real provider returns a UPI intent link or hosted checkout URL here.
      redirectUrl: null,
      clientPayload: {
        provider: this.name,
        providerRef,
        amount: params.amount,
        currency: params.currency,
        // The app shows a confirm screen and calls back with this.
        confirmToken: this.sign(providerRef, "succeeded"),
      },
    };
  }

  /** HMAC over ref+outcome — the shape of signature a real gateway sends. */
  sign(providerRef: string, outcome: string): string {
    return crypto
      .createHmac("sha256", this.secret)
      .update(`${providerRef}:${outcome}`)
      .digest("hex");
  }

  verifyCallback(
    rawBody: unknown,
    _headers: Record<string, string | undefined>
  ): VerifiedEvent | null {
    const body = rawBody as
      | { providerRef?: string; outcome?: string; signature?: string; reason?: string }
      | undefined;
    if (!body?.providerRef || !body.outcome || !body.signature) return null;

    const expected = this.sign(body.providerRef, body.outcome);
    const given = body.signature;
    // Constant-time compare; mismatched lengths would throw otherwise.
    if (
      expected.length !== given.length ||
      !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given))
    ) {
      return null;
    }

    if (body.outcome === "succeeded") return { providerRef: body.providerRef, status: "succeeded" };
    if (body.outcome === "cancelled") return { providerRef: body.providerRef, status: "cancelled" };
    if (body.outcome === "failed") {
      return {
        providerRef: body.providerRef,
        status: "failed",
        reason: body.reason || "Payment failed",
      };
    }
    return null;
  }
}
