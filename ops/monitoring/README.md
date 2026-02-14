# Monitoring runbook

## Health endpoint

- URL: `https://<nightscout-host>/api/v1/status.json`
- Expected: HTTP 200 with JSON payload

## Automated checks

Workflow: `.github/workflows/nightscout-healthcheck.yml` (every 10 minutes)
Required secret: `NIGHTSCOUT_URL`

## Alerting

- Configure GitHub Actions email notifications
- Optional: route failures to Slack/Discord via webhook job

## Daily manual check

1. Open Nightscout web dashboard.
2. Confirm latest glucose timestamp is fresh.
3. Confirm desktop app source is `Live API` and not `Cache`.
