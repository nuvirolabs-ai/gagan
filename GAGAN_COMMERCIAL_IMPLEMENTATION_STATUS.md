# Gagan commercial implementation checkpoint

This is a partial source checkpoint, not checkout or financial acceptance.
Worktree: `Gagan-product-improvements-v1`; branch:
`codex/gagan-product-improvements-v1`, based on Field Ops commit `282864a`.
Original worktrees, hosted services and original installed applications are unchanged.
Separate local Review apps were installed for device acceptance.

## Confirmed owner requirements

- Each SKU is sold by Jain Traders or Padam International.
- A cart may contain both entities.
- Owner confirmed on 2026-09-14: ONE combined invoice, retaining company detail
  by line. Do not split it into two invoices or infer cross-company settlement.
- Quoted quintal product rates exclude GST.
- GST is configurable per SKU.
- Manager enters the final freight amount; quintals and kilometres are supporting records, not multipliers.
- Owner subsequently confirmed freight GST is added separately to that amount; Admin needs a separate explicit freight tax-rate setting.
- Both mobile checkout surfaces must eventually consume the same authorized backend quote.

## Evidence and implementation boundary

| Requirement | Before | Action | Current evidence/status |
|---|---|---|---|
| Decimal commercial arithmetic | Invoice conversion used JavaScript floating point; half-paise could round down incorrectly | Decimal arithmetic through line rounding and total accumulation | Focused invoicing regression tests; not new device acceptance |
| Quintal pricing | Existing PriceList and order unitPrice are per case | Added pure quote calculation with explicit rate basis and case-weight input | Unit-tested foundation only; existing price records not relabelled |
| Per-SKU GST | Existing invoice path sets taxTotal to zero | Explicit per-line tax input in pure calculator | Unit-tested; no Admin editor or persistence integration yet |
| Mixed-company cart | Current Order has one invoice and no company mapping | Calculator separates explicitly attributed entity totals | Unit-tested; schema/payment/SAP integration outstanding |
| Manager freight | No freight field in inspected order schema | Calculator adds final charge once and retains supporting measures | Unit-tested; manager control and mobile checkout not implemented yet |
| Missing freight tax configuration | Additional GST confirmed; actual rates not supplied | Calculator rejects absent tax input rather than silently applying zero | Unit-tested; Admin rate configuration and authoritative quote integration pending |
| Historic conversion | Existing OrderItem caseWeightKgSnapshot | Preserved snapshot behavior in rounding correction | Focused invoicing tests |
| Retailer credit-limit visibility | Home, ledger and cart exposed limits/headroom | Removed displayed credit-limit figures while preserving blocking checks | Mobile tests/typecheck pass; local Home/cart physical proof |
| Quantity touch targets | Approved changes existed in canonical dirty files | Carried forward and enlarged actual controls without modifying originals | Both Review apps exercised on Moto E13; no hosted release claim |

## Remaining decisions and integration constraints

The pure calculator is not invoked by order creation, checkout, invoice posting,
payments or SAP. Its money fields are testable calculation inputs, not trusted
client inputs or new public contracts.

Freight GST is explicitly additional to the manager-entered base amount, as
confirmed by the owner. The actual rate must be configured separately; it is not
inherited from any SKU. An explicit zero rate in tests is synthetic test data,
not a business decision or a default for live records.

A mixed-entity freight charge must have an authorized allocation/owner before
payment and invoice attribution can be activated. The calculator requires an
explicit entity; it does not pick the first company or split a charge automatically.
The existing one-invoice-per-order model is retained by the owner's latest
decision. Company-attributed invoice lines, outstanding and payment allocations
still need a coherent persisted implementation. No commercial migration has
been applied and no existing financial history was relabelled.

Next implementation checkpoint: connect persisted SKU configuration,
manager freight authorization, quote snapshots and both checkout readers as one
tested slice. Do not claim the freight feature is delivered from calculator tests.
