# Page entrance audit

Checked on 2026-09-10. Scope: 30 pages reachable through App.tsx, plus the legacy ExploreScreen.

The initial Screen animation previously ran while the skeleton was visible. Data arriving later did not restart it. Screen now accepts contentReady, and nested ScreenReveal sections inherit that readiness. Loading placeholders remain visible. When data arrives, the existing mounted content reveals once, without resetting forms or scroll views.

## Page coverage

This table records source inspection and implementation coverage, not individual iPhone runtime acceptance.

| Page | Entrance treatment |
| --- | --- |
| Home | Data readiness, hero, continue watching, social activity, trending |
| Discover | Search, recommendations, collections gated by their own data, additional titles |
| Explore, legacy | Header and loaded discovery composition |
| Discover results | Data readiness, title and results grid |
| Explore discovery | Data readiness and loaded genre groups |
| Film detail | Loaded hero and detail body |
| Series detail | Loaded hero and detail body |
| Episode detail | Loaded still and detail body |
| Actor detail | Actor readiness, portrait, biography, filmography heading and grid |
| Community | Data readiness, introduction and feed |
| Library | Data readiness, summary and collection sections |
| Journal | Data readiness, introduction, date controls and monthly history |
| Profile | Profile readiness and shared profile sections |
| Public profile | Profile readiness and shared profile sections |
| Profile reviews | Header, then the existing FlatList when results are ready |
| Profile media | Data or route-provided items, then media rails |
| Profile connections | List readiness and loaded people list |
| All-time statistics | Stats readiness, hero, summary and subsequent sections |
| Settings | Saved-settings readiness, profile editor, privacy, notifications and remaining sections |
| Blocked users | List readiness and loaded people list |
| Notifications | Inbox readiness, requests and alert groups |
| Notification preferences | Preference readiness, introduction, permission status and switches |
| Release calendar | Data readiness, introduction, calendar and agenda |
| Personal watchlist | Shared section and poster-grid entrances mounted after data |
| Shared watchlist | Shared sections with staggered delays, titles, votes and members |
| Shared vote | Loaded session status, candidates and closing section |
| Import data | Introduction, sources, preview/result and explanatory note |
| Import matches | Tabs and existing virtualized list; no per-cell scroll animation |
| Legal document | Introduction and document sections |
| Demo access | Sign-in form entrance; typing does not replay it |
| Onboarding | Existing animated step track retained, plus shared Screen entrance |

## Verification

- Mobile TypeScript passes.
- Page coverage QA discovers screens from App.tsx and checks all 31 entries, including the shared profile/watchlist compositions and onboarding's existing transition.
- The complete mobile test suite passes, including backgroundRefreshVisibility updated to account for actor search results.
- A browser harness renders the actual ScreenReveal component using React Native Web and a controlled navigation-focus context. A 700 ms simulated load confirms that neither the parent nor nested sections consume their entrance early, and that placeholders stay visible.
- The same harness verifies stagger order, completion, preserved input identity and draft, refresh without replay, return navigation without replay, interruption cleanup, reduced motion and absence of runtime errors.
- This is not full-page iPhone visual verification. No native rebuild was performed. Next device checks: Settings and Actor detail with both cached data and an uncached request, then the secondary-page inventory above.
