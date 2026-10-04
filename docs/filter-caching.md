# Watchlist filters and filter data caches

Personal and shared watchlists group Filters, adding titles, artwork, and
section/member actions in one hamburger menu with icons and labels. Artwork
customization remains owner-only in shared lists. Profile media pages,
including Planned, place their genre funnel beside the section selector. Type
(All, Movies, Series) and genre combine without changing membership, section
assignments, source order, or shared vote candidates. Clear filters restores
all titles. Genre loading is progressive, with retry and empty-result states.

On iOS the hamburger uses a native UIMenu attached to the header button through
`@react-native-menu/menu`. UIKit places it below the top-right button and towards
the available space on its left. This native view requires a new iOS build.
Existing builds and Expo Go retain the native action sheet, with a synchronous
presentation guard to ignore rapid repeated taps. Other platforms retain the
anchored popup. Both iOS presentations preserve disabled and selected actions.

Profile genre filters and both watchlist types share public genre metadata by
content type and TMDB ID. The session cache holds 2,000 entries for 24 hours,
reuses already loaded catalogue details, and coalesces duplicate requests.
Cold loads use three workers; closing or superseding a loader stops further
scheduling and publication. Personal and shared list artwork also hydrates
beyond the first twelve titles.

Watchlists start preparing genres when their items arrive, before Filters is
opened. Genre and artwork progress updates are batched at 100 ms, with an
immediate final publication, to reduce repeated list renders while loading.
Type-only filtering keeps its results stable during genre progress updates.

The artwork sheet keeps independent cover/background drafts across tabs. Its
single Save cover & background button writes only changed selections and closes
after both saves succeed. If one request fails, the sheet stays open; retry
skips selections already saved successfully.

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
