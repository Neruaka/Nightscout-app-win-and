# Desktop app

Electron desktop client for Nightscout read-only access with an Integrations API overlay.

## Security model

- `contextIsolation=true`
- `nodeIntegration=false`
- Nightscout read token stored in OS keychain (`keytar`)
- Integrations API token stored in OS keychain (`keytar`)
- Renderer never receives `API_SECRET`
- Nightscout auth: `Authorization: Bearer <token>` fallback to `?token=<token>`

## Current UX

- Dark theme
- Burger menu for app navigation
- Routes:
  - `#/` Home
  - `#/bolus` Bolus advisor
  - `#/settings` Settings
  - `#/widget` Widget mode

## Features implemented

- Home page layout:
  - Header
  - 24h glucose chart:
    - meal overlays
    - inferred meal overlays (slope-based)
    - risk zones:
      - `< 0.80 g/L` red
      - `1.30 -> 1.80 g/L` orange
      - `> 1.80 g/L` red
    - current trend chip
  - Metric cards
  - Time In Range (day/week/month)
  - Health score card (TIR/variability/hypo burden/stability)
- Bolus advisor page:
  - Carbs + current glucose + meal time input
  - Time-window carb ratios
  - Time-window targets
  - Correction factor and target range
  - IOB/COB adjustments
  - Rounded 0.5U suggested dose
  - Insulin sensitivity assistant from historical corrections
- Settings page:
  - App preferences:
    - language FR/EN
    - start with Windows
    - widget layout (minimal/compact/chart)
  - Editable insulin profile:
    - Ratio windows (`HH:MM`)
    - Target windows (`HH:MM`)
    - Correction factor
    - Target low/high
    - Insulin action / carb absorption durations
  - Nightscout connection settings
  - Integrations API settings + manual sync
- Widget:
  - Minimal / compact / chart layouts
  - Pin/unpin always-on-top
  - Drag by top bar

## Important disclaimer

Bolus advisor outputs are informational estimates only and do not replace clinician guidance.

## Dev

```bash
npm install
npm run dev:desktop
```

## Typecheck / tests / build

```bash
npm --workspace apps/desktop run typecheck
npm --workspace apps/desktop run test
npm --workspace apps/desktop run build
```

## Build Windows installer

```bash
npm run build:desktop:win
```

Installer artifact is created in `apps/desktop/release`.
