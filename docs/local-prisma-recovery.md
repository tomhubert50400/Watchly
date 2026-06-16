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
pnpm exec prisma dev start tv-app
pnpm exec prisma dev ls
```

If the TCP URL changed, copy the `TCP` URL into `apps/api/.env` as `DATABASE_URL`.

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
