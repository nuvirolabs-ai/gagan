# Mobile and client security audit

## Checks performed

- Mobile and salesperson API clients require `EXPO_PUBLIC_API_URL` outside development and reject non-HTTPS URLs.
- Access and refresh tokens are kept in platform secure storage; retailer data is reloaded from `/me` on relaunch.
- Order requests carry a client-generated idempotency key and the backend requires it.
- Retailer/salesperson authorization is enforced server-side; client navigation is not treated as a permission boundary.
- No SAP credentials or service-layer calls exist in either mobile bundle.
- Backend responses use request IDs and safe integration errors; raw SAP exceptions are logged only as error type plus request ID.
- Admin uses email/password plus server-side RBAC and a rate-limited login endpoint.

## Dependency audit (21 Aug 2026)

| Package | Result |
|---|---|
| backend | 0 vulnerabilities |
| admin | 0 vulnerabilities |
| mobile | 15 advisories: 8 high, 7 moderate; transitive Expo/Metro/image-size/uuid chain |
| salesperson | 15 advisories: 8 high, 7 moderate; same Expo/Metro/image-size/uuid chain |

The available automated fix is an Expo major-version change. It must be handled as a dedicated upgrade with new Android/iOS builds and device regression, not applied blindly during this slice.

## Release checks still required

- Confirm release builds contain no `.env` secrets and only the public HTTPS API URL.
- Verify token redaction in crash reports and device logs.
- Verify screenshots, clipboard, keyboard and background-task behavior on managed devices.
- Run `npm audit` again immediately before pilot and after every Expo upgrade.
