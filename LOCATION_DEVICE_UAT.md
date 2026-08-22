# Location Device UAT

Automated tests cover API validation, permission result handling, server-side distance calculation, authorization, versioning, and neutral statuses. Real-device UAT is still required because simulator GPS and OS permission prompts are not production evidence.

Run each scenario on a current Android phone and iPhone using a staging API and test retailer.

## Android

- Allow while using the app; capture at the storefront; confirm the reading; verify the saved accuracy.
- Deny permission once; confirm the explanation, retry path, and Settings action.
- Select approximate location / reduce precision; confirm a low-accuracy reading is not marked verified.
- Disable device location services; confirm a clear retry message.
- Test indoors and near a storefront; confirm no fabricated precision.
- Background the app and return; confirm no location is captured until the user taps the action again.
- Disable network after GPS capture; confirm the app says submission failed and does not claim a verified visit.

## iPhone

Repeat the same scenarios with `While Using the App`, Precise Location on/off, Location Services off, indoor GPS, background/foreground return, and no network. Confirm the app never requests `Always` permission.

Record device model, OS, app build, API environment, timestamp, observed status, and screenshots for each case.

