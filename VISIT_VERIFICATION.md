# Visit Verification

Sales visits are an activity record, not continuous employee tracking. A visit begins when a salesperson opens an assigned retailer and explicitly taps `Check in`; optional checkout is another explicit foreground reading.

## Statuses

- `VERIFIED`: accurate reading at or inside the configured verified radius.
- `NEEDS_REVIEW`: reading is outside the verified radius but inside the review radius, or the store record itself needs review.
- `OUTSIDE_STORE_AREA`: reading is beyond the review radius.
- `STORE_LOCATION_NOT_AVAILABLE`: there is no verified store coordinate to compare with.
- `LOW_GPS_ACCURACY`: the device accuracy exceeds the configured maximum.

These are neutral operational states. GPS can be wrong and no state accuses a salesperson of fraud. Admin should review unusual visits with the retailer and salesperson context.

## Integrity and privacy

The backend records accuracy, server timestamps, actor, source, and the coordinate snapshot. It does not continuously track devices, request background permission, fingerprint devices, or put coordinates into analytics events. Access is restricted to the retailer, assigned salesperson, authorized admin, and the logistics service token.

## Duration

If checkout is used, duration is only `checkedOutAt - checkedInAt`. It does not imply the salesperson stayed at the store because no background tracking is performed.

