# Atlas backup runbook

## Purpose

Trigger regular MongoDB Atlas snapshots and keep a restore path documented.

## Automation

- Workflow: `.github/workflows/atlas-backup.yml`
- Script: `ops/backup/trigger-atlas-backup.sh`

## Required GitHub secrets

- `ATLAS_PUBLIC_KEY`
- `ATLAS_PRIVATE_KEY`
- `ATLAS_GROUP_ID`
- `ATLAS_CLUSTER_NAME`

## Validate backup job

1. Run `atlas-backup` workflow manually from GitHub Actions.
2. Verify a recent snapshot in Atlas Backup UI.
3. Keep retention policy enabled at cluster level.

## Recovery checklist

1. Pick snapshot timestamp.
2. Restore snapshot to a temporary cluster.
3. Validate Nightscout collections and Integrations DB data.
4. If valid, switch `MONGODB_URI` in Railway service(s).
5. Redeploy and verify `/api/v1/status.json` and integrations `/health`.
