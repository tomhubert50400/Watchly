# Discover

Discover occupies the existing Explore tab. Search opens separately. Its media filter applies to recommendations and is carried into collection results. Mood selection is a single optional draft choice in a bottom sheet; Apply commits it and Clear mood resets the draft. Collections keep the existing blended Watchlist artwork with their title below the image.

## Recommendations

- Favorites and ratings of at least 4/5 supply up to three distinct seeds per format. A favorite rated 2/5 or lower is not a positive seed.
- Recommendations from those seeds rank first, followed by genre affinity within the same format. Movies and TV shows are interleaved. The explanation names a liked title only when its TMDB recommendations include the candidate.
- Tracked titles (including watchlists), rated titles, viewing history and series with watched episodes are excluded. Watched-only onboarding selections are not assumed to be likes.
- Without positive seeds, the default pool uses released popular catalogue titles. Mood pools are editorial, not generated from genre labels: the initial eight pools each contain three movies and three series. They can be exhausted for an experienced viewer; the screen offers changing or clearing the mood instead of silently broadening it.
- Update `apps/api/src/catalogue/discover-model.ts` to extend these selections. Verify IDs and mood suitability before adding titles. All initial IDs were checked against live TMDB on 2026-09-08.

## Collections

The 2000s and 90s collections use original release/first-air dates. Animation uses the animation genre for both formats. The awards selection contains Parasite, Everything Everywhere All at Once, Moonlight, Breaking Bad, Succession and Fleabag. It is a selection, not a complete awards archive.

Award references: [Oscars 2020](https://www.oscars.org/oscars/ceremonies/2020), [Oscars 2023](https://www.oscars.org/oscars/ceremonies/2023), [Oscars 2017](https://www.oscars.org/oscars/ceremonies/2017), [Breaking Bad](https://www.televisionacademy.com/shows/breaking-bad), [Succession](https://www.televisionacademy.com/shows/succession), [Fleabag](https://www.televisionacademy.com/shows/fleabag).

## Boundaries and verification

`GET /catalog/discover` accepts an optional verified identity and an optional mood. Personalized responses use private/no-store HTTP headers. Only public TMDB responses are cached on the API (one hour, bounded cache, coalesced concurrent requests). Mobile persisted recommendation caches are scoped to the user. Changes to ratings/tracking/viewing data trigger revalidation. Collections are public and paginated.

The API QA covers ranking, format separation, exclusions, identity scoping, invalid inputs, mood membership, catalogue caching and total failure. Live local HTTP checks covered all eight moods, collection previews and pagination. A React Native Web component harness checked mood Apply, format filtering and collection pagination with live anonymous API data; its auth/navigation/native runtime adapters are test-only. iOS bundle export succeeded. Physical iPhone appearance, swipe behavior, and a signed-in device session still need validation. No deployment is implied by these checks.
