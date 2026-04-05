#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-${GCP_PROJECT_ID:-}}"
REGION="${REGION:-southamerica-east1}"
SERVICE="suitecrm"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "PROJECT_ID (or GCP_PROJECT_ID) is required"
  exit 1
fi

echo "[suitecrm] Building image: ${IMAGE}"
gcloud builds submit "kosh-infra/cloud-run/suitecrm" --tag "${IMAGE}" --project "${PROJECT_ID}"

echo "[suitecrm] Deploying Cloud Run service: ${SERVICE}"
gcloud run deploy "${SERVICE}" \
  --image "${IMAGE}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --timeout 300s \
  --set-secrets KOSH_CONFIG=KOSH_CONFIG:latest

echo "[suitecrm] Done."
