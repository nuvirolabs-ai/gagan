# Gagan Salesperson — Physical Interaction Matrix

## Test setup

- APK under test: isolated touch-geometry-fix release installed from `rep/android/app/build/outputs/apk/release/app-release.apk`.
- Device: Moto E13, `ZD2229Q3KB`, 720×1600 display, approximately 720×1510 app window.
- Method: Android `adb shell input tap` at the center of the visible/native UIAutomator bounds, followed by a UIAutomator dump or visible navigation/state confirmation.
- Result definition: `PASS` means the center tap activated the visible control without an apparent offset. No backend-mutating action such as submitting an order or retailer was used.

The device session is the canonical Nikhil/day-complete staging state. Active-day-only controls such as Next Visit and Start Visit were not available and are recorded as unavailable rather than simulated.

## Center-tap matrix

| # | Surface | Visible control | Center used | Expected result | Result |
|---:|---|---|---|---|---|
| 1 | Home | Home tab | (90,1496) | Home remains selected | PASS |
| 2 | Home | Outlets tab | (270,1496) | Navigate to Retailers | PASS |
| 3 | Home | Reports tab | (450,1496) | Navigate to My activity | PASS |
| 4 | Home | More tab | (630,1496) | Navigate to More | PASS |
| 5 | Home | Attendance quick action | (124,1111) | Open My day / attendance action | PASS |
| 6 | Home | Order quick action | (281,1111) | Open order flow | PASS |
| 7 | Home | Sales Kit quick action | (439,1111) | Open Sales Kit | PASS |
| 8 | Home | More quick action | (596,1111) | Open More | PASS |
| 9 | Home | Sharma route row | (360,422) | Open retailer context | PASS |
| 10 | Home | Kaveri route row | (360,565) | Open retailer context | PASS |
| 11 | Home | Patel route row | (360,709) | Open retailer context | PASS |
| 12 | Home | Sahyadri route row | (360,852) | Open retailer context | PASS |
| 13 | Home | Full plan | visible header center | Open full route | PASS |
| 14 | Home | Needs attention row | visible row center | Open attention retailer | PASS |
| 15 | Home | See all | visible link center | Open attention list | PASS |
| 16 | Home | Day-complete surface | visible surface center | Open activity/status context | PASS |
| 17 | Home | Notification affordance | visible bell center | Open notification affordance | PASS |
| 18 | Home | Home tab after scroll | (90,1496) | Return to Home without offset | PASS |
| 19 | Reports | Timeline segment | visible segment center | Timeline selected | PASS |
| 20 | Reports | Performance segment | visible segment center | Performance selected | PASS |
| 21 | Reports | 7D period | visible control center | 7D selected | PASS |
| 22 | Reports | 30D period | visible control center | 30D selected | PASS |
| 23 | Reports | Sales metric | visible control center | Sales chart selected | PASS |
| 24 | Reports | Orders metric | visible control center | Orders chart selected | PASS |
| 25 | Reports | Visits metric | visible control center | Visits chart selected | PASS |
| 26 | Reports | Collections metric | visible control center | Collections chart selected | PASS |
| 27 | Reports | Daily detail | visible control center | Open daily ledger | PASS |
| 28 | Reports | Daily ledger Done | visible button center | Close ledger | PASS |
| 29 | Reports | Reports tab | (450,1496) | Keep Reports selected | PASS |
| 30 | Reports | Home tab | (90,1496) | Navigate Home | PASS |
| 31 | Reports | Outlets tab | (270,1496) | Navigate Retailers | PASS |
| 32 | Reports | More tab | (630,1496) | Navigate More | PASS |
| 33 | Outlets | Search field | visible field center | Focus search input | PASS |
| 34 | Outlets | Route today filter | visible filter center | Filter selected | PASS |
| 35 | Outlets | Overdue filter | visible filter center | Filter selected | PASS |
| 36 | Outlets | Opportunities filter | visible filter center | Filter selected | PASS |
| 37 | Outlets | All/clear filter | visible filter center | Filter reset | PASS |
| 38 | Outlets | Sharma retailer row | visible row center | Open retailer detail | PASS |
| 39 | Outlets | Kaveri retailer row | visible row center | Open retailer detail | PASS |
| 40 | Outlets | Patel retailer row | visible row center | Open retailer detail | PASS |
| 41 | Outlets | Back from retailer | (55,100) | Return to Outlets | PASS |
| 42 | Outlets | Retailer Detail Place order | visible CTA center | Open New order | PASS |
| 43 | Outlets | New order back | (55,100) | Return to retailer | PASS |
| 44 | More | My day row | (360,582) | Open attendance/day screen | PASS |
| 45 | More | Route row | (360,712) | Open planned route | PASS |
| 46 | More | Needs attention row | (360,842) | Open attention list | PASS |
| 47 | More | Sales Kit row | (360,972) | Open Sales Kit | PASS |
| 48 | More | My performance row | (360,1268) | Open performance | PASS |
| 49 | More | Add a store row | (360,1398) | Open New Retailer | PASS |
| 50 | More | Home tab | (90,1496) | Navigate Home | PASS |
| 51 | More | Outlets tab | (270,1496) | Navigate Retailers | PASS |
| 52 | More | Reports tab | (450,1496) | Navigate My activity | PASS |
| 53 | More | More tab | (630,1496) | Keep More selected | PASS |
| 54 | New Retailer | Add store segment | visible segment center | Add store selected | PASS |
| 55 | New Retailer | My requests segment | visible segment center | My requests selected | PASS |
| 56 | New Retailer | Business step | (116,610) | Business step selected | PASS |
| 57 | New Retailer | Address & Delivery step | (279,610) | Step control responds | PASS |
| 58 | New Retailer | Commercial step | (441,610) | Step control responds | PASS |
| 59 | New Retailer | Identity & Review step | (604,610) | Step control responds | PASS |
| 60 | New Retailer | Party Name input | (360,964) | Focus EditText / keyboard | PASS |
| 61 | New Retailer | Group Name input | (360,1126) | Focus EditText / keyboard | PASS |
| 62 | New Retailer | Contact Person input | (360,1290) | Focus EditText / keyboard | PASS |
| 63 | New Retailer | Mobile No. input | (360,1453) | Focus EditText / keyboard | PASS |
| 64 | New Retailer | Continue | visible CTA center | Advance or validate current step | PASS |
| 65 | New Retailer | Android back with keyboard | hardware back | Dismiss keyboard without losing form | PASS |

## Summary

- Visible controls in matrix: 65.
- Center-tap passes: 65.
- Center-tap failures: 0.
- Controls unavailable in the canonical day-complete fixture: active-day Next Visit and Start Visit; excluded from the denominator and not fabricated.
- The bottom navigation was tested from each tab and after scroll/navigation returns. The corrected UIAutomator bounds show four equal native cells and centered visual children.

## Evidence

Screenshots are stored in `/Users/tanutejas/Desktop/gagan-salesperson-touch-geometry-evidence/`. The matrix is paired with the UIAutomator bound evidence in `SALESPERSON_TOUCH_GEOMETRY_AUDIT.md`. A release screen recording was not required to diagnose this tap-geometry defect; screenshot and native-bound evidence were collected from the installed physical APK.
