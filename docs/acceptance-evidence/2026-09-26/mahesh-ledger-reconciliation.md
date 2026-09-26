# Mahesh Store staging ledger reconciliation

Read-only PostgreSQL check on 2026-09-26, `gagan-staging-db` (`dpg-dajvi2h5efls73ags3f0-a`), retailer `7e026d12-735e-422c-b191-e7ea0bea46a0`. No financial row was changed.

| Source | Debit / invoices | Settled payments | Remaining |
|---|---:|---:|---:|
| Legacy `LedgerEntry` | 9 invoice entries, INR 78,867 | 4 payment entries, INR 16,455 | INR 62,412 |
| Canonical `Invoice` / `PaymentAllocation` | 6 bridged invoices, INR 16,455 | 4 succeeded payments allocated INR 16,455 | INR 0 |
| Cached `Retailer` | - | - | `currentBalance` and `overdueAmount`: INR 62,412 |

Exact disagreement: **INR 78,867 - INR 16,455 = INR 62,412**, while **INR 16,455 - INR 16,455 = INR 0** in the canonical invoice ledger. The difference is exactly the three legacy invoice entries with no linked `Invoice` or `Order`:

| Legacy entry ID | Amount | Due date (UTC) |
|---|---:|---|
| `b3817a6c-75ea-4859-b706-ba9ffcd994a7` | INR 18,500 | 2026-06-18 |
| `05a9c3ae-2be9-4713-b949-df28a1444bd3` | INR 22,000 | 2026-08-22 |
| `26df9cb0-2e7f-4273-a57b-252ec925515f` | INR 21,912 | 2026-09-16 |

These amounts and their relative dates match the `openingInvoices` demo fixture in `backend/prisma/seed.ts`. That is strong provenance evidence, **not** proof that the hosted amounts are or are not collectible. None of the three has an order, canonical invoice, or Jain/Padam attribution. The other six legacy invoice entries are linked to paid canonical invoices. Four succeeded payments total INR 16,455 and have matching allocations; a separate INR 40,500 payment is pending, unallocated, and excluded from settlement. There are no `CollectionSubmission` rows for this retailer.

Open reconciliation issue `ef820fbb-d8eb-449b-b452-96579ee98387` records `cachedBalance=62412` and `calculatedBalance=0`. The current financial read model uses canonical invoice ageing when invoices exist, detects this mismatch, and exposes the account as under review; payment and collection guards prevent treating either zero or INR 62,412 as a reliable payable amount.

**Owner decision required:** confirm whether the three opening receivables represent real collectible debt. If yes, supply source invoices or approved opening-balance evidence and the Jain/Padam allocation before any bridge or collection. If no, authorize a separately reviewed, audited staging-only normalization of the legacy and cached balance. Do not create a balancing payment, silently delete history, or infer an entity split.
