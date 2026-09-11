# C10 — Moto E13 Performance Measurements

**Run date:** 11 September 2026  
**Device:** Moto E13 (`ZD2229Q3KB`), 720 × 1600, Android 13  
**APK under final measurement:** `/Users/tanutejas/Desktop/gagan-salesperson-field-ops-v1-offline-fix-cc49fa9.apk`  
**APK SHA-256:** `40ebecf8d30d3e6ca9cd54846946909e7305053a606108a2f6b50bac9faa4b53`  
**Mobile source:** `cc49fa9f4ba35b6799fb0f984bb86025b9526801`  
**API:** `https://gagan-staging-api.onrender.com`  
**Method:** native UIAutomator polling. Timings are tap-to-visible acknowledgement/content unless noted otherwise. Approximate values are retained as observations and are not treated as comparable samples.

## Functional device proof

Valid location-gated visit transitions were completed through the installed
native app without spoofing or bypassing the GPS guard:

- Sharma dedicated UAT retailer: native check-in and check-out succeeded; the
  app displayed `Visit verified` and then `Checked out`.
- Patel dedicated UAT retailer: native location verification succeeded, then
  checkout succeeded on the final APK (`4,965 ms` tap-to-visible).
- Kaveri dedicated UAT retailer: native check-in succeeded on the final APK
  (`5,634 ms`) and checkout succeeded on the final APK (`4,906 ms`).

This is sufficient to close the functional physical check-in/check-out
blocker. It is not three comparable timing samples for each C10 surface.

## Results

| Required surface | Samples | Median | Worst | Result |
|---|---:|---:|---:|---|
| Check-in | 5,634 ms clean timed sample; additional valid native transitions observed without timing | N/A | 5,634 ms among timed samples | PARTIAL timing set; functional proof PASS |
| Check-out | 4,965; 4,906 ms on final APK | 4,936 ms | 4,965 ms | PARTIAL — only two clean comparable final-APK samples |
| Retailer Detail | 4,104; 431; 3,869 ms | 3,869 ms | 4,104 ms | PASS — three samples |
| Catalogue load | 2,887; approximately 5,361; approximately 5,361 ms | approximately 5,361 ms | approximately 5,361 ms | PARTIAL — later samples include navigation/state polling overhead |
| Order submission | 5,272; 5,285 ms; third acknowledgement not observed | 5,278 ms for the two observed successes | 5,285 ms for the two observed successes | PARTIAL — three valid timed acknowledgements not available |

## Interpretation

The physical location blocker is now functionally closed: the final APK
captured a real, accepted GPS reading and completed native visit check-in and
check-out transitions. The performance acceptance gate remains open because
the required comparable three-sample timing sets were not captured for every
required surface. This document intentionally does not convert functional
success into a C10 timing PASS.

The Retailer Detail set is the only required timing set with three clean,
comparable samples. The catalogue set has one clean focused navigation sample;
the later two captures used a fixed wait and included screen-state/navigation
overhead, so they remain approximate upper-bound observations. Two native order
submissions were timed successfully; a third attempt stayed on the catalogue
screen and did not show the native acknowledgement.

## Evidence

All files are under `/Users/tanutejas/Documents/Gagan-field-ops-evidence-v1/`:

- Functional location/check-in/check-out evidence: `213-location-verify-attempt-2.png`,
  `214-visit-checkin-success.png`, `215-visit-checkout-success.png`,
  `217-patel-location-verification.png`, `218-c10-checkout-patel-sample1.png`,
  `219-c10-checkin-kaveri-sample2.png`, `220-c10-checkout-kaveri-sample2.png`
- `212-c10-retailer-detail-final.png`
- `229-c10-catalogue-one.png`, `234-catalog-after-tap.png`, `235-c10-catalogue-final.png`, `237-catalogue-sample2.png`, `238-catalogue-sample3.png`
- `240-order-review-c10.png`, `242-order-submit-c10-sample3.png`, `243-order-submit-c10-sample4.png`, `244-order-submit-c10-sample5.png`

`244-order-submit-c10-sample5.png` is explicitly not a success capture: it
shows the catalogue screen without an `Order placed` acknowledgement.

## C10 decision

**C10: PARTIAL / NOT CLOSED.** Functional physical check-in/check-out proof is
now present on the final APK, but the complete three-comparable-sample
performance requirement remains an evidence gap.
