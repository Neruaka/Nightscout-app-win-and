#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${ATLAS_PUBLIC_KEY:-}" ]]; then
  echo "ATLAS_PUBLIC_KEY is required"
  exit 1
fi

if [[ -z "${ATLAS_PRIVATE_KEY:-}" ]]; then
  echo "ATLAS_PRIVATE_KEY is required"
  exit 1
fi

if [[ -z "${ATLAS_GROUP_ID:-}" ]]; then
  echo "ATLAS_GROUP_ID is required"
  exit 1
fi

if [[ -z "${ATLAS_CLUSTER_NAME:-}" ]]; then
  echo "ATLAS_CLUSTER_NAME is required"
  exit 1
fi

RESPONSE=$(curl --silent --show-error --fail --digest \
  --user "${ATLAS_PUBLIC_KEY}:${ATLAS_PRIVATE_KEY}" \
  --header "Content-Type: application/json" \
  --request POST \
  "https://cloud.mongodb.com/api/atlas/v2/groups/${ATLAS_GROUP_ID}/clusters/${ATLAS_CLUSTER_NAME}/backup/snapshots" \
  --data '{"description":"Scheduled snapshot from GitHub Actions"}')

echo "Atlas backup request accepted"
echo "${RESPONSE}"
