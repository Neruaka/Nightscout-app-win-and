# Nightscout deployment (Railway + MongoDB Atlas)

This folder contains deployment assets for Nightscout on Railway.

## 1) Create MongoDB Atlas

1. Create an Atlas project and cluster.
2. Create a database user with read/write rights.
3. Add Railway egress to Atlas network access list.
4. Copy connection string for `MONGODB_URI`.

## 2) Create Railway service

1. In Railway, create a new service from this repository.
2. Set root path to repository root.
3. Railway detects `apps/nightscout-web/railway.toml` and Dockerfile.
4. Add environment variables from `.env.example`.

Required variables:
- `MONGODB_URI`
- `API_SECRET`
- `TZ`
- `DISPLAY_UNITS`
- `INSECURE_USE_HTTP=false`
- `NODE_ENV=production`

## 3) Security baseline

- Use a long random `API_SECRET`.
- Keep service URL private.
- Use HTTPS only.
- Do not reuse `API_SECRET` outside ingestion.

## 4) xDrip+ ingestion

In xDrip+ Nightscout upload settings:
- Base URL: `https://<your-railway-host>.up.railway.app`
- Secret: same `API_SECRET`

## 5) Health checks

- Health endpoint: `/api/v1/status.json`
- Validate after each deployment.

## 6) Read token for desktop app

For desktop read-only access, create a dedicated token flow in front of Nightscout (reverse proxy or app token gateway). Never embed `API_SECRET` in the desktop renderer.
