# Local Prisma Recovery

Use this when the mobile app shows server errors on protected screens such as Feed, My TV, watchlists, tracking, or notifications while `GET /health` still works.

## Symptoms

- Mobile shows `Something went wrong on the server` or `Could not reach the API`.
- API logs show Prisma errors such as `Server has closed the connection`, `ConnectionClosed`, or `P1017`.
- `pnpm exec prisma dev ls` may still show `tv-app` as `running`.
- `GET /health` can still return `200`, because it does not prove the database connection works.

## Recovery

Run Prisma commands from `apps/api`, because Prisma is installed in that package.

```powershell
cd C:\Users\t\Desktop\Projects\tv-app\apps\api
pnpm exec prisma dev ls
$previousApiPort = $env:PORT
try {
  $env:PORT = '51213'
  pnpm exec prisma dev start tv-app
} finally {
  $env:PORT = $previousApiPort
}
pnpm exec prisma dev ls
```

If the TCP URL changed, copy the `TCP` URL into `apps/api/.env` as `DATABASE_URL`.

The Prisma HTTP port must differ from the API's `PORT=3000`. Prisma dev inherits `PORT`
from the API's `.env`, even when restarting a saved server. Set it only for the Prisma
command as above, then restore it before launching the API. To configure explicit TCP ports:

```powershell
pnpm exec prisma dev stop tv-app
$previousApiPort = $env:PORT
try {
  $env:PORT = '51213'
  pnpm exec prisma dev --name tv-app --port 51213 --db-port 51221 --shadow-db-port 51215 --detach
} finally {
  $env:PORT = $previousApiPort
}
```

Keep the existing database name to preserve its data. Use the configured TCP and shadow
ports if they differ from the example, and check the resulting URLs before restarting the API.

For the local Prisma dev/PGlite database, set `DATABASE_POOL_MAX=1` in `apps/api/.env`.
Concurrent connections on the local socket server can produce mixed query results,
`portal "" does not exist`, or connection resets. A single connection queues concurrent
API queries through the existing pool. Regular PostgreSQL keeps the default pool size of 10.
Avoid running another API or database smoke test against this local database at the same
time as the API. Stop the API before running the database checks below, then restart it.

Then restart the API from the repo root:

```powershell
cd C:\Users\t\Desktop\Projects\tv-app
pnpm --filter api db:deploy
pnpm --filter api db:verify
pnpm --filter api run security:prisma-reset-smoke
pnpm --filter api start:dev
```

For Android emulator testing, keep the local ports reachable:

```powershell
adb reverse tcp:3000 tcp:3000
adb reverse tcp:8081 tcp:8081
```

## Validation

These checks must pass before blaming a UI feature:

```powershell
pnpm --filter api db:verify
pnpm --filter api run security:prisma-reset-smoke
pnpm run check
Invoke-RestMethod http://localhost:3000/health
```

`GET /feed` without a token should return `401`, not `500`.
