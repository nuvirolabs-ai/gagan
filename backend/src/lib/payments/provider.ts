/**
 * Payment provider boundary.
 *
 * Spec §9 leaves the UPI provider open, so nothing above this interface knows
 * which one is in use. Adding Razorpay / PhonePe / Cashfree means writing one
 * more implementation and changing PAYMENT_PROVIDER — no route, screen or
 * ledger code moves.
 *
 * Deliberately narrow: the app never sees or stores card/UPI credentials. It
 * asks the provider to create an intent, hands the retailer off to whatever the
 * provider returns, and later trusts only a verified callback.
 */

export interface PaymentIntent {
  /** The provider's id for this attempt. Stored as Payment.providerRef. */
  providerRef: string;
  /** Where to send the retailer to authorise (UPI intent link, hosted page, …). */
  redirectUrl: string | null;
  /**
   * Opaque data the client SDK needs (order id, token, key). Never contains
   * secrets — it is safe to hand to the app.
   */
  clientPayload: Record<string, unknown>;
}

export type VerifiedEvent =
  | { providerRef: string; status: "succeeded" }
  | { providerRef: string; status: "failed"; reason: string }
  | { providerRef: string; status: "cancelled" };

export interface PaymentProvider {
  readonly name: string;

  createIntent(params: {
    amount: number;
    currency: "INR";
    retailerId: string;
    /** Our own reference, echoed back by the provider where supported. */
    reference: string;
  }): Promise<PaymentIntent>;

  /**
   * Validate a raw callback and translate it into an event we act on.
   * Implementations MUST verify the provider's signature and return null for
   * anything that fails — an unverified payload must never move money.
   */
  verifyCallback(rawBody: unknown, headers: Record<string, string | undefined>): VerifiedEvent | null;
}
