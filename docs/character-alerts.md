# Character release alerts

Character follows are explicit and independent of film/saga bells. Identity is a stable character key within a named continuity. Neither an actor ID nor a matching role name defines identity. Recasting does not require users to follow again; reboots get different keys.

## Verified catalogue

The initial catalogue lives in `apps/api/src/notifications/character-catalogue.ts`. It contains six characters from several franchises, not a universal TMDB character index. Unsupported titles do not show character controls. Notification preferences expose the available catalogue and the user's followed state.

Movie membership was checked against the live TMDB movie-details/credits API on 2026-09-10. Each numeric ID in the catalogue can be inspected at `https://www.themoviedb.org/movie/<id>/cast` or `GET /3/movie/<id>/credits`.

- Iron Man: MCU appearances, including The Avengers, Captain America: Civil War and Spider-Man: Homecoming.
- Jack Sparrow: the five released Pirates of the Caribbean films.
- James Bond: the Casino Royale continuity, separate from earlier Bond films.
- Batman: the Dark Knight trilogy, separate from The Batman and other reboots.
- Albus Dumbledore: the Wizarding World films, including Richard Harris, Michael Gambon and Jude Law's portrayals.
- Harry Potter: the original eight films, excluding the television reboot.

Adding an appearance requires verifying both the credited character and the continuity. Add its content type and TMDB ID to the existing key. Do not add an entire collection, another role by the same actor, rumours, or an unverified future appearance. Adding a character requires a new stable key, display name, continuity label and verified appearances. Existing keys must remain stable because subscriptions reference them.

Future appearances are **not discovered automatically**. A reviewed catalogue update is required. Once an appearance is added, existing followers are included in scheduled reminders without following again. The initial verified list contains past films; it does not invent forthcoming appearances to make a follow send an alert.

## Delivery and management

- `GET /notifications/characters` lists the supported characters and this user's follow state.
- `GET /notifications/characters/:contentType/:tmdbId` lists verified characters for a title.
- `PUT /notifications/characters/:characterKey` follows; `DELETE` unfollows. Both require authentication and an existing key.
- Following only persists a subscription. It does not generate an announcement or backlog.
- Scheduled sync and explicit notification refresh combine character appearances with direct/saga subscriptions, deduplicated per user and title. Character appearances do not expand into their film's saga.
- The existing canonical release pipeline determines dates, J-7 eligibility and push preferences. Film and character subscriptions share the same notification/delivery identity.
- Calendar scope includes character appearances. Past dates are filtered by the calendar as before.
- Account deletion cascades to character subscriptions.

## Rollout and verification

Apply `20260910140000_character_alert_subscriptions` before deploying the API that reads the new table. The migration is additive. No native dependency or native rebuild is introduced.

Run API/mobile typechecks, `character-alerts.qa.ts`, `notifications-sync-qa.ts`, `release-calendar.qa.ts`, and `push.qa.ts`. On an iPhone, verify follow/unfollow from a film and notification preferences, navigation back to refresh the state, permission refusal, long continuity labels, and background J-7 delivery versus silent foreground handling. A fixture must use a controlled future date; do not alter real catalogue release dates to trigger a push.
