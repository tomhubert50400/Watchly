# Watchlist filters and filter data caches

Personal and shared watchlists expose a funnel in the native header. Type
(All, Movies, Series) and genre combine without changing membership, section
assignments, source order, or shared vote candidates. Clear filters restores
all titles. Genre loading is progressive, with retry and empty-result states.

Profile genre filters and both watchlist types share public genre metadata by
content type and TMDB ID. The session cache holds 2,000 entries for 24 hours,
reuses already loaded catalogue details, and coalesces duplicate requests.
Cold loads use three workers; closing or superseding a loader stops further
scheduling and publication. Personal and shared list artwork also hydrates
beyond the first twelve titles.

Other filter surfaces reuse their source data:

| Surface | Cache behavior |
| --- | --- |
| Discover moods and browse filters | Existing scoped cache is reused when returning to a fresh filter. Accumulated browse pages are retained in memory and invalidated on first-page refresh. |
| Discover and Explore search | Public title/actor results use a five-minute session cache. Profile results are scoped to the viewer and social/profile revision. |
| Onboarding taste | Initial options, genre selections, and search results use the five-minute public cache. |
| Actor filmography, notifications, release calendar, watchlist overview/progress | Filters run locally over the existing cached source data. Static filter options need no network request. |

Filter selections retain their existing screen-local behavior. This change
caches data, not preferences. Private result keys never contain authentication
tokens and remain isolated by account.

Validation lives in the mobile suite: `mediaGenresCache.qa.ts` covers 500 cached
titles, TTL, coalescing, failures, and cancellation; `watchlistFiltersModel.qa.ts`
covers combined filters, media identity, sections, ordering, and clearing.
The existing catalogue/cache and watchlist hydration tests cover filter revisits,
pagination invalidation, account isolation, and progressive list artwork.
