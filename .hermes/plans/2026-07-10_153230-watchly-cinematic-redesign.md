# Watchly Cinematic Redesign Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Implement the approved cinematic Watchly UX across Home, Explore, Library, Profile, Journal, content details, ratings/reviews, episode progress, shared voting, alerts, authentication, and resilient cached states without weakening existing privacy or authentication guarantees.

**Architecture:** Replace the hand-built horizontal pager with React Navigation bottom tabs and keep detail flows in the native stack. Introduce a small persisted stale-while-revalidate layer over AsyncStorage so cached data survives refresh failures, then split the current large screens into data controllers and reusable presentation components. Extend the existing NestJS/Prisma contracts only where the approved UX requires missing domain behavior: generalized alerts, mark-all-read, and closeable/expiring shared votes.

**Tech Stack:** Expo 54, React Native 0.81, React 19, React Navigation 7, AsyncStorage, NestJS 11, Prisma 7/PostgreSQL, Firebase Auth, TypeScript, existing `tsx` QA/smoke scripts, iOS Simulator.

---

## 1. Approved source of truth

Use these artifacts as immutable visual references:

- `design/watchly-wireframes-v1.html` — Home, Explore, content detail.
- `design/watchly-wireframes-v2-library-profile.html` — Library, Profile, Journal.
- `design/watchly-wireframes-v3-interactions.html` — rating/review, episodes, add-to-list.
- `design/watchly-wireframes-v4-states.html` — shared vote, alerts, signed-out providers, empty/cache/error states.
- `screenshots/wireframes-v1/` through `screenshots/wireframes-v4/` — final mobile crops.

Non-negotiable product decisions:

1. Primary architecture is Home / Explore / Library / Profile.
2. Remove the custom horizontal pager and horizontal tab swiping.
3. Rating stars, rating values, and filled rating icons use Watchly raspberry; no gold rating system remains.
4. The neutral segmented control remains; its active button has no raspberry underline/border.
5. Written reviews and comments remain visually neutral; raspberry is not a generic “review color.”
6. Journal belongs to Library. Profile contains identity, public stats, and public opinions only.
7. Cached content remains visible during refresh and after refresh failure.
8. All sign-in providers remain visible: Google, Apple, Microsoft, Discord, Facebook.
9. Unwired providers show a safe setup message; they are not hidden and do not fake success.
10. Development review auth stays impossible in production.
11. Keep current product copy language (English) during implementation. Localization is a separate project; French wireframe copy is structural, not an i18n requirement.
12. No global auth bypass, privacy relaxation, or production Firebase Email/Password activation.

## 2. Current implementation map

- `apps/mobile/App.tsx` owns a custom `Animated`/`PanResponder` pager with Feed / Explore / MyTV / Profile.
- `apps/mobile/src/design/tokens.ts` still defines `colors.rating` as gold (`#F2C96D`).
- `apps/mobile/src/components/SegmentedControl.tsx` uses an accent border and accent-selected text.
- `apps/mobile/src/catalogue/CatalogueCacheContext.tsx` and `apps/mobile/src/watchlists/WatchlistCacheContext.tsx` cache only in React memory.
- `apps/mobile/src/tracking/MyTvScreen.tsx` is a 1,399-line mixed data/UI screen and clears visible content on total refresh failure.
- `apps/mobile/src/feed/FeedScreen.tsx` clears feed items when refresh fails.
- `apps/mobile/src/profile/ProfileScreen.tsx` already preserves visible opinions on refresh failure, but presents the private film log as Profile.
- `apps/mobile/src/catalogue/SeriesDetailScreen.tsx` and `apps/mobile/src/catalogue/SeasonDetailScreen.tsx` duplicate episode-list responsibilities.
- `apps/mobile/src/watchlists/AddToWatchlistControl.tsx` already has optimistic multi-list selection and rollback; retain its behavior while restyling.
- `apps/mobile/src/tracking/StarRatingPanel.tsx` already supports half-star taps.
- `apps/mobile/src/auth/ProfileAuthCard.tsx` already renders all five providers.
- `apps/api/src/notifications/notifications.controller.ts` already supports list, sync, and single mark-read; mobile does not expose them and mark-all-read is missing.
- `apps/api/prisma/schema.prisma` models only release notifications, not shared-list/vote alerts.
- Shared voting already supports create/vote/remove-vote, but sessions have no `closedAt`/`expiresAt` state.
- The working tree already contains separate Firebase Auth Emulator/review-account changes. Preserve and commit those separately before UI work.

## 3. Target navigation

```text
RootStack
├── MainTabs
│   ├── Home
│   ├── Explore
│   ├── Library
│   └── Profile
├── FilmDetail
├── SeriesDetail
├── SeasonDetail
├── EpisodeDetail
├── Journal
├── Notifications
├── PersonalWatchlist
├── SharedWatchlist
├── SharedVote
├── PublicProfile
└── Settings
```

Use `@react-navigation/bottom-tabs`; do not rebuild another manual tab state machine.

## 4. Cache contract

Persist only JSON-safe server responses, keyed by authenticated user where applicable:

```ts
export type CacheEnvelope<T> = {
  data: T;
  savedAt: string;
  version: 1;
};

export type CachedResourceState<T> = {
  data: T | null;
  error: string | null;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  savedAt: string | null;
};
```

Behavior:

- No cached data + request pending → blocking loading state.
- Cached data + request pending → render data plus inline “Updating” banner.
- Cached data + request failure → retain data plus inline error/retry banner.
- No cached data + request failure → full error state.
- Sign-out → clear user-scoped in-memory state; retain encrypted/auth-free public catalogue cache only. Do not expose one user’s cached private data to another user.
- Use user ID in private cache keys and remove that user’s private keys during sign-out.

---

### Task 1: Freeze the reviewed baseline and isolate existing auth-emulator work

**Objective:** Start redesign work from a reproducible, clean baseline without mixing prior security/auth changes into visual commits.

**Files:**
- Review only: `apps/api/src/auth/firebase-token-verifier.service.ts`
- Review only: `apps/api/src/security/auth-token-verifier-qa.ts`
- Review only: `apps/mobile/src/auth/AuthSessionContext.tsx`
- Review only: `apps/mobile/src/auth/firebase.ts`
- Review only: `apps/mobile/src/auth/devAuthConfig.ts`
- Review only: `apps/mobile/src/auth/devAuthConfig.qa.ts`
- Review only: `firebase.json`

**Steps:**

1. Run `git status --short` and classify every existing change as auth-emulator, design evidence, audit output, or unrelated.
2. Remove only accidental `.DS_Store` files; do not delete audit/design evidence.
3. Run `pnpm run check` from repository root. Expected: exit 0.
4. Run the local review-account smoke: Auth Emulator, API `/health`, `/auth/me`, and one authenticated mobile launch. Expected: `Watchly UI Review` reaches MainTabs.
5. Commit only auth-emulator/runtime guard changes:

```bash
git add firebase.json apps/api/src/auth/firebase-token-verifier.service.ts \
  apps/api/src/security/auth-token-verifier-qa.ts apps/mobile/.env.example \
  apps/mobile/package.json apps/mobile/src/auth/AuthSessionContext.tsx \
  apps/mobile/src/auth/firebase.ts apps/mobile/src/auth/devAuthConfig.ts \
  apps/mobile/src/auth/devAuthConfig.qa.ts apps/mobile/src/config/publicEnv.ts
git commit -m "test(auth): add isolated local review account"
```

6. Commit design artifacts separately:

```bash
git add design screenshots/wireframes-v1 screenshots/wireframes-v2 \
  screenshots/wireframes-v3 screenshots/wireframes-v4
git commit -m "docs(design): add approved Watchly redesign"
```

**Verification:** `git status --short` contains no unclassified source changes.

---

### Task 2: Lock design tokens and visual primitives with QA

**Objective:** Make the approved color/spacing rules reusable before changing screens.

**Files:**
- Modify: `apps/mobile/src/design/tokens.ts`
- Modify: `apps/mobile/src/components/SegmentedControl.tsx`
- Create: `apps/mobile/src/design/tokens.qa.ts`
- Modify: `apps/mobile/package.json`

**Step 1: Write failing QA**

```ts
import assert from 'node:assert/strict';
import { colors } from './tokens';

assert.equal(colors.rating, colors.accent);
assert.equal(colors.ratingSoft, colors.accentSoft);
assert.notEqual(colors.segmentSelectedBorder, colors.accentBorder);
console.log('Design token QA passed.');
```

Add `tsx src/design/tokens.qa.ts` to the mobile `test` script.

**Step 2: Verify RED**

Run: `pnpm --filter mobile test`

Expected: FAIL because rating is still gold and `segmentSelectedBorder` does not exist.

**Step 3: Implement minimal token changes**

- Set `rating`, `ratingBorder`, and `ratingSoft` to raspberry equivalents.
- Add neutral segmented-control tokens such as `segmentSelected`, `segmentSelectedBorder`, and `segmentSelectedText`.
- Update `SegmentedControl` to use neutral selected background/border/text. Preserve its animated filled button; remove only raspberry border/text treatment.
- Keep `touchTargets.min` at 44.

**Step 4: Verify GREEN**

Run: `pnpm --filter mobile test && pnpm --filter mobile typecheck`

Expected: both exit 0.

**Commit:**

```bash
git add apps/mobile/src/design apps/mobile/src/components/SegmentedControl.tsx apps/mobile/package.json
git commit -m "style(mobile): lock Watchly redesign tokens"
```

---

### Task 3: Replace the custom pager with standard bottom tabs

**Objective:** Remove horizontal tab swiping and use supported navigation primitives.

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/mobile/App.tsx`
- Modify: `apps/mobile/src/navigation/types.ts`
- Create: `apps/mobile/src/navigation/tabConfig.ts`
- Create: `apps/mobile/src/navigation/tabConfig.qa.ts`

**Steps:**

1. Add the dependency:

```bash
pnpm --filter mobile add @react-navigation/bottom-tabs@^7
```

2. Write `tabConfig.qa.ts` asserting exact order and labels: Home, Explore, Library, Profile.
3. Run QA and confirm RED because `tabConfig.ts` does not exist.
4. Create typed `RootTabParamList` and static config.
5. Replace `MainTabs`’ `Animated`, `PanResponder`, `activeIndex`, and pager track with `createBottomTabNavigator`.
6. Rename route `Feed` → `Home`, `MyTV` → `Library`; initially map them to existing `FeedScreen` and `MyTvScreen` to keep behavior intact.
7. Preserve accessibility role/state and 44pt minimum tab hit targets.
8. Run `pnpm --filter mobile test && pnpm --filter mobile typecheck`.
9. Simulator verification: tab taps work; horizontal swipes no longer change tabs; stack detail navigation still works.

**Commit:** `refactor(navigation): replace custom pager with bottom tabs`

---

### Task 4: Add persisted stale-while-revalidate primitives

**Objective:** Establish one tested cache behavior before refactoring data screens.

**Files:**
- Create: `apps/mobile/src/cache/cacheEnvelope.ts`
- Create: `apps/mobile/src/cache/persistedCache.ts`
- Create: `apps/mobile/src/cache/cachedResourceReducer.ts`
- Create: `apps/mobile/src/cache/cachedResourceReducer.qa.ts`
- Create: `apps/mobile/src/cache/useCachedResource.ts`
- Modify: `apps/mobile/package.json`

**Required reducer states:**

```ts
initial -> initialLoading -> success(data)
success(data) -> refreshing(data) -> success(newData)
success(data) -> refreshing(data) -> refreshError(data, message)
initialLoading -> initialError(message)
```

**Steps:**

1. Write reducer QA for all four transitions, including “refresh failure never clears data.”
2. Run QA; expected RED.
3. Implement JSON envelope parsing with version validation and malformed-cache rejection.
4. Implement AsyncStorage read/write/remove helpers; never persist Firebase tokens.
5. Implement `useCachedResource({ key, load, enabled })` with request-version cancellation and explicit `retry()`.
6. Clear private cache keys on sign-out in `AuthSessionContext`; prefix with `watchly:user:<userId>:`.
7. Run mobile tests/typecheck.

**Commit:** `feat(cache): add persisted stale-while-revalidate resources`

---

### Task 5: Build shared cinematic UI primitives

**Objective:** Avoid copying wireframe styling across screens.

**Files:**
- Create: `apps/mobile/src/components/AppHeader.tsx`
- Create: `apps/mobile/src/components/SectionHeader.tsx`
- Create: `apps/mobile/src/components/InlineStatusBanner.tsx`
- Create: `apps/mobile/src/components/BottomActionSheet.tsx`
- Create: `apps/mobile/src/components/StarRatingDisplay.tsx`
- Create: `apps/mobile/src/components/PosterStack.tsx`
- Modify: `apps/mobile/src/components/Button.tsx`
- Modify: `apps/mobile/src/components/Screen.tsx`
- Modify: `apps/mobile/src/components/EmptyState.tsx`
- Modify: `apps/mobile/src/components/LoadingState.tsx`

**Acceptance criteria:**

- `StarRatingDisplay` supports 0.5 increments with clipped raspberry fill and gray empty fill.
- `BottomActionSheet` uses React Native `Modal` + `Animated`; no new sheet dependency.
- `InlineStatusBanner` has `updating`, `offline`, `error`, and `success` tones and optional retry.
- `Screen` supports optional horizontal padding, sticky/regular header, cached refresh banner, and safe-area-aware tab padding.
- Empty state CTA remains at least 44pt.

**Verification:** Add pure QA for star-fill ratios and banner-state mapping; run mobile tests/typecheck and render a temporary component gallery only in `__DEV__` if needed, then remove it before commit.

**Commit:** `feat(ui): add cinematic Watchly primitives`

---

### Task 6: Compose the new Home screen

**Objective:** Replace the review-only Feed tab with the approved cinematic Home composition.

**Files:**
- Create: `apps/mobile/src/home/HomeScreen.tsx`
- Create: `apps/mobile/src/home/homeData.ts`
- Create: `apps/mobile/src/home/homeData.qa.ts`
- Create: `apps/mobile/src/home/HomeHero.tsx`
- Create: `apps/mobile/src/home/ContinueWatchingRail.tsx`
- Create: `apps/mobile/src/home/SocialActivityRail.tsx`
- Modify: `apps/mobile/App.tsx`
- Reuse: `apps/mobile/src/api/catalogue.ts`
- Reuse: `apps/mobile/src/api/feed.ts`
- Reuse: `apps/mobile/src/api/progress.ts`

**Data contract:** Load trending catalogue publicly. When signed in, load progress summaries and feed in parallel. One failing signed-in section must not remove the others.

**TDD:**

1. Add QA for `buildHomeSections`: signed-out, signed-in full, partial failure, and empty feed.
2. Confirm RED.
3. Implement pure composition and section-specific error metadata.
4. Implement `HomeScreen` with persisted cache and background refresh.
5. Point Home tab to `HomeScreen`; keep `FeedScreen` temporarily for comparison, then remove after parity is verified.
6. Verify with signed-out and review accounts.

**Commit:** `feat(home): add cinematic personalized home`

---

### Task 7: Restyle Explore without changing search semantics

**Objective:** Match the approved discovery layout while preserving debounce, keyboard behavior, and release alerts.

**Files:**
- Modify: `apps/mobile/src/catalogue/ExploreScreen.tsx`
- Create: `apps/mobile/src/catalogue/ExploreMediaCard.tsx`
- Create: `apps/mobile/src/catalogue/exploreState.ts`
- Create: `apps/mobile/src/catalogue/exploreState.qa.ts`

**Steps:**

1. Extract search/section state mapping and test trending, announced, search, empty, and error labels.
2. Keep 350ms debounce and iOS keyboard accessory.
3. Replace vertical generic cards with the approved poster-led rails/grid.
4. Keep the original neutral segmented control with no raspberry underline.
5. Use persisted public cache for trending/announced; search results may remain session-only.
6. Keep cached section data visible if refresh fails and show `InlineStatusBanner`.
7. Verify search, Trending, Announced, release alert toggle, keyboard dismissal, and detail navigation.

**Commit:** `feat(explore): implement cinematic discovery layout`

---

### Task 8: Split and rebuild Library

**Objective:** Replace the 1,399-line My TV screen with the approved Library while retaining all mutations.

**Files:**
- Create: `apps/mobile/src/library/LibraryScreen.tsx`
- Create: `apps/mobile/src/library/useLibraryData.ts`
- Create: `apps/mobile/src/library/libraryModel.ts`
- Create: `apps/mobile/src/library/libraryModel.qa.ts`
- Create: `apps/mobile/src/library/LibrarySummary.tsx`
- Create: `apps/mobile/src/library/ContinueWatchingCard.tsx`
- Create: `apps/mobile/src/library/WatchlistRail.tsx`
- Create: `apps/mobile/src/library/ReleaseAlertRow.tsx`
- Modify: `apps/mobile/App.tsx`
- Retire after parity: `apps/mobile/src/tracking/MyTvScreen.tsx`

**Data requirements:** tracking states, movie ratings, series progress, personal lists, shared lists, release alerts. Preserve partial success and cached previous data.

**TDD:** Move `mergeLibraryItems`, `shouldShowTrackedTitle`, resume-episode calculation, summary counts, and partial-error mapping into `libraryModel.ts`; test each before moving UI.

**Behavior:**

- Signed out → approved Library visitor/empty guidance, not a generic failure.
- First load without cache → loading state.
- Refresh with cache → data plus updating banner.
- Refresh failure with cache → data plus retry banner.
- True empty success → approved empty Library screen.
- Mutations optimistically update visible state and rollback on error.

**Commit:** `feat(library): rebuild My TV as resilient Library`

---

### Task 9: Move Journal under Library and narrow Profile

**Objective:** Keep private diary/history in Journal and public identity/opinions in Profile.

**Files:**
- Create: `apps/mobile/src/journal/JournalScreen.tsx`
- Create: `apps/mobile/src/journal/journalModel.ts`
- Create: `apps/mobile/src/journal/journalModel.qa.ts`
- Create: `apps/mobile/src/journal/JournalEntryCard.tsx`
- Modify: `apps/mobile/src/profile/ProfileScreen.tsx`
- Modify: `apps/mobile/src/profile/ProfileSummaryCard.tsx`
- Modify: `apps/mobile/src/navigation/types.ts`
- Modify: `apps/mobile/App.tsx`

**Steps:**

1. Test chronological grouping by month, movie/episode filtering, and review count.
2. Register `Journal` stack route and link it from Library.
3. Reuse `/profile/me/opinions` for Journal initially; do not expose private progress through public profile APIs.
4. Profile shows identity, public stats, public ratings/reviews, follow counts, settings/share actions.
5. Remove “Film log” as the Profile title.
6. Preserve Profile’s current non-destructive refresh behavior and migrate it to `useCachedResource`.
7. Verify privacy settings and public-profile preview remain correct.

**Commit:** `feat(profile): separate public profile from private Journal`

---

### Task 10: Implement cinematic film/series detail shells

**Objective:** Match the approved content detail while preserving existing tracking, availability, alerts, lists, and synopsis behavior.

**Files:**
- Modify: `apps/mobile/src/components/MediaHero.tsx`
- Modify: `apps/mobile/src/catalogue/FilmDetailScreen.tsx`
- Modify: `apps/mobile/src/catalogue/SeriesDetailScreen.tsx`
- Modify: `apps/mobile/src/catalogue/HeaderInfoPills.tsx`
- Modify: `apps/mobile/src/catalogue/SynopsisPanel.tsx`
- Modify: `apps/mobile/src/catalogue/StreamingAvailabilityPanel.tsx`

**Behavior:** Cached detail remains visible if background refresh fails. Error state becomes inline when `movie`/`series` already exists; full error only when no cache exists.

**Verification:** Film and series hero images, safe-area back navigation, metadata, actions, tracking, availability, future-content alert, and accessibility labels.

**Commit:** `feat(catalogue): implement cinematic detail screens`

---

### Task 11: Consolidate rating and review into one opinion sheet

**Objective:** Implement the approved half-star + optional written review interaction without changing API semantics.

**Files:**
- Create: `apps/mobile/src/opinions/OpinionSheet.tsx`
- Create: `apps/mobile/src/opinions/opinionState.ts`
- Create: `apps/mobile/src/opinions/opinionState.qa.ts`
- Modify: `apps/mobile/src/tracking/MovieRatingControl.tsx`
- Modify: `apps/mobile/src/tracking/EpisodeRatingControl.tsx`
- Modify: `apps/mobile/src/reviews/MovieReviewEditor.tsx`
- Modify: `apps/mobile/src/reviews/EpisodeReviewEditor.tsx`
- Reuse/retire: `apps/mobile/src/tracking/StarRatingPanel.tsx`
- Reuse/retire: `apps/mobile/src/reviews/ReviewEditor.tsx`

**TDD cases:** half-star hit mapping, dirty state, save eligibility, rating save succeeds/review fails, rollback, delete review, clear rating confirmation.

**Rules:**

- Rating can exist without review.
- Review requires a rating, matching current backend behavior.
- Save operations stay explicit; no silent review publication.
- Filled and partial stars use raspberry.
- Written text remains neutral.
- Successful save closes sheet and shows a toast; failure keeps user input.

**Commit:** `feat(opinions): unify rating and review interaction`

---

### Task 12: Unify episode list and progress behavior

**Objective:** Remove duplicate episode implementations and use one progress-aware component everywhere.

**Files:**
- Create: `apps/mobile/src/episodes/SeasonEpisodeList.tsx`
- Create: `apps/mobile/src/episodes/useSeasonEpisodes.ts`
- Create: `apps/mobile/src/episodes/episodeModel.ts`
- Create: `apps/mobile/src/episodes/episodeModel.qa.ts`
- Modify: `apps/mobile/src/catalogue/SeriesDetailScreen.tsx`
- Modify: `apps/mobile/src/catalogue/SeasonDetailScreen.tsx`
- Modify: `apps/mobile/src/catalogue/EpisodeDetailScreen.tsx`
- Modify: `apps/mobile/src/tracking/EpisodeProgressControl.tsx`

**TDD cases:** watched state, next episode selection, season progress fraction, mark/unmark optimistic update, rollback, and toast undo intent.

**Behavior:** `SeriesDetailScreen` and `SeasonDetailScreen` both render `SeasonEpisodeList`; neither owns a second row implementation. “Undo” calls the inverse progress endpoint and restores the prior local state.

**Commit:** `refactor(episodes): unify season progress and episode rows`

---

### Task 13: Restyle add-to-list while preserving its proven optimistic logic

**Objective:** Match the approved multi-list sheet without rewriting working mutation behavior.

**Files:**
- Modify: `apps/mobile/src/watchlists/AddToWatchlistControl.tsx`
- Create: `apps/mobile/src/watchlists/WatchlistOptionRow.tsx`
- Create: `apps/mobile/src/watchlists/watchlistSelection.ts`
- Create: `apps/mobile/src/watchlists/watchlistSelection.qa.ts`

**TDD cases:** selected-count label, add/remove diff, personal/shared selection, newly created list auto-selected, rollback to initial selection.

**Behavior:** CTA says `Add to 1 list`, `Add to N lists`, or `Save changes` as appropriate. Shared rows show members and explain that voting becomes available after addition.

**Commit:** `feat(watchlists): implement cinematic multi-list sheet`

---

### Task 14: Generalize notifications and add mark-all-read

**Objective:** Support release, shared-list, and shared-vote alerts required by the approved Alerts screen.

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260710160000_generalize_notifications/migration.sql`
- Modify: `apps/api/src/notifications/notifications.service.ts`
- Modify: `apps/api/src/notifications/notifications.controller.ts`
- Modify: `apps/api/src/shared-watchlists/shared-watchlists.service.ts`
- Create: `apps/api/src/security/notifications-smoke.ts`
- Modify: `apps/api/package.json`

**Schema direction:** Preserve existing release records while renaming/generalizing the table. Use a notification kind enum covering release, shared-list invite, and shared-vote update. Make content IDs nullable for social events; add nullable `sharedWatchlistId`, `votingSessionId`, `actorUserId`, and JSON route metadata. Keep a per-user dedupe key.

**API additions:**

```text
GET /notifications
POST /notifications/sync
PUT /notifications/read-all
PUT /notifications/:notificationId/read
```

**Security tests:**

- A user lists/marks only their notifications.
- Adding a member creates an invite notification for that member.
- Vote-leader updates upsert one session notification per recipient instead of spamming rows.
- Existing release notifications survive migration.

**Commands:**

```bash
pnpm --filter api db:migrate
pnpm --filter api prisma:generate
pnpm --filter api security:notifications-smoke
pnpm --filter api typecheck
```

**Commit:** `feat(api): generalize Watchly notifications`

---

### Task 15: Add the mobile Alerts screen

**Objective:** Implement the approved alert inbox and unread behavior.

**Files:**
- Modify: `apps/mobile/src/api/notifications.ts`
- Create: `apps/mobile/src/notifications/NotificationsScreen.tsx`
- Create: `apps/mobile/src/notifications/notificationModel.ts`
- Create: `apps/mobile/src/notifications/notificationModel.qa.ts`
- Modify: `apps/mobile/src/navigation/types.ts`
- Modify: `apps/mobile/App.tsx`
- Add alert entry point to: `apps/mobile/src/home/HomeScreen.tsx`

**TDD cases:** group Today/This week/Older, filter types, unread count, optimistic mark-read/all-read rollback, and target-route mapping.

**Cache:** user-scoped persisted alerts; keep list visible on sync failure.

**Commit:** `feat(notifications): add resilient alert inbox`

---

### Task 16: Add closeable/expiring shared votes

**Objective:** Make the shared-vote screen truthful and prevent voting after closure.

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260710163000_add_shared_vote_lifecycle/migration.sql`
- Modify: `apps/api/src/shared-watchlists/shared-watchlists.dto.ts`
- Modify: `apps/api/src/shared-watchlists/shared-watchlists.service.ts`
- Modify: `apps/api/src/shared-watchlists/shared-watchlists.controller.ts`
- Modify: `apps/api/src/security/shared-watchlist-smoke.ts`
- Modify: `apps/mobile/src/api/sharedWatchlists.ts`

**Schema:** Add `expiresAt DateTime?` and `closedAt DateTime?` to `SharedVotingSession`.

**Endpoint:**

```text
PUT /shared-watchlists/:watchlistId/voting-sessions/:sessionId/close
```

**Rules:** only owner closes; members vote only while open and unexpired; response includes lifecycle status and leaders; ties remain ties.

**Smoke additions:** member cannot close, outsider cannot read/vote, closed session rejects vote, duplicate vote remains idempotent, leaders computed correctly.

**Commit:** `feat(voting): add shared vote lifecycle`

---

### Task 17: Rebuild the shared-list and vote UI

**Objective:** Match the approved collaborative list and vote flows using existing privacy guards.

**Files:**
- Modify: `apps/mobile/src/watchlists/SharedWatchlistScreen.tsx`
- Create: `apps/mobile/src/watchlists/SharedVoteScreen.tsx`
- Create: `apps/mobile/src/watchlists/sharedVoteModel.ts`
- Create: `apps/mobile/src/watchlists/sharedVoteModel.qa.ts`
- Modify: `apps/mobile/src/navigation/types.ts`
- Modify: `apps/mobile/App.tsx`

**TDD cases:** leader/tie, remaining-time label, open/expired/closed state, selected vote, optimistic vote rollback, close permission.

**Behavior:** preserve cached list if refresh fails; owner member management remains; shared vote is a dedicated route rather than a dense inline admin panel.

**Commit:** `feat(voting): implement collaborative vote screen`

---

### Task 18: Restyle signed-out Profile while keeping every provider visible

**Objective:** Match the approved visitor state without pretending unimplemented auth works.

**Files:**
- Modify: `apps/mobile/src/auth/ProfileAuthCard.tsx`
- Modify: `apps/mobile/src/profile/ProfileScreen.tsx`
- Create: `apps/mobile/src/auth/providerConfig.ts`
- Create: `apps/mobile/src/auth/providerConfig.qa.ts`

**QA:** Assert ordered provider list exactly contains Google, Apple, Microsoft, Discord, Facebook and that only Google is marked wired today unless implementation status changes.

**Behavior:** Google/Apple full-width; Microsoft/Discord/Facebook secondary but named and accessible. Unwired providers retain the current setup message. Review-account auto-login remains development-only.

**Commit:** `style(auth): implement approved visitor profile`

---

### Task 19: Enforce resilient states screen-by-screen

**Objective:** Ensure no screen regresses to destructive loading/error behavior.

**Files likely to modify:**
- `apps/mobile/src/home/HomeScreen.tsx`
- `apps/mobile/src/catalogue/ExploreScreen.tsx`
- `apps/mobile/src/library/LibraryScreen.tsx`
- `apps/mobile/src/profile/ProfileScreen.tsx`
- `apps/mobile/src/journal/JournalScreen.tsx`
- `apps/mobile/src/notifications/NotificationsScreen.tsx`
- `apps/mobile/src/watchlists/PersonalWatchlistScreen.tsx`
- `apps/mobile/src/watchlists/SharedWatchlistScreen.tsx`
- `apps/mobile/src/catalogue/FilmDetailScreen.tsx`
- `apps/mobile/src/catalogue/SeriesDetailScreen.tsx`

**Checklist per screen:**

1. First loading without cache.
2. Successful non-empty.
3. Successful empty.
4. Refresh with visible cache.
5. Refresh failure with visible cache.
6. First-load failure without cache.
7. Signed-out state when auth is required.
8. Retry action.
9. Accessibility announcement for status changes.

Add missing pure QA cases; do not use fragile screenshot snapshot tests as the only proof.

**Commit:** `fix(mobile): preserve cached content across failures`

---

### Task 20: Final integration, accessibility, and visual parity gate

**Objective:** Prove the implementation matches approved artifacts and existing security constraints.

**Files:**
- Modify: `apps/api/src/dev/prepare-ui-review-data.ts` only if new notifications/vote lifecycle need seed data.
- Create output: `screenshots/redesign-implementation/`
- Update documentation: `README.md` or existing developer setup document with review-emulator launch steps.

**Automated verification:**

```bash
pnpm run check
pnpm --filter api build
pnpm --filter api security:shared-watchlist-smoke
pnpm --filter api security:notifications-smoke
pnpm --filter api security:privacy-smoke
pnpm --filter api security:onboarding-smoke
```

Expected: all exit 0.

**Simulator verification with `Watchly UI Review`:**

- Home personalized and signed-out.
- Explore Trending, Announced, search, no-results, cached failure.
- Film and series details.
- Half-star rating (including 4.5), review create/edit/delete.
- Episode mark watched, undo, rate, review.
- Library non-empty, empty, loading-with-cache, offline-with-cache.
- Personal and shared lists.
- Shared vote create/vote/remove/close/tie.
- Alerts list, filters, mark one/all read, deep links.
- Profile, Journal, public profile, settings.
- Signed-out Profile with all five providers visible.
- Explicit sign-out does not immediately auto-sign-in.

**Accessibility gate:**

- Dynamic Type at default and one larger setting.
- VoiceOver labels for stars, tab items, list selection, vote state, read/unread state.
- 44pt minimum targets.
- Contrast for raspberry text/icons on dark surfaces.
- Reduced Motion: sheet/tab transitions remain usable.

**Visual evidence:** Capture the same 15 numbered states as the approved wireframes into `screenshots/redesign-implementation/`, then compare side-by-side. Do not claim parity without opening every capture.

**Final review:** Run the requesting-code-review skill, fix all reproduced Critical/High findings, rerun every gate, and only then prepare the PR.

**Commit:** `test(mobile): verify Watchly redesign end to end`

---

## 5. Planned commit sequence

1. `test(auth): add isolated local review account`
2. `docs(design): add approved Watchly redesign`
3. `style(mobile): lock Watchly redesign tokens`
4. `refactor(navigation): replace custom pager with bottom tabs`
5. `feat(cache): add persisted stale-while-revalidate resources`
6. `feat(ui): add cinematic Watchly primitives`
7. `feat(home): add cinematic personalized home`
8. `feat(explore): implement cinematic discovery layout`
9. `feat(library): rebuild My TV as resilient Library`
10. `feat(profile): separate public profile from private Journal`
11. `feat(catalogue): implement cinematic detail screens`
12. `feat(opinions): unify rating and review interaction`
13. `refactor(episodes): unify season progress and episode rows`
14. `feat(watchlists): implement cinematic multi-list sheet`
15. `feat(api): generalize Watchly notifications`
16. `feat(notifications): add resilient alert inbox`
17. `feat(voting): add shared vote lifecycle`
18. `feat(voting): implement collaborative vote screen`
19. `style(auth): implement approved visitor profile`
20. `fix(mobile): preserve cached content across failures`
21. `test(mobile): verify Watchly redesign end to end`

## 6. Main risks and mitigations

- **Dirty baseline mixes security and UI changes:** isolate Task 1 commits before any redesign work.
- **Navigation rewrite breaks state retention:** migrate routes before screens; verify every stack destination immediately.
- **Persistent private cache leaks between users:** namespace by user ID and clear private keys on sign-out; add QA.
- **Notification migration loses release history:** use explicit SQL rename/alter migration and a data-preservation smoke.
- **Vote alerts spam users:** upsert one notification per user/session and update its leader summary.
- **Large MyTv/Profile refactors hide behavior regressions:** extract and test pure data functions before replacing UI.
- **TMDB partial outage empties the app:** retain cached catalogue and per-section partial success.
- **Half-star accessibility is ambiguous:** expose exact `x/5` labels and left/right-half tap semantics.
- **Wireframe copy becomes accidental localization scope:** keep current English product copy while matching approved structure/visuals.
- **Unwired providers appear functional:** keep them visible but return explicit setup status, never fake sign-in.

## 7. Definition of done

The redesign is done only when:

- all 20 implementation tasks are complete in ordered, reviewable commits;
- root checks, API build, privacy, auth, notifications, and shared-vote smoke tests pass;
- the review account reaches and exercises every authenticated screen;
- signed-out and empty states are also captured;
- cached content demonstrably survives a forced API/TMDB failure;
- no gold rating color, custom tab pager, duplicate episode list, or destructive refresh clearing remains;
- all five auth providers remain visible;
- final simulator captures have been visually inspected against V1–V4 references;
- no Critical/High review findings remain.