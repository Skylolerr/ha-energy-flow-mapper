#!/usr/bin/env bash
# Deploy Energy Flow Mapper to your own Home Assistant instance for testing.
#
# Usage: scripts/deploy.sh [--no-restart | --reload]
#
#   (default)     with HA_TOKEN: check the config and restart Home Assistant
#   --reload      with HA_TOKEN: only reload the Energy Flow Mapper entry;
#                 enough for panel-only changes (Python changes need a restart)
#   --no-restart  only copy the files
#
# Reads HA_HOST, HA_USER, HA_CONFIG_PATH (and optionally HA_SSH_PORT, HA_URL,
# HA_TOKEN) from .env in the repository root. Requires an SSH add-on on Home
# Assistant ("Advanced SSH & Web Terminal" or "Terminal & SSH").
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT}/.env"
MODE=restart

for arg in "$@"; do
  case "$arg" in
    --no-restart) MODE=none ;;
    --reload) MODE=reload ;;
    -h | --help)
      sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing ${ENV_FILE}. Copy .env.example to .env and adjust it." >&2
  exit 1
fi
# Strip Windows line endings so values do not end in \r.
set -a
# shellcheck disable=SC1090
source <(sed 's/\r$//' "$ENV_FILE")
set +a

: "${HA_HOST:?HA_HOST is not set in .env}"
: "${HA_USER:?HA_USER is not set in .env}"
: "${HA_CONFIG_PATH:?HA_CONFIG_PATH is not set in .env}"
HA_SSH_PORT="${HA_SSH_PORT:-22}"
HA_URL="${HA_URL:-http://${HA_HOST}:8123}"

SRC="${ROOT}/custom_components/energy_flow_mapper/"
DEST="${HA_CONFIG_PATH%/}/custom_components/energy_flow_mapper/"
TARGET="${HA_USER}@${HA_HOST}"
SSH=(ssh -p "$HA_SSH_PORT")

# Build the panel bundle if the panel sources exist (phase 2).
if [[ -f "${ROOT}/panel/package.json" ]]; then
  echo "==> Building panel"
  (cd "${ROOT}/panel" && npm ci && npm run build)
fi

echo "==> Copying integration to ${TARGET}:${DEST}"
"${SSH[@]}" "$TARGET" "mkdir -p '${DEST}'"
if command -v rsync >/dev/null && "${SSH[@]}" "$TARGET" "command -v rsync" >/dev/null; then
  rsync -rlptv --delete --exclude '__pycache__/' \
    -e "ssh -p ${HA_SSH_PORT}" "$SRC" "${TARGET}:${DEST}"
else
  # rsync is missing locally (e.g. Git Bash on Windows) or on the add-on.
  echo "    rsync not available on both sides, falling back to tar over ssh"
  tar -C "$SRC" --exclude='__pycache__' -cf - . |
    "${SSH[@]}" "$TARGET" "rm -rf '${DEST}' && mkdir -p '${DEST}' && tar -C '${DEST}' -xf -"
fi

if [[ "$MODE" == none ]]; then
  echo "==> Done (restart skipped)"
  exit 0
fi
if [[ -z "${HA_TOKEN:-}" ]]; then
  echo "==> Done. Set HA_TOKEN in .env to restart or reload automatically;"
  echo "    restart Home Assistant (or reload the integration) now."
  exit 0
fi

api() {
  curl -fsS -X "${2:-POST}" \
    -H "Authorization: Bearer ${HA_TOKEN}" \
    -H "Content-Type: application/json" \
    "${HA_URL%/}/api/$1"
}

if [[ "$MODE" == reload ]]; then
  echo "==> Reloading Energy Flow Mapper"
  entries="$(api "config/config_entries/entry?domain=energy_flow_mapper" GET |
    grep -o '"entry_id":"[^"]*"' | cut -d'"' -f4)"
  if [[ -z "$entries" ]]; then
    echo "    Energy Flow Mapper is not set up yet, nothing to reload."
  fi
  for entry in $entries; do
    api "config/config_entries/entry/${entry}/reload" >/dev/null
    echo "    reloaded ${entry}"
  done
  echo "==> Done. Reload the browser page to get the new panel."
  exit 0
fi

echo "==> Checking configuration"
check="$(api config/core/check_config)"
if [[ ! "$check" =~ \"result\"[[:space:]]*:[[:space:]]*\"valid\" ]]; then
  echo "Configuration check failed, not restarting:" >&2
  echo "$check" >&2
  exit 1
fi

echo "==> Restarting Home Assistant"
api services/homeassistant/restart >/dev/null || true
echo "==> Done"
