#!/usr/bin/env bash
# Runs ON the VPS as the per-site Linux user. Pulls latest, builds, reloads PM2.
# Invoked by .github/workflows/deploy.yml after SSH.
#
# Usage: deploy-on-vps.sh <site_path> <branch> <git_sha> <pm2_name>

set -euo pipefail

SITE_PATH="$1"
BRANCH="$2"
GIT_SHA="$3"
PM2_NAME="$4"

# Source NVM so we get the per-user Node 22 instead of the system Node 20
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use default >/dev/null

cd "$SITE_PATH"

# First-time bootstrap: initialize repo in-place (site dir already has .env)
if [ ! -d ".git" ]; then
  git init -b "$BRANCH"
  git remote add origin git@github.com:zaifajs/app-horizonte.git
fi

git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "$GIT_SHA"

npm ci --no-audit --no-fund

# Prisma migrations apply once we have a schema (Task 1.7)
if [ -d "prisma/migrations" ]; then
  npx prisma migrate deploy
fi

npm run build

# Export .env into the shell so PM2 inherits PORT, DATABASE_URL, etc.
set -a
# shellcheck disable=SC1091
. ./.env
set +a

if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 reload "$PM2_NAME" --update-env
else
  pm2 start npm --name "$PM2_NAME" --update-env -- start
fi
pm2 save
