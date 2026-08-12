# Watchly staging environment

This is the first P0.1 delivery unit. It defines the repository contract that keeps local development, staging, and production configuration separate. Cloud resources still need to be provisioned before the staging environment is usable.

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
- `EXPO_PUBLIC_FIREBASE_API_KEY`.
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`.
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`.
- `EXPO_PUBLIC_FIREBASE_APP_ID`.
- The platform Google client IDs when staging OAuth is ready.

`APP_VARIANT` and `EXPO_PUBLIC_APP_ENV` are fixed by `eas.json`. A staging or production bundle fails during startup if the API URL is local, not HTTPS, or if the core Firebase configuration is absent. Development emulator credentials are also rejected outside development.

Every mobile API request sends `X-Watchly-Environment`. The API rejects a missing or mismatched environment before the request reaches an application controller. This prevents a staging client that was accidentally given the production URL from reading or writing through the production API. Health checks and CORS preflight remain available without the header.

Build the internal staging app with:

```powershell
eas build --profile staging --platform ios
```

## Staging API variables

Provision a dedicated API service and database, then configure at least the variables documented in `apps/api/.env.example`. Use `APP_ENV=staging` with `NODE_ENV=production`. The health response exposes `environment: staging`, which lets deployment smoke tests detect a wrong target.

Set `DEPLOYMENT_APP_ENV=staging` when running `security:deployment-smoke` against staging. The smoke check verifies the health environment and sends the same value with protected-route probes.

Never reuse the production database URL, Firebase project, R2 bucket credentials, or backend secrets in staging.

## Required external work

- Choose the API and PostgreSQL hosting provider.
- Provision isolated staging services and secret storage.
- Create the staging Firebase project and native application registrations.
- Configure the EAS `preview` variables.
- Deploy the API, run migrations, and execute the deployment smoke check.
- Build and install the staging client, then prove that it reaches only the staging API.
