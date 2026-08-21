# Location Feature Test Report

## Automated verification

- Backend location/domain/route tests: run with the backend Vitest command.
- Mobile and salesperson permission adapters: run with each app Vitest command.
- Admin location/visit pages: run with the admin Vitest command.
- Full backend regression: run against a disposable PostgreSQL database with mock SAP/OTP/payment providers.

## Current status

The implementation is ready for staging review after the commands above pass. Real-device permission, GPS quality, GPS-disabled, and no-network scenarios remain UAT requirements; they cannot be proven by unit tests or a simulator.

