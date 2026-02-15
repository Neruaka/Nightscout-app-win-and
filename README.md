# Nightscout Web + Desktop (Electron)

Monorepo for a private glucose dashboard based on:

- Dexcom One+ -> xDrip+
- xDrip+ -> Nightscout (Railway)
- Nightscout API + Integrations API -> Desktop app (Electron, Windows)
- MyFitnessPal -> Health Connect -> Android bridge -> Integrations API

## Repository layout

- `apps/nightscout-web`: Railway deployment assets for Nightscout
- `apps/integrations-api`: Railway API for meals/health metrics
- `apps/desktop`: Electron desktop application (React + TypeScript)
- `apps/mobile-bridge-android`: Android bridge implementation guide
- `packages/shared-types`: shared TypeScript contracts
- `infra/docker`: local development stack (Nightscout + MongoDB)
- `ops`: backup and monitoring runbooks
- `.github/workflows`: CI and scheduled jobs

## Architecture summary

1. xDrip+ uploads entries to Nightscout with `API_SECRET`.
2. Nightscout stores entries in MongoDB Atlas.
3. Android bridge uploads Health Connect data to Integrations API.
4. Web users read data from Nightscout URL.
5. Desktop app reads Nightscout API + Integrations API with read tokens.

## Prerequisites

- Node.js 20+
- npm 10+
- Docker + Docker Compose (for local backend)
- Railway account
- MongoDB Atlas cluster
- Android phone (for Health Connect automation)

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
   - Integrations API URL
   - Integrations read token

## Production deployment (Railway + Atlas)

See `apps/nightscout-web/README.md` for step-by-step deployment and env vars.
See `apps/integrations-api/README.md` for integration backend deployment.

## CI/CD

- `ci.yml`: typecheck + tests + desktop Windows artifact build
- `atlas-backup.yml`: scheduled Atlas backup trigger (requires secrets)

## Security notes

- Never expose `API_SECRET` in the desktop app.
- Desktop stores read token using OS keychain (`keytar`).
- Integrations API ingest token is only for Android bridge.
- Keep Nightscout URL private and enforce HTTPS.

## Useful scripts

- `npm run typecheck`
- `npm run test`
- `npm run dev:desktop`
- `npm run dev:integrations-api`
- `npm run build:desktop`
- `npm run build:integrations-api`
- `npm run build:desktop:win`
