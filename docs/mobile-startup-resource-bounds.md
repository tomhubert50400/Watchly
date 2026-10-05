# Mobile startup resource bounds

This change reduces avoidable startup and session resource work. It does not establish the cause of an iOS termination or demonstrate that a native crash is fixed.

## Scope

- Discover loads its resources and warms browse results only while its tab is active. Cached resources are restored when it becomes active again.
- Optional image warming from Discover and the startup preloader shares a three-request budget. Duplicate queued/in-flight URLs share work. Obsolete queued requests are skipped; already-started native requests may finish.
- Discover warms browse collections sequentially, allowing blur, authentication changes, or a mood change to stop scheduling the old selection.
- The startup preloader invalidates later warming when its effect is replaced or unmounted. Its image-warming deadline also stops scheduling remaining optional images.
- Profile progressive hydration stops scheduling queued titles after cleanup.
- Movie and series full details share a 120-entry provider cache. Successful refreshes renew retention; the oldest successful loads are evicted first. The separate shared resource cache remains bounded independently.
- Calendar and vote rows retain only the small presentation fields they need, scoped to the current owner/dataset, so full-detail eviction does not remove already-loaded titles and artwork.

This is not a global memory limit or a limit on every application request. Images rendered by visible components, already-running requests, and other resource loaders remain outside the optional-image queue. Eager primary-tab mounting and the existing launch-readiness behavior are retained.

## Automated checks

Focused QA covers inactive Discover, focus/blur and replacement behavior, shared prefetch concurrency, overlapping consumers, cancellation, error recovery, profile cleanup, and bounded mixed-media detail retention. Run the mobile pretest/test scripts through the repository-pinned toolchain, plus the workspace lint/type checks.

The QA scripts include pure logic tests and mocked React Native components. They do not measure native image decoding, UIKit work, actual device memory, or watchdog behavior.

## Native release verification

Before treating this as a verified iOS remedy:

1. Reproduce on a physical iPhone SE (2nd generation), using a Release build with the affected iOS version.
2. Test cold and warm launches with empty and populated caches, signed out and signed in with a large library.
3. Exercise opening Discover, rapid tab changes, changing mood, leaving during loading, returning, background/foreground, and offline/failing requests.
4. Check calendars and shared votes after more than 120 unique detail loads. Previously displayed title/artwork must remain available through the screen's lightweight presentation data.
5. Inspect first-interactive time, native main-thread activity, allocations/physical footprint, and request concurrency. Compare with the previous build under the same conditions.
6. Obtain the matching iOS crash or JetsamEvent diagnostic when available. Sentry's inferred watchdog event alone does not identify the native termination cause.

Physical-device validation and a newly signed native build are separate from passing TypeScript or JavaScript QA. No dependency upgrade is required for this change.
