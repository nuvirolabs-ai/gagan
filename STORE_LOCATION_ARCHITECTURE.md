# Store Location Architecture

Gagan captures store coordinates only after a deliberate foreground action. The retailer app can capture and request a change; the salesperson app can capture/verify an assigned retailer and check in/out. Neither app requests background or “always allow” location access, and neither app decides whether a visit is verified.

## Source of truth

- `RetailerLocation` is the current location record.
- `RetailerLocationHistory` is append-only and records every capture, verification state, change request, and admin correction.
- Existing retailers are represented as `NOT_SET` with no invented coordinates. A migration row uses `MIGRATION` only as provenance.
- `locationVersion` increases for coordinate captures/corrections. A request to change a verified location keeps the current coordinates and marks the record `NEEDS_REVIEW`.
- `SalesVisit` stores the exact store-coordinate snapshot used at check-in so later location edits cannot rewrite history.

## Data flow

`Device foreground permission → high-accuracy reading → user confirmation → authenticated API → coordinate/accuracy validation → PostgreSQL transaction + audit event`.

Visit verification is server-side. The backend uses Haversine distance and `VISIT_VERIFIED_RADIUS_METERS` / `VISIT_REVIEW_RADIUS_METERS`; the mobile-calculated distance is never trusted.

## API boundary

- Retailer: `/location`, `/location/capture`, `/location/verify`, `/location/change-request`.
- Salesperson: `/rep/retailers/:retailerId/location*`, `/rep/retailers/:retailerId/check-in`, `/rep/visits/:visitId/check-out`, `/rep/visits`.
- Admin: `/admin/locations*`, `/admin/visits`.
- Logistics: `/internal/logistics/retailers/:retailerId/location`, protected by `x-gagan-service-token` and `LOGISTICS_SERVICE_TOKEN`, returns only `VERIFIED` coordinates.

Offline captures are not silently marked verified. If the API cannot be reached, the UI tells the user to retry; no local queue claims a server timestamp.

## Configuration

`STORE_LOCATION_MAX_ACCURACY_METERS` defaults to 50m, `VISIT_VERIFIED_RADIUS_METERS` to 150m, and `VISIT_REVIEW_RADIUS_METERS` to 500m. Values are parsed at startup and the verified radius cannot exceed the review radius. These are operational defaults, not a claim of GPS certainty.

