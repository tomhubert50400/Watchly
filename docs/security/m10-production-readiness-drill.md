# M10 Production Readiness Drill

M10 records the production-readiness checks that can be proven from this repo, plus the external cloud work that must be completed before launch.

## M10.0 Environment And Secrets Checklist

Run:

```powershell
pnpm --filter api security:env-secrets
```

This verifies:

- `apps/api/.env.example` documents the expected production API variables.
- `AppModule` validates the expected API variables at startup.
- `apps/mobile/.env.example` contains only public Expo variables.
- The mobile app does not reference backend-only values such as `DATABASE_URL`, `TMDB_ACCESS_TOKEN`, or `FIREBASE_AUTH_EMULATOR_HOST`.

Before production launch:

- Store `DATABASE_URL`, `TMDB_ACCESS_TOKEN`, Firebase server config, and any future backend secrets in Secret Manager or the deployment secret store.
- Keep mobile config limited to `EXPO_PUBLIC_*` values that are safe to ship in the app bundle.
- Set `NODE_ENV=production`.
- Set `CORS_ORIGIN` to the deployed mobile/web origin that is allowed to call the API.
- Set rate limits intentionally for production traffic.

## M10.1 Cloud SQL Restore Drill

Status: blocked until a real Google Cloud project and Cloud SQL PostgreSQL instance exist.

When the Cloud SQL environment exists:

1. Confirm automated backups and PITR are enabled on the primary instance.
2. Restore the selected backup or PITR timestamp into a non-production Cloud SQL target.
3. Point `DATABASE_URL` to the restored target.
4. Run:

```powershell
pnpm --filter api db:deploy
pnpm --filter api db:verify
pnpm --filter api security:backup-readiness
```

5. Record restore date, source instance, restore target, backup or PITR timestamp, commands, and results.
6. Delete the restore target only after evidence is recorded.

## M10.2 Deployment Smoke Checklist

Run against local API, staging, or production:

```powershell
$env:DEPLOYMENT_API_URL="http://localhost:3000"
$env:DEPLOYMENT_CORS_ORIGIN="http://localhost:8081"
$env:RATE_LIMIT_PROBE_REQUESTS="6"
pnpm --filter api security:deployment-smoke
```

For production, use the deployed API URL and expected CORS origin. The smoke check verifies:

- `GET /health` returns `status: ok`.
- `GET /auth/me` without a token returns 401.
- CORS preflight allows the configured origin.
- Rate limiting returns 429 within the configured probe count.

## M10.3 Production Readiness Gate

Ready from the repo baseline:

- API environment validation exists for required backend configuration.
- Backend-only secrets are documented separately from public mobile config.
- Protected auth behavior, CORS, rate limiting, health, schema verification, and backup-critical table checks are repeatable commands.
- Android emulator validation remains the local mobile readiness check.

Not production-ready until external setup is completed:

- Real Cloud SQL restore drill against a non-production target.
- Cloud Run or equivalent deployment smoke using the deployed API URL.
- Production secret storage and rotation policy evidence.
- Production backup retention, PITR window, and restore evidence.
