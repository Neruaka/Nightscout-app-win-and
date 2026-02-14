# Desktop app

Electron desktop client for Nightscout read-only access.

## Security model

- `contextIsolation=true`
- `nodeIntegration=false`
- Read token stored in OS keychain (`keytar`)
- Renderer never receives `API_SECRET`
- API client sends `Authorization: Bearer <token>` first, then falls back to `?token=<token>` for Nightscout compatibility.

## Insulin advisor (estimate)

- Includes a bolus estimate panel based on:
  - Carb ratio `1U/5g` from `04:00` to `11:30`
  - Carb ratio `1U/7g` for the rest of the day
  - Correction factor `1U = -0.5 g/L`
  - Target range `0.80 - 1.30 g/L`
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
