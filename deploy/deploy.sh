#!/usr/bin/env bash
# Polling auto-deploy: run on the server (e.g. via the systemd timer in this
# folder) to pick up new commits pushed to the deploy branch. This script is
# meant for a dedicated deployment checkout -- don't run it against a working
# copy you edit by hand, since it hard-resets to match the remote branch.
set -euo pipefail

REPO_DIR="${OP_TRACKER_REPO_DIR:-/opt/op-tracker}"
BRANCH="${OP_TRACKER_BRANCH:-main}"
SERVICE_NAME="${OP_TRACKER_SERVICE_NAME:-op-tracker}"
LOG_TAG="op-tracker-deploy"

log() { echo "[$(date -Iseconds)] $*"; }

cd "$REPO_DIR"

log "Fetching origin/$BRANCH..."
git fetch --quiet origin "$BRANCH"

LOCAL_REV="$(git rev-parse HEAD)"
REMOTE_REV="$(git rev-parse "origin/$BRANCH")"

if [ "$LOCAL_REV" = "$REMOTE_REV" ]; then
  log "Already up to date ($LOCAL_REV). Nothing to do."
  exit 0
fi

log "New commits found: $LOCAL_REV -> $REMOTE_REV. Deploying..."
git reset --hard "origin/$BRANCH"

log "Installing dependencies..."
npm ci

log "Applying database migrations..."
npx prisma migrate deploy

log "Building..."
npm run build

log "Restarting $SERVICE_NAME..."
systemctl --user restart "$SERVICE_NAME"

log "Deploy complete: now at $(git rev-parse HEAD)"
