# App Review demo access

The demo account uses the normal Watchly API, permissions and Firebase sessions. It has no admin privileges. OAuth buttons and the normal navigation remain unchanged. Review access is explicitly documented to Apple, not concealed functionality.

## Reviewer flow

1. Install the new TestFlight build on an iPhone.
2. Open `https://trywatchly.com/review-access` in Safari on that iPhone.
3. Tap **Open Watchly**. The page opens `com.trywatchly.app://review-access` without credentials in the URL.
4. Enter the demo username and password inside Watchly, then tap **Continue to Watchly**.

The web page has `noindex, nofollow` metadata and is absent from navigation and the sitemap. Knowing its address does not authenticate anyone. The native route exists in the distributed app; this is not an Apple-only binary or a secret security boundary.

## Provision and deploy

1. Apply the `20260907090000_add_demo_auth_provider` migration to the target database before running the provisioning script or deploying the new API.
2. In an environment with the matching `DATABASE_URL`, `FIREBASE_PROJECT_ID` and Firebase Admin credentials, run `pnpm --filter api demo:prepare <firebase-project-id> <new-credentials-file>`.
   - Pass the exact Firebase project ID as an explicit environment check. Confirm that the database URL belongs to the same environment.
   - Put the output file outside the repository in a private location. It contains a password, is created exclusively without overwriting files, and must never be committed or published.
   - The script reserves Firebase UID `watchly-review`, marks it as a demo account and creates a private Watchly profile with two watched films, ratings and a watchlist. Existing demo data is preserved.
   - Running it again rotates the password material and revokes existing Firebase sessions. Use a new output filename and update the API configuration and App Store Connect credentials together.
3. Set only `DEMO_AUTH_USERNAME` and `DEMO_AUTH_PASSWORD_HASH` from the file on the API. `REVIEW_PASSWORD` is for the reviewer; never place it in API, mobile or web public configuration.
4. Deploy the API and web page, build the production iOS app and install that exact TestFlight binary.
5. Complete the device checks below before providing Apple the URL, username and password in TestFlight review information.

Access fails closed when either API variable is absent. Passwords use salted scrypt. The route limits attempts to five per minute per tracker through the existing API throttler, returns `Cache-Control: no-store`, and can mint tokens only for the fixed demo UID. The API verifies signed Firebase ID tokens and checks the demo marker, UID, configured access and normal suspension rules. Production Firebase revocation checks remain enabled.

## Account lifecycle

- Sign-out uses the normal cache, push-registration and Firebase cleanup.
- Account deletion is real: it deletes Watchly data and the Firebase account. The login endpoint does not recreate a deleted Firebase account. Run the provisioning command explicitly again to prepare a fresh account and new password, then update API and review credentials.
- Do not link personal OAuth accounts to this shared review account. Use dedicated provider accounts if testing linking. Review data is shared by everyone with the credentials.
- To disable access, remove either demo API setting and restart the API; the verifier also denies existing demo sessions, including OAuth sessions on the reserved UID. Revoke the demo user's Firebase refresh tokens for session invalidation before later re-enabling access.

## Required verification

Implementation checks on 2026-09-07: `pnpm check` passed, including the real local HTTP route tests with mocked Firebase issuance. The local web page was inspected in Chrome and its button targets the production app scheme. No production account has been provisioned by this implementation, and Firebase/device end-to-end checks below remain pending.

- Automated: invalid/malformed credentials, disabled/missing/unmarked/admin/suspended accounts, fixed-UID issuance, configuration disabled, forged or revoked demo identity, real HTTP route status and throttling, normal OAuth regression checks and navigation configuration.
- On the exact iPhone build: open the link with the app stopped and running; verify wrong password and retry; sign in and continue; restart the app to check session restoration; sign out and sign back in; verify watched films, ratings and list actions; test deletion and explicit reprovisioning.
- Confirm that neither ordinary app navigation nor site navigation displays a demo access entry.

## App Store Connect instructions

Use this text only after the deployed flow and credentials have been verified:

> Watchly uses OAuth for regular user accounts. We have provided a dedicated demo account for review. Install this TestFlight build, then open https://trywatchly.com/review-access in Safari on the same iPhone and tap "Open Watchly". Enter the username and password supplied in the review credentials fields inside the app, then tap "Continue to Watchly". This signs into a prepared account using the same application screens and functionality as regular users. The demo profile contains sample watched movies, ratings and a watchlist. Please use dedicated test identities if testing OAuth account linking. Account deletion permanently deletes this demo account too; contact us if a fresh account is needed after that test. Regular OAuth account creation remains available from the normal sign-in screen.

Then reply to the existing App Review message with the navigation instructions. Do not send credentials until activation and device verification are complete.
