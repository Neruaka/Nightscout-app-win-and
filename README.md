# Nightscout Web + Desktop (Electron)

Monorepo for a private glucose dashboard based on:

- Dexcom One+ -> xDrip+
- xDrip+ -> Nightscout (Railway)
- Nightscout API + Integrations API -> Desktop app (Electron, Windows)
- MyFitnessPal -> Health Connect -> Android bridge -> Integrations API

## Repository layout

- `apps/nightscout-web`: Railway deployment assets for Nightscout
- `apps/integrations-api`: Railway API for meals/health metrics
- `apps/desktop`: Electron desktop app (React + TypeScript)
- `apps/mobile-bridge-android`: Android app that syncs Health Connect data
- `packages/shared-types`: shared TypeScript contracts
- `infra/docker`: local development stack (Nightscout + MongoDB)
- `ops`: backup and monitoring runbooks
- `.github/workflows`: CI and scheduled jobs

## Architecture summary

1. xDrip+ uploads entries to Nightscout using `API_SECRET`.
2. Nightscout stores entries in MongoDB Atlas.
3. Android bridge uploads Health Connect meals/summary to Integrations API.
4. Desktop app reads Nightscout + Integrations API via read tokens.
5. Desktop renders live glucose, chart, TIR, bolus advisor, and widget.

## Desktop status (current implementation)

- Dark theme UI with burger navigation
- Routes:
  - `#/` Home (header -> chart -> metrics -> TIR)
  - `#/bolus` Bolus advisor
  - `#/settings` App/profile/connection/integration settings
  - `#/widget` compact widget mode
- Editable insulin profile:
  - Ratio windows by time ranges
  - Target windows by time ranges
  - Correction factor
  - Target range (static + per-time blocks)
  - Insulin action and carb absorption durations
- Bolus estimate with IOB/COB adjustments
- Inferred meal detection
- Insulin sensitivity assistant + health score card
- Desktop widget layouts (minimal/compact/chart) with pin/unpin and drag region
- FR/EN translations

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
   - Nightscout base URL
   - Nightscout read token
   - Integrations API URL
   - Integrations read token

## Production deployment

- Nightscout + Atlas: `apps/nightscout-web/README.md`
- Integrations API: `apps/integrations-api/README.md`
- Android bridge: `apps/mobile-bridge-android/README.md`

## CI/CD

- `ci.yml`: typecheck + tests + desktop Windows artifact build
- `atlas-backup.yml`: scheduled Atlas backup trigger (requires secrets)
- `nightscout-healthcheck.yml`: Nightscout URL health checks

## Security notes

- Never expose `API_SECRET` in desktop.
- Desktop stores sensitive tokens in OS keychain via `keytar`.
- Integrations ingest token is write-only for Android bridge.
- Keep Nightscout and Integrations URLs HTTPS.

## Useful scripts

- `npm run typecheck`
- `npm run test`
- `npm run dev:desktop`
- `npm run dev:integrations-api`
- `npm run build:desktop`
- `npm run build:integrations-api`
- `npm run build:desktop:win`

## Roadmap: next features

1. Native low/high alerts with sound profiles and snooze.
2. Profile presets (weekday/weekend/sport day) with one-click switch.
3. Bolus history with compare planned dose vs actual treatment.
4. Export PDF report (daily/weekly) with chart, TIR, and bolus stats.
5. Widget notes / annotations.
6. Multi-account support (switch between multiple Nightscout instances).
7. Offline queue for manual notes and meal edits with sync retry.
8. Caregiver share mode (read-only temporary dashboard link).
9. Night mode timeline (22:00-06:00) with dedicated low-risk insights.
10. Sensitivity assistant auto-apply proposals with safety guardrails.
11. Health score trends over time (weekly/monthly trajectory).
12. Signed update packages + auto-download/install.
