# Local iPhone Testing Runbook

Use this when you want to test Watchly on a physical iPhone from the local Windows workspace.

## What Runs Where

- Prisma dev PostgreSQL runs on the PC.
- The NestJS API runs on the PC at port `3000`.
- Metro/Expo runs on the PC at port `8081`.
- The iPhone connects to the PC through the local Wi-Fi IP.

Important API URL rules:

- Android emulator uses `http://10.0.2.2:3000`.
- iPhone must use the PC LAN IP, for example `http://172.30.1.44:3000`.
- `localhost` on iPhone means the iPhone itself, so it is wrong for local PC testing.

## Fast Path

From the repo root:

```powershell
cd C:\Users\t\Desktop\Projects\tv-app
powershell -ExecutionPolicy Bypass -File .\scripts\start-iphone-dev.ps1
```

The script will:

- detect a local IPv4 address
- update `apps/mobile/.env` with `EXPO_PUBLIC_API_URL=http://<PC_IP>:3000`
- start Prisma dev in a new PowerShell window
- start the API in a new PowerShell window
- start Metro/Expo for LAN iPhone testing in a new PowerShell window

If the detected IP is wrong, pass it manually:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-iphone-dev.ps1 -Ip 172.30.1.44
```

## Manual Path

### 1. Find The PC LAN IP

```powershell
ipconfig
```

Find the Wi-Fi `Adresse IPv4`, for example:

```text
172.30.1.44
```

### 2. Update Mobile API URL

In `apps/mobile/.env`, set:

```env
EXPO_PUBLIC_API_URL=http://172.30.1.44:3000
```

Replace `172.30.1.44` with the real PC LAN IP.

### 3. Start Prisma Dev

Terminal 1:

```powershell
cd C:\Users\t\Desktop\Projects\tv-app\apps\api
pnpm exec prisma dev start tv-app
```

Keep this terminal open.

If Prisma reports a new TCP port, update `apps/api/.env` `DATABASE_URL` before starting the API.

### 4. Verify The Database

Terminal 2:

```powershell
cd C:\Users\t\Desktop\Projects\tv-app
pnpm --filter api db:deploy
pnpm --filter api db:verify
```

### 5. Start The API

Terminal 3:

```powershell
cd C:\Users\t\Desktop\Projects\tv-app
pnpm --filter api start:dev
```

Keep this terminal open.

Quick checks:

```powershell
Invoke-RestMethod http://localhost:3000/health
Invoke-RestMethod http://172.30.1.44:3000/health
```

If `localhost` works but the LAN IP fails, check Windows Firewall or whether the API is listening on the network interface.

### 6. Start Metro For iPhone

Terminal 4:

```powershell
cd C:\Users\t\Desktop\Projects\tv-app
$env:REACT_NATIVE_PACKAGER_HOSTNAME="172.30.1.44"
pnpm --filter mobile exec expo start --dev-client --host lan --port 8081 --clear
```

Keep this terminal open.

### 7. Open On iPhone

- Put the iPhone on the same Wi-Fi as the PC.
- Open the Watchly development build on the iPhone.
- Use the QR code shown by Expo, or open the LAN URL shown in the terminal.

This project uses `expo-dev-client`, so prefer the installed Watchly development build over Expo Go when testing native/dev-client behavior.

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
