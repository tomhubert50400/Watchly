# Watchly staging environment

This document defines the repository contract that keeps local development, staging, and production configuration separate. The Railway API and PostgreSQL services, staging Firebase project, EAS preview variables, uptime monitor, and error tracking applications are provisioned.

## Environment contract

| Target | API `APP_ENV` | API `NODE_ENV` | EAS profile | EAS environment | Mobile app ID |
| --- | --- | --- | --- | --- | --- |
| Local development | `development` | `development` | `development` | `development` | `com.tom.tvapp.dev` |
| Staging | `staging` | `production` | `staging` | `preview` | `com.tom.tvapp.staging` |
| Production | `production` | `production` | `production` | `production` | Set with `WATCHLY_PRODUCTION_APPLICATION_ID` |

The standard EAS `preview` environment backs the Watchly staging profile. This avoids requiring an EAS plan with custom environments.

## Staging mobile variables

Configure these values in the EAS `preview` environment:

- `EXPO_PUBLIC_API_URL`, the HTTPS staging API URL.
- `EXPO_PUBLIC_ERROR_TRACKING_DSN`, the Better Stack mobile ingestion DSN.
- `EXPO_PUBLIC_FIREBASE_API_KEY`.
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`.
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`.
- `EXPO_PUBLIC_FIREBASE_APP_ID`.
- The platform Google client IDs when staging OAuth is ready.
- `EXPO_PUBLIC_MICROSOFT_CLIENT_ID` when Microsoft OAuth is ready.
- `EXPO_PUBLIC_DISCORD_APPLICATION_ID` when Discord OAuth is ready.

Production must use a dedicated Discord application ID. The build fails instead of reusing the
staging Discord callback when `EXPO_PUBLIC_DISCORD_APPLICATION_ID` is absent.

`APP_VARIANT` and `EXPO_PUBLIC_APP_ENV` are fixed by `eas.json`. A staging or production bundle fails during startup if the API URL is local, not HTTPS, or if the core Firebase configuration is absent. Development emulator credentials are also rejected outside development.

Every mobile API request sends `X-Watchly-Environment`. The API rejects a missing or mismatched environment before the request reaches an application controller. This prevents a staging client that was accidentally given the production URL from reading or writing through the production API. Health checks and CORS preflight remain available without the header.

Build the internal staging app with:

```powershell
eas build --profile staging --platform ios
```

For physical-iPhone testing against local Metro, build the dedicated staging development client:

```powershell
eas build --profile staging-development --platform ios
```

The development client uses the same staging application ID and EAS `preview` variables, but keeps iOS local-network access so it can load the current JavaScript bundle from Metro. Installing it replaces the standalone staging app on the device until that standalone build is installed again.

Before a provider test session, validate the manifest and deployed provider readiness with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-iphone-staging-auth.ps1 -ValidateOnly -CheckProviders
```

This smoke uses invalid, non-user credentials to confirm that Google and Apple are enabled in Firebase and that Microsoft and Discord are configured and reachable. It does not prove a successful provider login; the final gate remains a real return to Watchly on the registered iPhone.

## Staging API variables

The dedicated API service and database use `APP_ENV=staging` with `NODE_ENV=production`. The health response exposes `environment: staging`, which lets deployment smoke tests detect a wrong target. `ERROR_TRACKING_DSN` and `MONITORING_TEST_KEY` are sealed Railway variables. The API refuses to boot in staging if either is absent.

Set `DEPLOYMENT_APP_ENV=staging` when running `security:deployment-smoke` against staging. The smoke check verifies the health environment and sends the same value with protected-route probes.

Never reuse the production database URL, Firebase project, R2 bucket credentials, or backend secrets in staging.

## Current staging state

- Railway Hobby is the selected API and PostgreSQL provider. The workspace compute alert is set to 7 USD and its hard limit to 10 USD.
- Railway staging services and secret storage are isolated from local development.
- The staging Firebase project and EAS `preview` environment are configured.
- Better Stack monitors `/health` every three minutes and receives API and mobile exceptions.
- The remaining native proof is to build and install the staging client, then prove on a physical device that it reaches only the staging API and reports a controlled mobile exception.

## Railway deployment contract

`railway.json` builds only the API package, applies Prisma migrations as a pre-deploy command, starts the compiled NestJS service, and requires `/health` to pass before a deployment becomes active. The service must deploy from a committed Git revision so local environment files and unfinished worktree changes cannot enter a staging build.

Operational monitoring, alert checks, rollback, and database recovery are documented in `docs/staging-monitoring.md`.
