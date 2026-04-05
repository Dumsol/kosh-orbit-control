#!/bin/bash
set -euo pipefail

export ALLOW_EMPTY_PASSWORD="${ALLOW_EMPTY_PASSWORD:-no}"
export APACHE_HTTP_PORT_NUMBER="${PORT:-8080}"
export SUITECRM_DATABASE_PORT_NUMBER="${SUITECRM_DATABASE_PORT_NUMBER:-5432}"

# Inject SuiteCRM-related env vars from KOSH_CONFIG JSON when available.
if [[ -n "${KOSH_CONFIG:-}" ]] && command -v python3 >/dev/null 2>&1; then
  python3 - <<'PY' >/tmp/kosh_suitecrm_env.sh
import json, os, shlex

raw = os.environ.get("KOSH_CONFIG", "{}")
try:
    cfg = json.loads(raw or "{}")
except Exception:
    cfg = {}

keys = [
    "SUITECRM_DATABASE_HOST",
    "SUITECRM_DATABASE_PORT_NUMBER",
    "SUITECRM_DATABASE_NAME",
    "SUITECRM_DATABASE_USER",
    "SUITECRM_DATABASE_PASSWORD",
    "SUITECRM_USERNAME",
    "SUITECRM_PASSWORD",
    "SUITECRM_EMAIL",
    "SUITECRM_SKIP_BOOTSTRAP",
    "SUITECRM_SMTP_HOST",
    "SUITECRM_SMTP_PORT_NUMBER",
    "SUITECRM_SMTP_USER",
    "SUITECRM_SMTP_PASSWORD",
    "SUITECRM_SMTP_PROTOCOL",
    "SUITECRM_SMTP_FROM_EMAIL",
    "SUITECRM_SMTP_FROM_NAME",
    "ALLOW_EMPTY_PASSWORD",
    "BITNAMI_DEBUG",
]

for k in keys:
    if os.environ.get(k):
        continue
    v = cfg.get(k)
    if v is None:
        continue
    print(f"export {k}={shlex.quote(str(v))}")
PY
  # shellcheck source=/tmp/kosh_suitecrm_env.sh
  source /tmp/kosh_suitecrm_env.sh || true
fi

exec /opt/bitnami/scripts/suitecrm/entrypoint.sh /opt/bitnami/scripts/suitecrm/run.sh
