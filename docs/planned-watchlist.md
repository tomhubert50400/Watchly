# Planned to Watch

Each user's automatic personal watchlist mirrors tracking states with status
`WATCHLISTED`, the same rule used by the profile's Planned tab. It is created on
the first planned title and remains available when empty. It starts private and
does not count toward the five manually created personal watchlists.

The list is identified by `systemKey = 'planned'`, unique per user. A manually
created list with the same name remains independent. The automatic list cannot
be deleted, but its titles, sections, artwork, and visibility can be managed.

Adding or removing a title through the automatic list updates its tracking
status while retaining favorites and other list memberships. Any transition
out of `WATCHLISTED`, including marking a movie watched, removes the title.

The database trigger `user_content_states_sync_planned` maintains membership
within the tracking transaction. This also covers imports, viewing history,
and onboarding without separate synchronization calls. Watchlist mutations
change tracking first; they must not lock the list before the tracking row.
Concurrent batch imports and tracking edits can conflict. The existing database
retry budget also retries rolled-back transaction conflicts without resetting
the connection pool.

User-created personal lists offer **Settings > Remove movies after watching**.
The preference defaults to off and applies only to future watched transitions
or newly logged movie viewings, including rewatches. Enabling it does not remove
previously watched movies. Series, shared lists, favorites, and viewing history
are unaffected. Planned keeps its automatic rule and does not offer this setting.
Deploy migration `20261002120000_watchlist_remove_watched_movies` with the API
before releasing this setting in the mobile app.

Migration `20261002090000_add_planned_watchlist` creates private automatic lists
for existing planned titles. Deploy this migration with the API before releasing
the mobile changes. It has not been applied to production during development.

## Local validation

Point `DATABASE_URL` at a disposable local PostgreSQL database, apply migrations,
then run `pnpm --filter api test:planned-watchlist`. The integration test rejects
remote database hosts and cleans up its fixtures. It checks bidirectional
synchronization, status changes, favorites, duplicate additions, ownership,
movie/series IDs, independent lists, empty lists, manual/import quotas, and
recovery from an actual concurrent PostgreSQL deadlock.

Run `pnpm --filter api test:watchlist-settings` against the same local test
database to verify per-list retention, watched transitions, rewatches, history
edits, ownership isolation, and the unchanged Planned/shared-list behavior.

Personal watchlist artwork loads progressively for every title, with at most
three catalogue requests in flight. Known titles and artwork survive refreshes;
superseded requests stop scheduling or publishing results. The mobile test suite
includes a 500-title regression that checks progress beyond the former 12-title
limit, ordering, retries, metadata retention, and cancellation.
