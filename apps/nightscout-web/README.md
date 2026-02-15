# Nightscout deployment (Railway + MongoDB Atlas)

This folder contains deployment assets for Nightscout on Railway.

## 1) MongoDB Atlas

1. Create Atlas project and cluster.
2. Create DB user with read/write permissions.
3. Add Railway egress to Atlas network access list.
4. Copy the connection string for `MONGODB_URI`.

## 2) Railway service

1. Create a Railway service from this repository.
2. Set root directory to repository root (or use config in this app folder).
3. Ensure Railway uses the Nightscout deployment config.
4. Add environment variables from `.env.example`.

Required:

- `MONGODB_URI`
- `API_SECRET`
- `TZ`
- `DISPLAY_UNITS`
- `INSECURE_USE_HTTP=false`
- `NODE_ENV=production`

## 3) Security baseline

- Use a long random `API_SECRET`.
- Keep service URL private.
- Enforce HTTPS only.
- Do not use `API_SECRET` in desktop app.

## 4) xDrip+ ingestion

In xDrip+ Nightscout upload settings:

- Base URL format expected by many xDrip builds:
  - `https://<API_SECRET>@<your-railway-host>.up.railway.app/api/v1/`
- If your build supports dedicated secret field, use the same `API_SECRET`.
- If API auth fails, verify whether Nightscout expects SHA1-hashed secret for header auth.

## 5) Health checks

- `GET /api/v1/status.json` should return `200`.
- If `401` appears, check token/secret auth context.

## 6) Desktop read token

Use a dedicated read token for desktop access.
Never embed `API_SECRET` in renderer code.
