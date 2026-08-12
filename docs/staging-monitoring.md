# Watchly staging monitoring runbook

## Active monitoring

- Railway Observability is the infrastructure and log dashboard for the `staging` environment. Its default dashboard tracks CPU, memory, disk, network, usage, and error logs.
- Better Stack Uptime checks `https://watchly-api-staging.up.railway.app/health` every three minutes from four regions. A valid response must contain `"status":"ok"`.
- Better Stack Errors has separate `Watchly API Staging` and `Watchly Mobile Staging` applications.
- The Better Stack Uptime integration sends e-mail incidents for new error groups, error spikes, and automatically reopened errors across both applications.
- Railway service variables `ERROR_TRACKING_DSN` and `MONITORING_TEST_KEY` are sealed. The mobile DSN is stored as `EXPO_PUBLIC_ERROR_TRACKING_DSN` in the EAS `preview` environment. A DSN is an ingestion endpoint, not an account credential, but it must not be copied into source files.

## Mobile staging source maps

- The staging EAS build uses Sentry's Metro configuration to generate the Hermes bundle and its linked source map. The iOS build log must contain a `Source Map Upload Report` where the script and source map share the same debug ID.
- Better Stack accepts the JavaScript source-map upload but does not accept Sentry's separate native dSYM project upload. Keep `SENTRY_ALLOW_FAILURE=true` in the EAS `preview` environment so that unsupported native upload cannot fail an otherwise valid build. This does not replace checking the JavaScript upload report.
- To prove symbolication, temporarily set a unique `EXPO_PUBLIC_MONITORING_PROBE_ID`, build and open the staging app on a registered iPhone, then confirm that Better Stack resolves the call site to `apps/mobile/src/observability/mobileMonitoringProbe.ts`. Delete the probe variable immediately after the proof and resolve the controlled exception.

Railway Hobby keeps logs for seven days. Use these Log Explorer filters during an incident:

- `@level:error` for exceptions.
- `@event:http.exception` for unhandled API request failures.
- `@event:http.request @httpStatus:500..599` for failed requests.
- `@event:http.request @responseTime>=1000` for requests taking at least one second.
- `@requestId:<value>` to correlate the request summary and exception.

Request logs include `timestamp`, `environment`, `service`, `requestId`, `method`, `path`, `statusCode`, and `durationMs`. Query strings, authorization values, credentials, passwords, and user data are removed before logging or error ingestion.

## Alert verification

Use Better Stack's `Send test alert` action after changing an escalation policy. Confirm that the incident email reaches the Watchly operational mailbox. This tests the complete notification path without making the API unavailable.

To verify API error ingestion, send a `POST` request to `/internal/monitoring/test-error` with `X-Watchly-Environment: staging` and the sealed `X-Watchly-Monitoring-Key`. A successful verification returns HTTP 500 by design. Never place the monitoring key in shell history, source control, screenshots, or tickets. The route returns 404 outside staging and 401 with an invalid key.

After verification:

1. Confirm the error is visible in the `Watchly API Staging` Better Stack application.
2. Confirm Railway has matching `http.exception` and `http.request` events with the same request ID.
3. Resolve the test exception in Better Stack so it does not hide a real regression.

## Deploy and smoke check

1. Run `pnpm check` and `pnpm --filter api build` locally.
2. Commit only the intended files and push the commit to `main`.
3. Railway builds the API, runs `pnpm --filter api db:deploy`, and promotes it only after `/health` passes.
4. Run the deployment smoke check with `DEPLOYMENT_APP_ENV=staging` and the staging API URL.
5. Confirm Better Stack Uptime remains green and Railway has no new `@level:error` events.

## Application rollback

If a deploy breaks the service and no irreversible migration was applied:

1. Open the `watchly-api` deployment history in Railway.
2. Select the last healthy deployment and use `Redeploy`.
3. Wait for the Railway health check and Better Stack Uptime to turn green.
4. Run the deployment smoke check again.

On Hobby, removed deployment images are retained for 72 hours. A redeploy can rebuild an older Git revision after that window. Do not roll application code backward across a destructive database migration. Create a forward fix instead.

## Database backup and recovery

Railway currently restricts native volume backups and point-in-time recovery to the Pro plan. The staging Postgres service therefore has no Railway-managed backup on Hobby.

Until a paid or external automated backup is approved:

1. Before any destructive migration or bulk data operation, open an encrypted Railway tunnel with `railway connect Postgres --tunnel-only`.
2. Run `pg_dump --format=custom` through the tunnel into an encrypted local backup location outside this repository.
3. Record the Git commit, migration name, UTC timestamp, and dump checksum beside the encrypted backup.
4. Restore into a disposable PostgreSQL database with `pg_restore --clean --if-exists`, then run `pnpm --filter api db:verify` against that database.
5. Never overwrite staging directly during a restore drill. Cut over only after verification and an explicit recovery decision.

Production must not launch with this Hobby limitation. Before production, choose one of these controls:

- Railway Pro backups with daily, weekly, and monthly schedules, plus a tested restore.
- An encrypted external `pg_dump` schedule with independent retention and a tested restore.

## Routine

- Daily during beta: check Better Stack Uptime incidents, new API/mobile errors, Railway error logs, and estimated usage.
- Weekly: review slow requests, unresolved exceptions, dependency warnings, and backup freshness.
- Before each beta build: verify the EAS preview variables, deploy smoke check, alert delivery, and mobile error ingestion from the installed staging client.
