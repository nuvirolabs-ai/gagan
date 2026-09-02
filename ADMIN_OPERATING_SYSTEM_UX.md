# Admin operating system UX

Employees should **do work**, not admire metrics.

## Home

`/` is **Work**: live counts from existing APIs (orders by pipeline, credit holds, collections, proposals, expenses, issues, leave, SAP failures). Empty queues are called out as healthy.

## Information architecture

| Group | Surfaces |
|---|---|
| Home | Work |
| Work | Approvals, Collections, Credit reviews |
| Sales | Orders, Retailers, New retailers, Organisation, Sales leader, Catalog |
| Finance | Ledger, Corrections, Recovery, Legal, KYC |
| Field | Team & leave, Routes & tasks, Expenses, Issues, Locations, Visits |
| System | Users & roles, SAP sync |

Links exist only for capabilities that exist. Warehouses is not a master-data module; `/warehouses` redirects to SAP sync.

## Order workspace

The Order queue remains the fulfilment desk: approve → pack → assign → POD. SAP identity is on the order record and in System → SAP sync, not as the first thing a warehouse user sees.

## Department defaults

Landing is the first permitted nav item. A field manager without `staff.manage` still gets Work (partial queues) plus Field pages. Platform admin sees the full OS.

## Inspector

Split panes already exist for Approvals, Collections, Recovery, KYC. Do not force a global inspector in this pass.

## Remaining honesty

- Expense approve does not post to ledger (documented).
- Dispatch uses a typed route id, not a WMS.
- Procurement is not in V1.
