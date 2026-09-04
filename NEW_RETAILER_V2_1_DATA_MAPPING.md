# New retailer V2.1 data mapping

## Canonical boundary

The existing `RetailerProposal` remains the sole governance record. Approval still creates one canonical `Retailer`; V2.1 adds fields to that proposal rather than introducing a second customer model.

## Field mapping

| Form label | API / proposal field | Storage rule |
| --- | --- | --- |
| Party Name* | `businessName` | Normal text |
| Group Name* | `groupName` | Normal text |
| Contact Person* | `ownerName` | Normal text |
| Mobile No.* | `phone` | Normalized Indian national number |
| Telephone | `telephone` | Optional normal text |
| Transporter* | `transporter` | Normal text |
| Address - 1* | `shopAddress` | Normal text |
| PIN Code | `pinCode` | Optional text |
| Tehsil | `tehsil` | Optional text |
| District | `district` | Optional text |
| State | `state` | Optional text |
| Delivery City* | `deliveryCity` | Normal text |
| Salesman* | authenticated `submittedByStaffId` | Never client-selectable or reassigned by the request |
| Shop duration* | `shopDurationYears` | Non-negative integer |
| GSTIN No. | `gstin` | Optional text |
| Aadhaar Number* | `aadhaarEncrypted`, `aadhaarLast4` | AES-256-GCM ciphertext at rest; only `XXXX-XXXX-1234` is returned |
| Aadhaar Card Photo* | `EvidenceAsset` + `aadhaarPhotoAssetId` | Private object-storage key; authorised signed URL only |
| Payment Terms* | `paymentTerms` | Normal text |
| UPI ID | `upiId` | Optional text |

## Submission and review

The four-step form validates Business, Address & Delivery, Commercial, and Identity & Review before submit. The API repeats mandatory validation. The photo is stored first through the existing `ObjectStorage` abstraction, then the asset and proposal are committed together; a failed database transaction deletes the staged object. The admin review response is explicitly projected and strips `aadhaarEncrypted`.

## Import Center boundary

The existing Admin Retailers CSV/XLSX contract was audited before this change.
It imports directly into the canonical `Retailer` customer master and supports
the current master fields (`name`, `phone`, `shop_address`, `tier`, credit,
salesperson link, and SAP customer ID). The V2.1 fields above belong to the
governed `RetailerProposal` onboarding record, not to `Retailer`, so they are
not silently added to a bulk-import path that would bypass proposal review.
This preserves the existing import template, preview, apply, and history
semantics. Aadhaar values/photos remain explicitly app/Admin-only and are
never accepted by spreadsheet import. Future master-data normalization for
group, transporter, delivery geography, and payment terms can extend the
canonical `Retailer` contract deliberately rather than creating unmapped
spreadsheet columns.

## Security invariants

- Full Aadhaar never enters the database as plaintext, normal API output, AsyncStorage, analytics, or audit metadata.
- The salesperson draft contains only non-sensitive fields. Aadhaar and the image stay in memory until submission.
- The photo is not placed in a spreadsheet, public URL, or base64 database column.
- `PII_ENCRYPTION_KEY` is runtime configuration. Missing key fails identity submission closed rather than falling back to plaintext.
- Hosted staging needs a persistent private S3-compatible storage provider and a configured PII key; local storage is suitable only for local/test verification.
