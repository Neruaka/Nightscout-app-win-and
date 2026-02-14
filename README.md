# Nightscout Web + Desktop (Electron)

Monorepo for a private glucose dashboard based on:

- Dexcom One+ -> xDrip+
- xDrip+ -> Nightscout (Railway)
- Nightscout API -> Desktop app (Electron, Windows)

## Repository layout

- `apps/nightscout-web`: Railway deployment assets for Nightscout
- `apps/desktop`: Electron desktop application (React + TypeScript)
- `packages/shared-types`: shared TypeScript contracts
- `infra/docker`: local development stack (Nightscout + MongoDB)
- `ops`: backup and monitoring runbooks
- `.github/workflows`: CI and scheduled jobs

## Architecture summary

1. xDrip+ uploads entries to Nightscout with `API_SECRET`.
2. Nightscout stores entries in MongoDB Atlas.
3. Web users read data from Nightscout URL.
4. Desktop app reads Nightscout API with read token (not `API_SECRET`).

## Prerequisites

- Node.js 20+
- npm 10+
- Docker + Docker Compose (for local backend)
- Railway account
- MongoDB Atlas cluster

## Local setup

1. Copy `infra/docker/.env.dev.example` to `infra/docker/.env.dev` and set a strong `API_SECRET`.
2. Start local Nightscout + MongoDB:

```bash
docker compose -f infra/docker/docker-compose.dev.yml --env-file infra/docker/.env.dev up -d
```

3. Install JS dependencies:

```bash
npm install
```

4. Start desktop app in dev mode:

```bash
npm run dev:desktop
```

5. In desktop settings, set:
   - Base URL: your Nightscout URL (local or Railway)
   - Read token: your Nightscout read token

## Production deployment (Railway + Atlas)

See `apps/nightscout-web/README.md` for step-by-step deployment and env vars.

## CI/CD

- `ci.yml`: typecheck + tests + desktop Windows artifact build
- `atlas-backup.yml`: scheduled Atlas backup trigger (requires secrets)

## Security notes

- Never expose `API_SECRET` in the desktop app.
- Desktop stores read token using OS keychain (`keytar`).
- Keep Nightscout URL private and enforce HTTPS.

## Useful scripts

- `npm run typecheck`
- `npm run test`
- `npm run dev:desktop`
- `npm run build:desktop`
- `npm run build:desktop:win`
