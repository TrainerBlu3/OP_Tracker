#!/usr/bin/env bash
# Polling auto-deploy: run on the server (e.g. via the systemd timer in this
# folder) to pick up new releases published by .github/workflows/build-and-release.yml.
# The build happens in GitHub Actions -- this script only downloads the
# already-built artifact and swaps it in, so it never compiles on the VM.
#
# REPO_DIR is a plain working directory (not a git checkout): it holds the
# extracted build, node_modules, and .env. Requires the `gh` CLI on PATH,
# authenticated via a GH_TOKEN env var (see README.md's Deploying section).
set -euo pipefail

REPO_DIR="${OP_TRACKER_REPO_DIR:-/opt/op-tracker}"
REPO="${OP_TRACKER_REPO:-TrainerBlu3/OP_Tracker}"
SERVICE_NAME="${OP_TRACKER_SERVICE_NAME:-op-tracker}"
DEPLOYED_REV_FILE="$REPO_DIR/.deployed-rev"
LOG_TAG="op-tracker-deploy"

log() { echo "[$(date -Iseconds)] $*"; }

cd "$REPO_DIR"

log "Checking latest release..."
NEW_REV="$(gh release view deploy --repo "$REPO" --json targetCommitish -q .targetCommitish)"
OLD_REV="$(cat "$DEPLOYED_REV_FILE" 2>/dev/null || echo "")"

if [ "$NEW_REV" = "$OLD_REV" ]; then
  log "Already up to date ($NEW_REV). Nothing to do."
  exit 0
fi

log "New release found: ${OLD_REV:-none} -> $NEW_REV. Deploying..."

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
gh release download deploy --repo "$REPO" --pattern build.tar.gz --dir "$TMP_DIR" --clobber

log "Extracting build artifact..."
rm -rf .next generated prisma
tar xzf "$TMP_DIR/build.tar.gz"

log "Installing production dependencies..."
npm ci --omit=dev

log "Applying database migrations..."
npx prisma migrate deploy

log "Restarting $SERVICE_NAME..."
systemctl --user restart "$SERVICE_NAME"

echo "$NEW_REV" > "$DEPLOYED_REV_FILE"
log "Deploy complete: now at $NEW_REV"
