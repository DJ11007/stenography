#!/usr/bin/env bash
# Deploys sctyping.com on the server: the latest code from GitHub, a fresh build, then a restart of the app.
# Run on the server from anywhere (it moves to the project folder itself), by hand or by the GitHub "Deploy" button
# (.github/workflows/deploy.yml). RESTART_CMD is how this server restarts the app, for example
#   RESTART_CMD="pm2 restart stenography"   or   RESTART_CMD="sudo systemctl restart stenography"
# Stops at the first error, so a failed pull or build never restarts the app (the running site keeps working).
set -euo pipefail

cd "$(dirname "$0")/.."
echo "== Deploying $(pwd) at $(date '+%Y-%m-%d %H:%M:%S')"

if [ -z "${RESTART_CMD:-}" ]; then
  echo "RESTART_CMD is not set: tell this script how the app is restarted (see the top of this file)." >&2
  exit 1
fi

echo "== 1/4 Latest code from GitHub"
git pull --ff-only origin main
git log --oneline -1

echo "== 2/4 Packages"
npm ci

echo "== 3/4 Build"
npm run build

echo "== 4/4 Restart"
eval "$RESTART_CMD"

echo "== Done: the site now runs $(git log --oneline -1)"
