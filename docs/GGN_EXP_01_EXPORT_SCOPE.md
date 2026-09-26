# GGN-EXP-01 export scope

The forensic inventory in `GAGAN_FORENSIC_COMPLETENESS_AUDIT.md` separates report datasets from utility downloads and action screens. This slice does not declare the full export inventory complete.

| Inventory class | Exact audit modules | Status in this slice |
|---|---|---|
| Required | Orders; retailers; ledger, payments and collections; sales performance/team; visits and routes; leave/attendance/expenses; targets; catalogue/inventory; service issues; survey responses | Service issues: local Excel export implemented and tested. All other required areas remain outside this slice and need their own permission, scope, filter, and data-contract review. |
| Already supported, limited | Import Center templates and row-error CSV; recovery-letter PDF; credit-review CSV reference | Retained as narrow utilities, not counted as general module exports. |
| Not meaningful | Login/session screens; action forms/modals; live dispatch controls; individual KYC document viewer | No export added. |

## Service issues contract

- `GET /admin/exports/service-issues.xlsx` requires an authenticated Admin identity with `issue.review` and uses the server-resolved reporting tree. `salespersonId` can only narrow to an in-tree staff member; an out-of-tree ID is rejected. As in the Admin issue queue, that filter means issues raised by the named staff member, not retailer-origin issues associated with that member's retailers. Retailer and status filters intersect the same scope.
- Reusing `issue.review` is intentional: this workbook contains the same reviewer-visible issue fields as the scoped Admin issue queue, with no evidence files or additional cross-module data. A separate export permission is not introduced for this bounded read surface; any future broader report must make its own authorization decision.
- `from` and `through` are optional ISO calendar dates in UTC. `from` starts at 00:00:00.000 UTC and `through` includes 23:59:59.999 UTC. An inverted or invalid range is rejected.
- The workbook contains at most 5,000 matching rows, with an explicit 413 response above that bound. User-controlled text is escaped for spreadsheet-active prefixes. The response is an attachment with `no-store` caching.
- Admin's status and applied retailer filters feed both the queue and workbook. The two date fields are explicitly export-only. The Admin client refreshes an expired session for the binary request and downloads the returned Blob.

## PDF decision

The audit calls for filtered Excel/CSV for structured operational data. A multi-row service-issue PDF would be less useful for sorting and analysis, and the existing recovery-letter PDF generator is a single-document helper, not a general report renderer. This slice therefore provides Excel only; it does not repurpose that helper or imply that every required module must offer PDF.

Local tests and builds establish source behavior only. Hosted Admin download, current business-data readback, and device acceptance remain unverified; no hosted database or deployment was changed.
