# Watchly Store Release

This file is the source of truth for the first Watchly beta and the future public store listing.

## Application identity

| Field | Value |
| --- | --- |
| Product name | Watchly |
| App Store name | Watchly: Movies & TV |
| Bundle ID / application ID | `com.trywatchly.app` |
| App Store ID | `6808506784` |
| Version | `1.0.0` |
| Default language | English (U.S.) |
| Support URL | `https://trywatchly.com/support` |
| Privacy policy URL | `https://trywatchly.com/privacy` |
| Terms URL | `https://trywatchly.com/terms` |
| Support email | `contact@trywatchly.com` |
| Primary category | Entertainment |
| Secondary category | Social Networking |

## JavaScript updates with EAS Update

`expo-updates` is configured for the next native build. Existing TestFlight builds without this module cannot receive these updates. No update is published as part of local configuration or staging tests.

- Runtime compatibility uses Expo's `fingerprint` policy. Native dependencies or native configuration changes require a new compatible build.
- The `staging` channel uses EAS `preview` variables. The `production` channel uses EAS `production` variables and is inherited by `testflight`.
- Check the target channel, runtime fingerprint and resolved API environment before publishing. Never publish staging variables to production.
- Run the commands below from `apps/mobile` only after the corresponding build is installed and the update is approved for release. The environment flags are required because EAS Update does not inherit a build profile's `env` block.

```powershell
$env:APP_VARIANT = 'staging'
$env:EXPO_PUBLIC_APP_ENV = 'staging'
Remove-Item Env:WATCHLY_DEV_CLIENT -ErrorAction SilentlyContinue
pnpm dlx eas-cli@latest update --channel staging --environment preview --message "Describe the tested change"
```

For production, set both variant flags to `production` and use `--channel production --environment production`. Start from a fresh terminal without local `EXPO_PUBLIC_*` overrides. Test a release build by closing and reopening it to download the update, then closing and reopening it again to apply it. Verify the update on device before expanding distribution.

Local Metro tests use the installed staging development client and do not validate remote update delivery. See [Expo's setup guide](https://docs.expo.dev/eas-update/getting-started/) and [runtime compatibility](https://docs.expo.dev/eas-update/runtime-versions/).

## App Store metadata

**Subtitle**

Track films, series & episodes

**Promotional text**

Remember every film, series and episode you watch. Rate, review, build lists and share discoveries with friends.

**Keywords**

`films,movies,series,tv,episodes,watchlist,journal,ratings,reviews,friends,cinema,tracker`

**Description**

Watchly keeps your whole viewing life in one place.

Find films and series, track every episode, rate what you watch in half-stars and write reviews worth remembering. Your journal keeps a chronological history of your activity, so the things you loved never disappear into another streaming menu.

With Watchly you can:

- Discover trending films, series and upcoming releases.
- Mark films, seasons and individual episodes as watched.
- Rate titles and episodes with precise half-star ratings.
- Write reviews and revisit them in your personal journal.
- Build private watchlists or shared lists with friends.
- Follow other viewers and see what they are watching.
- Receive optional alerts for releases you care about.
- Export or delete your account data from the app.

Watchly is built for people who care about what they watch, not just where it is streaming.

## TestFlight beta information

**Beta description**

Watchly is a social film and series journal. This beta covers discovery, film and episode tracking, ratings, reviews, personal and shared lists, profiles, release alerts, account export and deletion.

**What to test**

Please test sign-in, onboarding, discovery, tracking a film and an episode, rating and reviewing, creating a list, profile and privacy controls, notifications, account export and deletion. Report anything confusing, slow or visually broken through the TestFlight feedback action.

**Feedback email**

`contact@trywatchly.com`

## Store assets

- App icon: `apps/mobile/assets/icon.png`, 1024 x 1024, RGB, no alpha channel.
- iPhone 6.9-inch screenshots: `apps/mobile/store-assets/ios/en-US/01-home.png` and `02-explore.png`, 1290 x 2796, RGB, no alpha channel.
- The screenshots are resized from real 1206 x 2622 Watchly captures. No interface elements were added.

## Release gates

- [x] Production application identifier is fixed in source.
- [x] Production API health, environment isolation, unauthenticated access, CORS and rate limiting pass the deployed smoke test.
- [x] Google, Apple, Microsoft and Discord readiness probes pass against production.
- [x] Public support, privacy and terms pages return HTTPS 200.
- [x] EAS uses remote build numbers and automatic increments.
- [x] Register `com.trywatchly.app` in Firebase and replace the production Firebase iOS app ID and Google iOS client ID.
- [x] Register the App ID and Sign in with Apple capability in Apple Developer.
- [x] Download the generated App Store provisioning profile and connect it to the EAS TestFlight credentials.
- [x] Create the Watchly record in App Store Connect and add its numeric ID to `eas.json`.
- [x] Build and upload the store-signed TestFlight binary, version `1.0.0` build `3`.
- [x] Complete Apple processing and add build `3` to the automatic `Watchly Internal` group with an internal tester.
- [ ] Install and test build `1.0.0` (`3`) on a physical iPhone.
- [ ] Replace the expired Sentry organization token before the public production build.
- [ ] Enable managed database backups and perform a restore drill. Railway Hobby currently has no backups or PITR.
- [ ] Decide whether the first public release supports iPad. If `supportsTablet` stays enabled, provide the required 13-inch iPad screenshots and device validation.
- [ ] Complete Google Play device verification, register the Android Firebase/OAuth application, build an AAB and upload it to the internal track.
