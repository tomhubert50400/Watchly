# Supervisor QA — Cinematic Library Council Synthesis

Branch: `design/cinematic-library`

## Verdict

The three agents converged strongly. The redesign should proceed, but **not as one giant rewrite**. The safe path is phased and foundation-first.

Approved direction:
- **Letterboxd** for cinephile product DNA.
- **Linear** for dark precision, subtle surfaces, borders, hierarchy.
- **Apple TV+ / Runway** for cinematic media detail surfaces.
- **Spotify** for fast tactile media navigation, chips, rails, library ergonomics.

Rejected / deferred:
- No broad API/Prisma/backend changes.
- No subjective decorative redesign without UX purpose.
- No full navigation architecture rewrite until base components are stable.
- No massive dedupe/refactor in the same batch as visual redesign.

## Implementation phases

### Phase 1 — Design-system foundation

Goal: premiumize the app globally without changing flows.

Files allowed:
- `apps/mobile/src/design/tokens.ts`
- `apps/mobile/src/components/Button.tsx`
- `apps/mobile/src/components/IconButton.tsx`
- `apps/mobile/src/components/TextInput.tsx`
- `apps/mobile/src/components/SegmentedControl.tsx`
- `apps/mobile/src/components/EmptyState.tsx`
- `apps/mobile/src/notifications/ToastContext.tsx`

Optional new files:
- `apps/mobile/src/components/Card.tsx`
- `apps/mobile/src/components/Chip.tsx`
- `apps/mobile/src/components/LoadingState.tsx`
- `apps/mobile/src/components/MediaPoster.tsx`

Rules:
- Keep current DA and rose accent lineage, but reduce full rose fills.
- Add richer tokens: surface hierarchy, translucent borders, touch targets, rating color, text tiers, radii, shadows.
- Ensure icon buttons are at least 44x44.
- Keep public component APIs backward compatible unless call sites are updated.
- Run `npx -y pnpm@10.28.2 check`.

### Phase 2 — Media primitives applied to Explore + shared metadata

Goal: replace dashboard-like media rows with premium reusable media components.

Files likely:
- `apps/mobile/src/catalogue/ExploreScreen.tsx`
- `apps/mobile/src/catalogue/HeaderInfoPills.tsx`
- `apps/mobile/src/catalogue/SynopsisPanel.tsx`
- `apps/mobile/src/catalogue/StreamingAvailabilityPanel.tsx`

Rules:
- Use `MediaPoster`, `Chip`, `Card`/surface primitives where appropriate.
- Search results stay scan-friendly.
- Announced items get clear notify affordance.
- No API changes.

### Phase 3 — Cinematic detail shell

Goal: film/series/episode detail screens become Apple TV+/Letterboxd-like.

Files likely:
- `apps/mobile/src/catalogue/FilmDetailScreen.tsx`
- `apps/mobile/src/catalogue/SeriesDetailScreen.tsx`
- `apps/mobile/src/catalogue/EpisodeDetailScreen.tsx`
- `apps/mobile/src/tracking/TrackingControls.tsx`
- `apps/mobile/src/watchlists/AddToWatchlistControl.tsx`
- `apps/mobile/src/notifications/ReleaseAlertControl.tsx`

Rules:
- Use `backdropUrl` for film/series hero where available.
- Poster remains important; backdrop is emotional context, not a replacement.
- Group watchlist/tracking/bell/rating actions near hero.
- Hide purely technical identifiers from premium UI unless needed for debugging.

### Phase 4 — Library-first My TV + watchlists

Goal: turn My TV from feature dashboard into personal media library.

Files likely:
- `apps/mobile/src/tracking/MyTvScreen.tsx`
- `apps/mobile/App.tsx`
- `apps/mobile/src/navigation/types.ts`
- `apps/mobile/src/watchlists/PersonalWatchlistScreen.tsx`
- `apps/mobile/src/watchlists/SharedWatchlistScreen.tsx`

Rules:
- Library should surface continue watching, watchlist, ratings/reviews, release alerts.
- Do not rename files broadly unless the UI changes are stable.
- Avoid big data-shape rewrites.

### Phase 5 — Feed/profile/onboarding polish

Goal: final social and onboarding polish.

Files likely:
- `apps/mobile/src/feed/FeedScreen.tsx`
- `apps/mobile/src/profile/ProfileScreen.tsx`
- `apps/mobile/src/profile/ProfileSummaryCard.tsx`
- `apps/mobile/src/onboarding/OnboardingScreen.tsx`

## Validation gates

After each phase:
1. `npx -y pnpm@10.28.2 check`
2. `git diff --stat`
3. inspect changed UI files for hardcoded token drift
4. commit with focused message if green

## Current next action

Start with **Phase 1 only**. This is the safest foundation and gives visible premium uplift while limiting risk.
