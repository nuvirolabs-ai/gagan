# Gagan Salesperson Baseline Release Manifest

This is the reproducibility record for the current review artifact. It is not
a production release record.

## Source and compatible runtime

- Source branch: `codex/gagan-salesperson-canonical-v1`
- APK source commit: `b5b92ed61459fd82fd25d8136411794fbf6de3b9`
- Canonical staging API: `https://gagan-srat.onrender.com`
- Compatible backend: existing accepted Gagan staging runtime; backend was not
  rebuilt or redeployed in this recovery task
- Frozen reference: `gagan-salesperson-template-v1` (unchanged)

## APK

- Path: `/Users/tanutejas/Desktop/gagan-salesperson-canonical-v1-b5b92ed-v2.apk`
- SHA-256: `876627642a1fff1b9b3b0ddf0d0f197e28e52bf810c4c9f13087b8fe95975ba7`
- Package: `com.gagan.sales.review`
- Label: `Gagan Sales Review`
- Version name: `1.0.6`
- Version code: `6`
- Signing certificate SHA-256: `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`
- Build profile: isolated local Android release build using the existing
  review signing identity
- Standalone: yes; embedded JavaScript bundle
- Runtime dependencies: no Metro, no local API, no USB connection, no Mac
- Embedded review identity: source `b5b92ed`, version `1.0.6`, channel
  `canonical-v1`, API hostname `gagan-srat.onrender.com`

## Reproduction record

The artifact was built from a fresh archive of the pinned source commit with
Node 22, `NODE_ENV=production`, `BABEL_ENV=production`, an Expo export with a
cleared Metro cache, Expo Android prebuild, and a clean Gradle release build.
The generated bundle was inspected before installation and contained the
current source/version/channel/API identity. The APK was installed on the
Moto E13 (`ZD2229Q3KB`) with an in-place update (`adb install -r`); the prior
app data and first-install time were preserved. Package metadata, signature,
and the in-app Review Build panel were then checked on-device.

## Evidence

- Evidence directory: `/Users/tanutejas/Desktop/gagan-salesperson-canonical-v1-evidence-b5b92ed`
- Exact current-artifact captures include Home, My day, Leave calendar/range,
  More, Market Surveys, survey detail, Kaveri retailer context, Expenses, the
  focused keyboard state, and Review Build identity.
- Valid same-source versionCode 6 cache/reconnect captures are retained in the
  same directory as `06-final-offline-cached-settled.png` and
  `07-final-reconnect.png`.
- The first post-fix build `/Users/tanutejas/Desktop/gagan-salesperson-canonical-v1-b5b92ed.apk`
  was rejected and archived because its native metadata and embedded bundle
  identity did not agree. It is not a rollback candidate.

## Acceptance boundary

The exact artifact proved source identity on-device and passed the available
non-mutating Home, My day, Leave-date, Survey-navigation/context, retailer
detail, and keyboard-field checks. A valid published route/active visit and a
second controlled account were not available. Therefore active-visit/check-in,
catalogue-to-order/Done flow, physical account switching, follow-up submission,
and exact-artifact offline re-capture remain blocked or not run; no state was
fabricated and no unrelated transaction was created.

## Protected boundaries

Production, `main`, Dogkart, the frozen template tag, backend/Admin/Retailer
source, commercial semantics, R2, survey data/audiences/answers, and unrelated
deployments were not changed.
