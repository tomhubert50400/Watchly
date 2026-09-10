# ReleaseEvent canonical release source

## Scope

`ReleaseEvent` is the API source of truth for release dates used by internal alerts, the personal release calendar, and release push delivery.

The current flow is:

`TMDB -> release_events -> internal notifications / personal release calendar / release push`

P0.2 includes the authenticated personal calendar and opt-in system push for active release alerts. Push delivery reads the canonical internal notification projection instead of calling TMDB independently.

## Canonical identity

Each event has a stable `sourceKey` that does not contain its date:

- `tmdb:movie:<tmdbId>:release`
- `tmdb:series:<tmdbId>:season:<seasonNumber>`
- `tmdb:series:<tmdbId>:season:<seasonNumber>:episode:<episodeNumber>`

An upsert by `sourceKey` makes repeated synchronization idempotent. If TMDB changes a date, the existing row is updated. If a previously returned season or episode disappears from a successfully fetched scope, its status becomes `WITHDRAWN` instead of creating or deleting another canonical identity.

## Date policy

The catalogue endpoints currently expose TMDB `release_date` and `air_date` values as calendar dates without an hour, time zone, or territory.

- Valid `YYYY-MM-DD` values use precision `DATE` and are stored as PostgreSQL `DATE`.
- Missing or invalid values remain active with a null date and precision `UNKNOWN`.
- `timeZone` and `regionCode` remain null. The synchronization must not invent either value.
- A later regional source may fill those fields, but consumers must continue to respect the stored precision.

## Synchronization policy

Staging and production run a synchronization at API startup and every six hours. Development does not start the background loop. The job processes the distinct movie and series identities found in active release alert subscriptions.

After refreshing the canonical events, the same scheduled job projects valid milestones to every subscribed user. Subscribers to the same content share one canonical read, and database uniqueness keeps concurrent projections idempotent.

Movie synchronization creates one canonical event. Series synchronization creates all standard season events and fetches episode dates for at most three relevant seasons: the latest season plus future or undated seasons. Specials, represented by season zero, are excluded from this first policy.

User-triggered notification synchronization reuses canonical rows that were refreshed less than one hour ago. A stale or missing content record is refreshed from TMDB before notifications are projected.

The current Railway contract runs one API instance. The database upserts are safe if two runs overlap, but the in-process timer is not a distributed scheduler. Before adding API replicas, move the timer to one worker or add a database-backed lease to prevent duplicate TMDB traffic.

## Internal notification projection

Release reminders are created only on the UTC calendar day seven days before a dated, active movie or episode release. There is no announcement backfill, release-day alert, or separate season alert. Enabling a bell only saves the subscription. Undated events stay in the calendar without creating reminders.

Episodes of the same series released on the same date share one reminder. Movie dedupe keys remain stable per movie (movie:603:one-week); series keys identify a release date (series:1399:date:2026-09-17:one-week). Repeated synchronization cannot create another reminder for the same key. Legacy unread future announcements and season/release-day alerts are removed during synchronization; J-7 reminders remain in the inbox after the reminder day.

Film subscriptions still target individual films. Automatic following of other films in a collection is not implemented by this policy.

## Personal release calendar

`GET /notifications/release-calendar` returns active canonical events for the signed-in user's release alert subscriptions. It includes future events and undated events, but never past or withdrawn rows.

The endpoint refreshes the same canonical pipeline used by internal alerts before reading the calendar. User-triggered refresh work remains bounded to the 48 most recently updated subscriptions, while the calendar query itself includes every active subscription and the scheduled job continues to refresh all tracked content.

The mobile screen is available from Alerts. It provides a monthly view, daily agenda selection, All/Movies/Series filters, a separate Date pending section, and links back to the related title where the alert can be managed. Unknown dates remain undated and are never placed on an invented calendar day.

## System push

System push is private and disabled by default. The mobile app asks for native permission contextually when a signed-in user activates a first release alert, or explicitly from Settings. A separate Followed releases preference controls this category without affecting in-app alerts.

Each Expo push token is scoped to the authenticated user and `APP_ENV`. Signing out, disabling system notifications, an operating-system permission revocation, or an Expo `DeviceNotRegistered` receipt deactivates the registration. A token reassigned to another user cannot receive queued notifications owned by the previous account.

Foreground notification handling suppresses banners, notification-list entries, sounds, and badges on the receiving device. In-app inbox records remain available. Only newly created canonical release notifications are queued. The worker rejects legacy milestone keys and reminders outside their J-7 day before dispatch. Database uniqueness on the internal notification and on each notification/device delivery pair prevents duplicate push across retries or overlapping projections. The API records Expo tickets, checks receipts after 15 minutes, retries transient send failures up to five attempts, and expires missing receipts after 24 hours. Push taps open the matching movie or series detail through a `tvapp://` deep link.

This milestone covers followed-release push only. Social and community push categories remain outside P0.2.

## Operations

Every full run writes a row to `release_event_sync_runs` with its status and content, create, update, withdrawal, and failure counts. The API also writes a `release_events.sync.completed` log record. Push batches write `push.release.dispatch.completed` with the attempted delivery count.

`EXPO_PUSH_ACCESS_TOKEN` is optional. Set it only when enhanced Expo push security is enabled for the project, and keep it backend-only.

With the sealed monitoring key, staging and production operators can read the latest run at:

`GET /internal/monitoring/release-events`

The route returns 404 in development and 401 for a missing or invalid key. A `partial` or `failed` status, or the absence of a recent run while release alerts exist, requires checking the API error logs and TMDB availability.

## Verification

Run:

```powershell
pnpm --filter api typecheck
pnpm --filter api exec tsx src/release-events/release-events.qa.ts
pnpm --filter api exec tsx src/security/notifications-sync-qa.ts
pnpm --dir apps/api exec tsx src/notifications/release-calendar.qa.ts
pnpm --dir apps/api exec tsx src/push/push.qa.ts
pnpm --dir apps/mobile exec tsx src/notifications/releaseCalendarModel.qa.ts
pnpm --dir apps/mobile exec tsx src/notifications/pushNotifications.qa.ts
pnpm --filter api db:deploy
pnpm --filter api run security:notifications-smoke
```
