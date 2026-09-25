export interface CommercialQuoteState {
  acceptedAt?: string | null;
  expiresAt: string;
  freightConfirmedByStaffId?: string | null;
  revision: number;
  snapshot?: { total: string | number; freight?: unknown };
}

export type QuoteRefreshKind = "updated" | "accepted" | "expired";

export function classifyQuoteRefresh(
  quote: CommercialQuoteState,
  now = Date.now()
): { kind: QuoteRefreshKind; quote: CommercialQuoteState } {
  if (quote.acceptedAt) return { kind: "accepted", quote };
  if (new Date(quote.expiresAt).getTime() <= now) return { kind: "expired", quote };
  return { kind: "updated", quote };
}

export function canSubmitQuote(input: {
  lineCount: number;
  quoteReady: boolean;
  placing: boolean;
  quote: CommercialQuoteState | null;
}) {
  return (
    input.lineCount > 0 &&
    input.quoteReady &&
    !input.placing &&
    (!input.quote || (!!input.quote.freightConfirmedByStaffId && !input.quote.acceptedAt))
  );
}
