# SFA Pass: Pre-existing Work Boundary

This note records the working-tree state before the SFA capability-depth pass. The SFA work must be additive and must not rewrite or absorb unrelated local work.

## Files already dirty

| Path | Classification | Evidence / apparent purpose | SFA treatment |
| --- | --- | --- | --- |
| `admin/.gitignore` | Admin work | Adds Vercel and environment-file ignores for the existing admin deployment | Untouched |
| `rep/src/context/RepContext.tsx` | Accepted Salesperson work | Adds recoverable OTP challenge retry and returns the challenge id from `requestOtp` | Untouched |
| `rep/src/screens/RepLoginScreen.tsx` | Accepted Salesperson work | Adds OTP-specific error copy and resend affordance | Untouched |
| `rep/src/auth/otpErrors.ts` | Accepted Salesperson work | New OTP error classification helper | Untouched |
| `rep/src/auth/__tests__/otpErrors.test.ts` | Accepted Salesperson work | Tests the OTP error classification helper | Untouched |
| `Gagan/` | Unknown / separate prototype tree | Untracked directory; not part of the canonical Git paths inspected for this pass | Must remain untouched and uncommitted |
| `founder/android/` | Founder work | Untracked native Founder Android project | Must remain untouched and uncommitted |
| `founder/ios/` | Founder work | Untracked native Founder iOS project | Must remain untouched and uncommitted |
| `tmp/` | SFA reference scratch output | Local PDF extraction/render scratch created while reviewing the supplied reference | Not part of the product; clean up only the exact SFA scratch directory before commit |

## Allowed SFA changes

The pass may add SFA audit/design documentation at the repository root and may add implementation/test files under `rep/` and `backend/` for the five approved additions only. Existing files may be edited only where they are the canonical route, screen, API client, or schema surface for one of those additions. The existing OTP files above are not part of that surface and must not be reformatted or merged into the SFA changes.

## Explicitly protected

- Existing retailer app and retailer checkout behavior.
- Existing admin and secondary admin applications.
- Founder app and its native projects.
- Real SAP B1 integration and production configuration.
- Existing canonical business models. A new model is permitted only for the minimal Sales Kit collateral contract if no reusable content model exists.

The final SFA commit must be reviewed with a path-limited diff so that the protected work does not enter the commit.
