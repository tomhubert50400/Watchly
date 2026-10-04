# Home discovery

Home shows nine catalogue rows with 20 titles per row when the matching TMDB catalogue has enough results. Trending this week and All-time favorites remain visible. Cinema from the selected country also remains visible when the country is known. The remaining slots rotate after a randomly selected duration of three to seven whole days. A seeded UTC schedule anchored on January 1, 2026 keeps each cycle stable across requests, API replicas and restarts, and shared by all users. The thirteen other categories take turns in the rotating slots.

The categories are trending, all-time favorites, comedy, local cinema, recent releases, crime and mystery, science fiction and fantasy, animation, blockbusters, the 2000s, action and adventure, horror, romance, documentaries, the 1990s and movies under 90 minutes.

The local cinema row uses TMDB's origin-country filter for movies, including international coproductions. It reuses the existing watch region: IP country by default, with a manual choice taking precedence for two hours. This describes productions from the country, not local streaming availability or a country-specific popularity chart. An unknown country never defaults to another country; a rotating category fills its slot.

All-time favorites sort by TMDB rating, with at least 2,000 votes for movies and 500 for series. Recent releases cover the previous six months, with at least 20 votes. Other discovery rows generally require 100 votes, including local cinema. Blockbusters sort movies by TMDB revenue. Under 90 minutes excludes unknown and zero runtimes. Genres use the corresponding movie or television IDs.

View all opens the selected category's grid. Mixed categories retain the All, Movies and TV Shows selector. Pagination consumes both halves of each upstream TMDB page rather than skipping results. Home prepares the first grid page in memory. Country and UTC day are included in Home cache keys so a cached selection cannot survive a rotation boundary; the API controls which days actually change the categories. Grid caches include category and country. Public TMDB requests share the existing one-hour cache and in-flight request coalescing.

Categories load independently of the existing spotlight and signed-in Home sections. Partial or failed loads provide a retry action. Horizontal lists render posters in small batches.

Verification: `pnpm --dir apps/api exec tsx src/catalogue/home-categories.qa.ts` covers rotation, country filtering, format-specific queries, result counts, pagination, caching, invalid inputs and partial/complete upstream failure. Physical iPhone appearance and gestures require device validation.
