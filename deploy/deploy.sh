#!/usr/bin/env bash
# Polling auto-deploy: run on the server (e.g. via the systemd timer in this
# folder) to pick up new releases published by .github/workflows/build-and-release.yml.
# The build happens in GitHub Actions -- this script only downloads the
# already-built artifact and swaps it in, so it never compiles on the VM.
#
# REPO_DIR is a plain working directory (not a git checkout): it holds the
# extracted build, node_modules, and .env. Requires the `gh` CLI on PATH,
# authenticated via a GH_TOKEN env var (see README.md's Deploying section).
#
# After restart, health-checks the app; if it doesn't come up healthy, rolls
# back to the previous release (each build is tagged `deploy-<sha>`, kept
# for a few releases -- see the workflow's prune step).
set -euo pipefail

REPO_DIR="${OP_TRACKER_REPO_DIR:-/opt/op-tracker}"
REPO="${OP_TRACKER_REPO:-TrainerBlu3/OP_Tracker}"
SERVICE_NAME="${OP_TRACKER_SERVICE_NAME:-op-tracker}"
HEALTH_URL="${OP_TRACKER_HEALTH_URL:-http://localhost:3000/api/health}"
DEPLOYED_REV_FILE="$REPO_DIR/.deployed-rev"

log() { echo "[$(date -Iseconds)] $*"; }

cd "$REPO_DIR"

# deploy_release TAG REV -- downloads, extracts, installs, migrates, restarts.
deploy_release() {
  local tag="$1" rev="$2"
  local tmp_dir
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "$tmp_dir"' RETURN

  log "Downloading release $tag ($rev)..."
  gh release download "$tag" --repo "$REPO" --pattern build.tar.gz --dir "$tmp_dir" --clobber

  log "Extracting build artifact..."
  rm -rf .next generated prisma
  tar xzf "$tmp_dir/build.tar.gz"

  log "Installing production dependencies..."
  npm ci --omit=dev

  log "Applying database migrations..."
  npx prisma migrate deploy

  log "Restarting $SERVICE_NAME..."
  systemctl --user restart "$SERVICE_NAME"
}

# health_check -- polls HEALTH_URL for up to ~30s to let the app finish starting.
health_check() {
  for _ in $(seq 1 10); do
    sleep 3
    if curl -sf -o /dev/null "$HEALTH_URL"; then
      return 0
    fi
  done
  return 1
}

log "Checking latest release..."
read -r NEW_TAG NEW_REV <<<"$(gh release view --repo "$REPO" --json tagName,targetCommitish -q '"\(.tagName) \(.targetCommitish)"')"
OLD_REV="$(cat "$DEPLOYED_REV_FILE" 2>/dev/null || echo "")"

if [ "$NEW_REV" = "$OLD_REV" ]; then
  log "Already up to date ($NEW_REV). Nothing to do."
  exit 0
fi

log "New release found: ${OLD_REV:-none} -> $NEW_REV. Deploying..."
deploy_release "$NEW_TAG" "$NEW_REV"

if health_check; then
  echo "$NEW_REV" > "$DEPLOYED_REV_FILE"
  log "Deploy complete: now at $NEW_REV"
  exit 0
fi

log "Health check FAILED for $NEW_TAG ($NEW_REV). Rolling back..."

PREV_LINE=""
while IFS= read -r line; do
  rev="${line#* }"
  if [ "$rev" != "$NEW_REV" ]; then
    PREV_LINE="$line"
    break
  fi
done < <(gh release list --repo "$REPO" --json tagName,targetCommitish --jq '.[] | "\(.tagName) \(.targetCommitish)"')

if [ -z "$PREV_LINE" ]; then
  log "No previous release to roll back to. Manual intervention required -- $SERVICE_NAME is on the failed build ($NEW_REV)."
  exit 1
fi

PREV_TAG="${PREV_LINE% *}"
PREV_REV="${PREV_LINE#* }"
log "Rolling back to $PREV_TAG ($PREV_REV)..."
deploy_release "$PREV_TAG" "$PREV_REV"

if health_check; then
  echo "$PREV_REV" > "$DEPLOYED_REV_FILE"
  log "Rollback complete: now at $PREV_REV. Failed build was $NEW_REV -- investigate before it's retried."
  exit 1
else
  log "Rollback to $PREV_REV ALSO failed its health check. $SERVICE_NAME may be down -- manual intervention required."
  exit 1
fi
