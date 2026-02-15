# Monitoring runbook

## Nightscout health

- URL: `https://<nightscout-host>/api/v1/status.json`
- Expected: `HTTP 200` JSON payload

## Integrations API health

- URL: `https://<integrations-host>/health`
- Expected: `HTTP 200` with `{ "ok": true }`

## Automated checks

- Workflow: `.github/workflows/nightscout-healthcheck.yml`
- Required secrets:
  - `NIGHTSCOUT_URL`
  - `INTEGRATIONS_API_URL` (recommended)

## Alerting

- Enable GitHub Actions email notifications.
- Optional: send failures to Slack/Discord webhook.

## Daily manual checklist

1. Open Nightscout web and confirm latest glucose timestamp is fresh.
2. Open desktop Home and verify source is `Live API` (not `Cache`).
3. Open desktop Bolus page and verify advisor receives live glucose.
4. Verify latest meal overlays appear in 24h chart after mobile sync.
