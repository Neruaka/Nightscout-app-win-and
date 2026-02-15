# Integrations API

Backend service that receives Health Connect data from an Android bridge and exposes read endpoints for the Electron desktop app.

## Endpoints

- `GET /health`
- `POST /ingest/health-connect` (header `x-ingest-token`)
- `GET /v1/summary` (header `Authorization: Bearer <READ_TOKEN>`)
- `GET /v1/meals?from=<ISO>&to=<ISO>&limit=500` (same read auth)

## Environment

Copy `.env.example` and set:

- `MONGODB_URI`
- `DB_NAME` (optional, default `nightscout_integrations`)
- `INGEST_TOKEN` (used by Android bridge)
- `READ_TOKEN` (used by desktop app)
- `PORT` (optional, default `8081`)
- `CORS_ORIGIN` (optional, default `*`)

## Local run

```bash
npm install
npm --workspace apps/integrations-api run dev
```

## Build

```bash
npm run build --workspace @nightscout/integrations-api
npm --workspace apps/integrations-api run start
```

## Railway deploy

1. Create a new Railway service from this repo.
2. Set root directory to repository root.
3. Add environment variables:
   - `MONGODB_URI`
   - `DB_NAME` (`nightscout_integrations` recommended)
   - `INGEST_TOKEN`
   - `READ_TOKEN`
   - `PORT=8081`
4. Keep `apps/integrations-api/railway.toml` in repo.
5. Deploy and verify:
   - `GET https://<service>.up.railway.app/health`
   - Expect `{ "ok": true, ... }`

## Manual checks

Read API:

```bash
curl -H "Authorization: Bearer <READ_TOKEN>" \
  "https://<service>.up.railway.app/v1/summary"
```

Ingest API:

```bash
curl -X POST "https://<service>.up.railway.app/ingest/health-connect" \
  -H "x-ingest-token: <INGEST_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"android-test","syncedAt":"2026-02-15T11:30:00.000Z","summary":{"stepsLast24h":8500,"weightKgLatest":72.4,"weightUpdatedAt":"2026-02-15T08:15:00.000Z"},"meals":[]}'
```

## Ingest payload format

```json
{
  "deviceId": "android-123",
  "syncedAt": "2026-02-15T11:30:00.000Z",
  "summary": {
    "stepsLast24h": 8400,
    "weightKgLatest": 72.4,
    "weightUpdatedAt": "2026-02-15T08:15:00.000Z"
  },
  "meals": [
    {
      "id": "meal-abc",
      "name": "Poulet riz",
      "carbsGrams": 63,
      "calories": 540,
      "eatenAt": "2026-02-15T12:10:00.000Z",
      "source": "myfitnesspal"
    }
  ]
}
```
