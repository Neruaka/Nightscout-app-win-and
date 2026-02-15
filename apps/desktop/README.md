# Desktop app

Electron desktop client for Nightscout read-only access.

## Security model

- `contextIsolation=true`
- `nodeIntegration=false`
- Read token stored in OS keychain (`keytar`)
- Integrations API token stored in OS keychain (`keytar`)
- Renderer never receives `API_SECRET`
- API client sends `Authorization: Bearer <token>` first, then falls back to `?token=<token>` for Nightscout compatibility.

## Features

- Includes a bolus estimate panel based on:
- Editable insulin profile:
  - Ratios by time windows
  - Correction factor
  - Target range
  - Insulin action and carb absorption durations
- IOB/COB estimate from Nightscout treatments to adjust dose estimates
- Time In Range cards for day, week, month
- Always-on-top widget window with live glucose
- Integration sync via `integrations-api`:
  - Health Connect summary (steps + weight)
  - MyFitnessPal meals ingested through Health Connect bridge
- Meal overlays on the 24h glucose chart

## Insulin advisor (estimate)

- Uses current glucose, carbs, selected meal time, profile, IOB/COB adjustments
- The estimate is informational only and does not replace clinician guidance.

## Dev

```bash
npm install
npm run dev:desktop
```

## Build Windows installer

```bash
npm run build:desktop:win
```

Installer artifact is created in `apps/desktop/release`.
