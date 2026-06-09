Project guidance for the mobile app currently referred to as the TV/movie tracking app.
This file is a living project memory. Update it only when Tom validates a product, architecture, security, or business decision.
Working Method
Move in small validated blocks.
For each step, explain how Tom can validate the result before moving on.
Do not jump ahead into implementation before the current block is agreed.
Execution should be milestone-based and page-by-page.
Do not move to the next page until the current page has its UI, backend/API contract, key states, privacy rules, and verification handled.
Surface assumptions before making recommendations.
Prefer simple MVP decisions over speculative future features.
Keep architecture, security, cost, and monetization visible from the start.
When a decision is validated, add it to this file.
When a question is still unresolved, keep it in Open Questions.
Current Product Idea
Build a mobile app for tracking, rating, reviewing, and organizing films and TV shows.
The broad direction includes:
Rating films, shows, seasons, or individual episodes.
Writing reviews.
Tracking watched, watching, watchlisted, dropped, or favorite content.
Creating personal and shared watchlists.
Voting inside shared watchlists to choose what to watch together.
Showing reviews and ratings on user profiles.
Recommending films and shows based on user taste.
Notifying users when unreleased or followed content becomes available.
Showing where a film or show is available to stream.
Validated Decisions
The app name is not decided yet.
The name should be postponed until the product direction is clearer.
Planning should happen block by block instead of defining everything at once.
This AGENTS.md will be updated progressively as decisions are validated.
Shared watchlists must be part of V1.
Shared watchlists in V1 should include voting sessions, for example "tonight" with selected films or shows and member votes.
V1 should start with a complete TV Time-style direction for episodes, including episode-level tracking, ratings, and reviews.
Follow should be included in V1 with a minimal activity feed.
The V1 feed should not show standalone ratings such as "user rated this film 5/5".
The V1 feed can show a rating when it is attached to a written review.
Comments should be postponed to V2.
Profiles should be public by default in V1.
Viewing history and episode-by-episode progress should be private by default.
Written reviews should be public by default, but users must be able to make them private.
Standalone ratings should be private by default.
Shared watchlists and their votes should be visible only to their members by default.
V1 settings must include a privacy area where users can manage these privacy rules independently from each other.
User blocking should be included as a minimum V1 safety feature.
V1 main navigation should include Home/Feed, Search/Discover, Watchlists, and Profile.
Settings should not be a main navigation tab in V1.
Settings should be accessed from an icon on the Profile screen.
V1 detail screens should include film, series, season, and episode pages.
V1 should include simple notifications for followed content releases, new seasons, and new episodes.
V1 should include simple streaming availability: show which platforms a film or show is available on by country.
V1 streaming availability does not need subscription prices, rental prices, user subscription management, or deep links.
Streaming deeplinks are preferred if the provider supports reliable platform links, but V1 can fall back to displaying platforms without deeplinks.
Working Product Positioning
Not yet validated.
Candidate direction:
An app to track films and series, rate what you watch, and decide what to watch alone or with others.
Architecture Decisions
V1 mobile app should be built with Expo, React Native, and TypeScript.
V1 should use a separate backend instead of putting critical business logic only in the mobile app.
Fully native iOS/Android development is excluded for V1 unless a blocking need is discovered later.
The recommended V1 backend direction is a custom NestJS API hosted on Google Cloud.
The V1 managed cloud stack should use Cloud Run for the API, Cloud SQL PostgreSQL for the database, Google Identity Platform or Firebase Auth for authentication only, Memorystore Redis if cache/jobs need it, Cloud Storage for files, Secret Manager for secrets, and Google Cloud audit/security tooling.
The mobile app must not access the database directly.
Sensitive privacy, feed, follow, voting, review, blocking, and notification rules must be enforced by the backend API.
M0 should use a simple monorepo containing the mobile app and backend API.
M0 mobile should use Expo, React Native, and TypeScript.
M0 backend should use NestJS and TypeScript.
M0 database access should use Prisma with PostgreSQL.
M0 auth should use Firebase Auth or Google Identity Platform as an OAuth-only identity provider.
Security Decisions
Authentication should use Google Identity Platform or Firebase Auth only as the identity provider.
V1 authentication should be OAuth-only.
V1 auth providers should be Google, Apple, and Microsoft.
Email/password authentication should not be included in V1.
Magic link authentication should not be included in V1.
All protected backend requests must verify auth tokens server-side.
The backend must map the external auth identity to an internal user record.
No backend secrets should be present in the mobile app.
All user data reads and writes must go through the NestJS backend API, never direct mobile access to Cloud SQL.
Privacy and authorization rules must be enforced by the backend, not only by the UI.
Backend authorization must account for owner, public profile visibility, follow relationships, shared watchlist membership, and blocking.
The TMDB API key must stay backend-side.
The mobile app should not call TMDB directly with a secret key.
The backend should use minimal TMDB caching to reduce cost and abuse.
TMDB attribution must be visible in the app.
V1 must include rate limiting for sensitive actions such as auth flows, review creation, follow/unfollow, TMDB search proxy, voting, watchlist invitations, and avatar uploads.
Technical logs should avoid unnecessary sensitive content.
Tokens, API keys, complete auth payloads, and avoidable raw emails should not be logged.
Audit logs should cover sensitive actions such as privacy changes, account deletion, blocking, and watchlist invitations.
Cloud SQL automated backups are required.
Backup restoration should be tested regularly.
All secrets must be stored in Secret Manager.
Secret rotation should be possible.
Environment variables should be separated by environment.
Secrets must not be committed to Git or shipped in the mobile app.
HTTPS is mandatory.
Any future web or admin surface should use strict CORS.
Application-level field encryption is not required in V1 unless a specific blocking need is discovered.
Data And Storage Decisions
Do not store the full catalogue locally.
Store user data, provider IDs, minimal metadata, a cache of viewed or added content, and a temporary cache for streaming availability.
The V1 backend data model should cover users, cached external content, user content states, ratings, reviews, follows, watchlists, shared watchlist members, voting sessions, votes, notifications, and blocks.
The V1 feed should stay simple and be generated from public reviews by followed users instead of starting with a dedicated activity events table.
V1 voting sessions should use simple voting instead of advanced ranking.
Ratings and reviews should be separate concepts, with an optional rating attachable to a written review.
Cached content should stay minimal and provider-based, especially TMDB IDs and selected metadata, instead of storing a full local catalogue.
Provider Direction
TMDB is the recommended V1 provider candidate for catalogue data, posters, metadata, simple watch providers, upcoming movies, airing shows, seasons, episodes, and air dates.
TMDB has official watch provider endpoints for movies and TV shows, but direct platform deeplinks still need verification before being validated as V1 scope.
TMDB looks acceptable for a non-commercial prototype or MVP with attribution, but commercial usage and licensing must be clarified before any monetized launch.
Monetization Decisions
The core product should remain free: tracking, ratings, reviews, personal watchlist, simple streaming availability, and a limited number of shared watchlists.
Potential premium features include unlimited shared watchlists, group votes, group recommendations, advanced stats, advanced alerts, advanced filters, custom profiles, data export/import, and a watch party decision mode.
MVP Scope
V1 should include auth, public profiles, independent privacy settings, user blocking, TMDB search, film/series/season/episode detail pages, tracking, statuses, ratings, written reviews, follow, a minimal feed based on public reviews by followed users, personal watchlists, shared watchlists, voting sessions, simple streaming availability by country, simple release notifications, the validated Google Cloud NestJS backend, and the validated V1 security rules.
Comments are excluded from V1 and should be postponed to post-V1 or V2.
Streaming deeplinks are not mandatory for V1, but should be included if a reliable provider path is confirmed.
Post-V1 improvements can include comments, richer feed, advanced history, advanced list filters, better notifications, streaming deeplinks if missing from V1, simple stats improvements, more voting modes, reporting, and minimum moderation.
V2 can include personalized recommendations, group recommendations, a complete watch party mode, advanced stats, import/export, custom profiles, premium subscriptions, user streaming subscription management, advanced comments, admin/moderation tooling, advanced group vote ranking, and a possible web or admin surface.
Execution Milestones
M0 Foundation: setup app, backend, auth, design base, environments, and baseline security.
M0 Foundation must include monorepo setup, Expo app setup, NestJS API setup, Prisma setup, initial PostgreSQL connection, environment config, auth foundation, a backend healthcheck, mobile navigation shell, profile settings entry point, API client foundation, baseline design tokens/components, and baseline security checks.
M0 Foundation should only create the minimum initial database schema needed for users, auth identity mapping, and privacy settings.
M0 Foundation should not create all V1 product tables upfront.
M0 should use pnpm for workspace/package management.
M0.1 Repo: create the monorepo structure, configure pnpm workspace scripts, and verify install/scripts work.
M0.2 Mobile Shell: create the Expo TypeScript app, add Home/Feed, Search/Discover, Watchlists, and Profile tabs, add the Settings icon entry from Profile, and verify navigation.
M0.3 API Shell: create the NestJS API, add GET /health, environment config, env validation, baseline logging, and verify API startup plus healthcheck.
M0.4 Mobile API Client: add a centralized mobile HTTP client, environment-based API URL, healthcheck call, loading state, error state, and verify mobile-to-API communication.
M0.5 Database Foundation: add Prisma, connect PostgreSQL for dev, create migrations, and add only users, auth identity mapping, and privacy settings.
M0.6 Auth Foundation: configure Firebase Auth or Google Identity Platform for OAuth-only Google, Apple, and Microsoft, disable email/password and magic link, verify backend token checks, and create or find the internal user.
M0.7 Design Base: add baseline design tokens and simple reusable Screen, Button, IconButton, TextInput, and EmptyState components.
M0.8 Security Baseline: keep secrets backend-only, separate environments, add lightweight API rate limiting, input validation, safe logs, protected route checks, and avoid logging tokens or secrets.
M0.9 Final Validation: run mobile, run API, verify navigation, verify Settings entry, verify mobile healthcheck to API, verify DB connection, verify protected route behavior, run available lint/tests, and document commands.
M1 Catalogue: Search/Discover plus film, series, season, and episode detail pages.
M2 Tracking: statuses, ratings, reviews, and episode progress.
M3 Profile And Privacy: profile, privacy settings, and blocking.
M4 Social Feed: follow and minimal activity feed.
M5 Watchlists: personal watchlists, shared watchlists, and voting sessions.
M6 Streaming And Notifications: streaming availability and release notifications.
M7 Polish And Security QA: tests, rate limits, audit logs, backups, and privacy review.
Open Questions
Is the app primarily personal, social, or collaborative?
Should TMDB be officially validated as the V1 catalogue and streaming availability provider?
Can TMDB or another provider supply reliable streaming deeplinks to actual platform pages?
What monetization model should be planned for first: subscription, freemium, ads, or another model?
Next Decision To Validate
Detail M0 Foundation before writing code.
