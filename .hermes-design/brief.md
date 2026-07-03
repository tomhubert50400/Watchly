# Cinematic Library Redesign Brief

Branch: `design/cinematic-library`

## Product direction

Refactor the mobile front-end into a premium dark media app while preserving the current visual DNA.

Core inspiration blend:

- **Letterboxd**: cinephile product DNA, posters, reviews, ratings, watchlists, social/media tracking.
- **Linear**: dark-mode-native precision, subtle surfaces, refined hierarchy, disciplined spacing, thin translucent borders.
- **Apple TV+**: immersive movie/series detail pages, cinematic headers, minimal chrome around content.
- **Spotify**: fast tactile media navigation, scan-friendly lists, filters/pills, library ergonomics.

Working name: **Cinematic Library**.

## Non-negotiables

- Keep the product identity: TV/cinema tracker, not a generic SaaS dashboard.
- Keep dark theme as the primary mode.
- Preserve the existing ruby/rose accent lineage, but use it more sparingly and more premium.
- Posters/backdrops should become the main source of color and emotion.
- Avoid subjective redesign churn that is not tied to UX, consistency, accessibility, or clear visual upgrade.
- Do not touch API, Prisma schema, migrations, secrets, deployment, or production config unless absolutely required for frontend typecheck.
- Prefer reusable design tokens/components over one-off screen hacks.
- Every implementation batch must pass `npx -y pnpm@10.28.2 check` or document a blocker.

## Current app context

Repo: `/Users/tomhubert/tv-app`

Mobile app: `apps/mobile`

Current tokens: `apps/mobile/src/design/tokens.ts`

Current traits:
- dark background `#10131C`
- rose accent `#E11D48`
- secondary violet `#6D6AF7`
- hard 8px radius system
- cards/panels in `#141720`, `#1B1F2A`, `#111C24`
- screenshots exist in `/Users/tomhubert/tv-app/screenshots`

## Target UX principles

1. **Immediate comprehension**: each screen makes the next best action obvious.
2. **Media-first hierarchy**: posters/backdrops, title, metadata, availability, tracking state, reviews/actions.
3. **Low-friction tracking**: rating/progress/watchlist actions should be thumb-friendly and state-obvious.
4. **Premium restraint**: fewer loud accents, more luminance hierarchy and spacing discipline.
5. **Reusable states**: loading, empty, error, success, disabled, pressed, selected should be consistent.
6. **Accessibility**: 44px touch targets, readable contrast, accessibility labels for icon actions, reduced motion awareness where relevant.

## Agent council roles

### UX Architect
Audit flows and screen objectives. Deliver a concrete screen-by-screen UX refactor plan with exact files and priorities. Focus on friction, hierarchy, navigation, empty/loading/error states, and action placement.

### UI System Designer
Audit tokens/components. Deliver a concrete design-system proposal for colors, typography, spacing, radii, shadows/elevation, buttons, cards, pills, tabs, inputs, bottom nav. Must map changes to existing files.

### Media Surface Designer
Focus on catalogue/detail/watchlist/feed surfaces. Deliver exact changes for film/series/episode detail, poster cards, availability panels, ratings/progress, lists. Must preserve media identity.

### Supervisor QA
After agents return, synthesize a single implementation plan, reject risky/subjective changes, define phases and validation gates.

## Expected implementation style

- Work in small commits.
- Start with tokens + shared primitives before screen-specific polish.
- Do not try to redesign everything in one giant diff.
- Create screenshots or at least typecheck-driven verification after meaningful UI batches.
