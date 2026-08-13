# ReleaseEvent canonical release source

## Scope

`ReleaseEvent` is the API source of truth for release dates used by internal alerts and, later, the personal calendar and push delivery.

The current flow is:

`TMDB -> release_events -> internal notifications`

P0.2 does not add the calendar UI or system push delivery. Those consumers must read `release_events` instead of calling TMDB independently.

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

Notification dedupe keys are stable per content identity and milestone, for example `movie:603:announcement`. They no longer contain the release date.

When a date moves, the notification row updates its `releaseEventId`, copy, and `releasedAt` value. An unread future milestone that is no longer valid is removed. Read or past notification history is preserved.

## Operations

Every full run writes a row to `release_event_sync_runs` with its status and content, create, update, withdrawal, and failure counts. The API also writes a `release_events.sync.completed` log record.

With the sealed monitoring key, staging and production operators can read the latest run at:

`GET /internal/monitoring/release-events`

The route returns 404 in development and 401 for a missing or invalid key. A `partial` or `failed` status, or the absence of a recent run while release alerts exist, requires checking the API error logs and TMDB availability.

## Verification

Run:

```powershell
pnpm --filter api typecheck
pnpm --filter api exec tsx src/release-events/release-events.qa.ts
pnpm --filter api exec tsx src/security/notifications-sync-qa.ts
pnpm --filter api db:deploy
pnpm --filter api run security:notifications-smoke
```
