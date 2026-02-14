# Atlas backup runbook

## Purpose

Trigger a cloud snapshot every day for MongoDB Atlas.

## Automation

Workflow: `.github/workflows/atlas-backup.yml`
Script: `ops/backup/trigger-atlas-backup.sh`

## Required GitHub secrets

- `ATLAS_PUBLIC_KEY`
- `ATLAS_PRIVATE_KEY`
- `ATLAS_GROUP_ID`
- `ATLAS_CLUSTER_NAME`

## Validate

1. Run `atlas-backup` workflow manually from Actions.
2. Confirm recent snapshot appears in Atlas backup UI.
3. Keep Atlas retention policy enabled at cluster level.

## Recovery checklist

1. Pick snapshot timestamp.
2. Restore to new temporary cluster.
3. Validate Nightscout collections.
4. Promote restored cluster URI to `MONGODB_URI` if needed.
