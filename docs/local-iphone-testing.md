# Local iPhone Testing Runbook

Use this when you want to test Watchly on a physical iPhone from the local Windows workspace.

The phone uses one development app and one account environment:

- installed app: `Watchly Staging`
- bundle identifier: `com.tom.tvapp.staging`
- Firebase and API: EAS Preview staging

Do not install or launch the production `Watchly` app for routine development. Production remains a separate release-validation target.

## What Runs Where

- Metro/Expo runs on the PC at port `8081`.
- Firebase and the API use the deployed staging environment loaded from EAS Preview.
- The iPhone connects to the PC through the local Wi-Fi IP.

## Fast Path

From the repo root:

```powershell
cd C:\Users\t\Desktop\Projects\tv-app
powershell -ExecutionPolicy Bypass -File .\scripts\start-iphone-staging-auth.ps1
```

The script will:

- load the EAS Preview staging variables
- force `APP_VARIANT=staging` and `EXPO_PUBLIC_APP_ENV=staging`
- validate the `Watchly Staging` manifest and OAuth configuration
- run Metro in development-client mode for the installed staging app

This local loop reuses the installed Watchly binary and never runs EAS Build.

The legacy command remains as a compatibility alias and launches the exact same staging environment:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-iphone-dev.ps1
```

## Manual Path

From the repo root, load the staging variables before starting Metro. Prefer the launcher above because it also validates the environment pairing.

```powershell
cd C:\Users\t\Desktop\Projects\tv-app
powershell -ExecutionPolicy Bypass -File .\scripts\start-iphone-staging-auth.ps1
```

Keep this terminal open.

### Open On iPhone

- Put the iPhone on the same Wi-Fi as the PC.
- Scan the QR code with the iPhone Camera so it opens the installed `Watchly Staging` app.
- Use the development-client URL shown by Expo or printed by the launcher.

Reuse the installed Watchly development build for JavaScript, TypeScript, UI, API, and bundled asset changes. Create a new EAS build only after a native dependency, Expo plugin, native app configuration, Expo SDK, or React Native version changes.

## Functional Test Checklist

Use the relevant part for the feature you changed.

- Feed loads without API error.
- Profile loads signed-out or signed-in state correctly.
- Google sign-in works.
- After sign-in, Profile shows the current user.
- Explore can search a title, for example `matrix`.
- Film detail opens from Explore.
- Series detail opens from Explore.
- Season and episode detail open from a series.
- Tracking actions save and reload.
- Ratings save, reload, and clear.
- Reviews save, reload, and delete.
- My TV reflects tracked titles, ratings, progress, personal lists, and shared lists.
- Shared watchlist item controls work.
- Voting session creation and vote toggling work.
- Onboarding appears only for users with `onboardingCompleted=false`.
- Settings saves profile and privacy changes.

## What To Send Codex When Something Fails

Do not start with giant logs. Send:

- the screen name
- the action you did
- the visible error message
- whether the API health URL works from the PC
- a screenshot if the UI looks wrong

Only use broad logs after a specific runtime bug is confirmed.
