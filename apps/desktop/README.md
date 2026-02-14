# Desktop app

Electron desktop client for Nightscout read-only access.

## Security model

- `contextIsolation=true`
- `nodeIntegration=false`
- Read token stored in OS keychain (`keytar`)
- Renderer never receives `API_SECRET`
- API client sends `Authorization: Bearer <token>` first, then falls back to `?token=<token>` for Nightscout compatibility.

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
