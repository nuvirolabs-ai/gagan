# Recovery letters and legal escalation design

**Status:** Approved scope; implementation follows on `feature/recovery-commitments`.

## Outcome

At the 90-day invoice age threshold, the worker may automatically create and confirm the permanent `F` credit-rating proposal using the existing rating lifecycle. It must not create a legal referral, send a letter, settle, or write off debt automatically. An authorised admin explicitly starts a legal case from a recovery case when business evidence is ready.

## Architecture

Recovery letters are immutable, deterministic PDF evidence records linked to a recovery case. The PDF contains the retailer, invoice/outstanding amounts, three signatory placeholders, sent date, and a seven-day response deadline. The generated object is written through the existing private object-storage interface and exposed only through a short-lived signed URL. Delivery channels (`manual`, `whatsapp`, `sms`, `email`) are metadata about a human/provider action, never an approval state.

Legal cases are created by an admin action and start in `open`. The case stores the reason, referral date, owner, and linked letter/recovery case. Founder/Director users with `legal.decide` can record one explicit `settlement` or `write_off` decision with reason and amount. The decision is append-only audit evidence; this slice does not mutate the financial ledger automatically.

## Data flow

1. Recovery scheduler reaches Day 90 and the existing rating worker creates the `F` proposal; the normal rating confirmation path locks the profile.
2. Admin opens a recovery case, creates a letter with an idempotency key, and receives a signed private URL.
3. Admin records delivery metadata after sending the letter manually or through a future provider.
4. Admin creates a legal case explicitly when referral is warranted.
5. Founder/Director records a settlement or write-off decision; duplicate decisions and non-authorised attempts are rejected and audited.

## Boundaries and safety

- No automatic legal-case creation, outbound message, settlement, write-off, or ledger mutation.
- Letter generation is deterministic and idempotent; a repeated request returns the same record.
- Legal decisions require `legal.decide`, a non-empty reason, and a positive amount not greater than the current outstanding amount.
- All state-changing routes use stable idempotency keys where a retry can create a duplicate object.

## Verification

- PDF content tests assert amount, invoice number, three signatories, sent date, and seven-day deadline.
- Service tests assert private storage, letter idempotency, delivery metadata, explicit legal-case creation, permission denial, and terminal settlement/write-off decisions.
- Route tests assert stable validation errors and permission boundaries.
- Full backend, admin, rep, and mobile verification remains the merge gate.
