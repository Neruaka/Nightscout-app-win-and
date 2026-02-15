# Integrations API

Backend service that receives Health Connect data from an Android bridge and exposes read endpoints for the desktop app.

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
- `PORT` (optional, default `8080`)
- `CORS_ORIGIN` (optional, default `*`)
- `NODE_ENV` (`production` on Railway)

## Local run

```bash
npm install
npm --workspace apps/integrations-api run dev
```

## Build and start

```bash
npm --workspace apps/integrations-api run build
npm --workspace apps/integrations-api run start
```

## Railway deploy

1. Create a new Railway service from this repository.
2. Set root directory to `apps/integrations-api`.
3. Set environment variables:
   - `MONGODB_URI`
   - `DB_NAME`
   - `INGEST_TOKEN`
   - `READ_TOKEN`
   - `NODE_ENV=production`
4. Deploy.
5. Verify:
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

## Payload format

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

## Notes

- `INGEST_TOKEN` is only for Android bridge writes.
- Desktop should only use `READ_TOKEN`.
