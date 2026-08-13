# Watchly web

This app serves the public legal surface and the private moderation console.

## Stable public routes

- `/privacy`
- `/terms`
- `/community-guidelines`
- `/support`
- `/account-deletion`

`/admin` is excluded from the sitemap and search indexing. The public pages are prerendered and remain independent from API availability.

## Local setup

Copy `.env.example` to `.env.local` and set the real development values. In particular:

- `NEXT_PUBLIC_SITE_URL` is the public origin without a trailing path.
- `NEXT_PUBLIC_API_URL` is the matching Watchly API origin.
- `NEXT_PUBLIC_WATCHLY_ENVIRONMENT` must match `APP_ENV` on the API.
- `NEXT_PUBLIC_SUPPORT_EMAIL` must be the verified publisher support address used in the store listings.
- The Firebase values must come from the matching environment project.

The API `CORS_ORIGIN` must equal the deployed web origin. Start the app with `pnpm --filter web dev`.

## Administrator access

1. Upgrade Firebase Authentication with Identity Platform and enable TOTP MFA.
2. Add the web domain to Firebase Authorized domains.
3. Sign in once with the intended verified Google account.
4. From a trusted server environment with Firebase Admin credentials, run `pnpm --filter api admin:access grant admin@example.com`.
5. Sign in at `/admin`. If the account has no second factor, the pre-approved account can enroll TOTP before any moderation data becomes available.
6. Sign in again and complete the TOTP challenge.

Revoke access with `pnpm --filter api admin:access revoke admin@example.com`. The command revokes active refresh tokens after every grant or revoke.

The API independently requires a valid Firebase token, the server-issued `admin: true` claim, a verified email, and `firebase.sign_in_second_factor` on every admin request. Client-side state never grants access.

## Deployment checklist

Use Node.js 20.9 or later. Build with `pnpm --filter web build` and run with `pnpm --filter web start`. The hosting platform must terminate HTTPS and redirect HTTP to HTTPS.

Before publishing store URLs:

- configure the final stable domain and support email;
- deploy the API migration that creates `admin_audit_logs`;
- verify all five public routes without authentication;
- verify `/admin` returns no report data for a regular account, an admin without MFA, and a revoked admin;
- process one test report through New, In progress, Resolved, and Rejected as appropriate;
- verify the immutable audit trail records list access, detail access, and every status action;
- have the legal copy reviewed for the publisher's jurisdiction and store disclosures.
