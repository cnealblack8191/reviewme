#!/usr/bin/env bash
# Deploy or update ReviewMe on the EC2 host. Run from /var/www/reviewme as the app user.
# Steps and first-time setup: docs/DEPLOY.md.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/reviewme}"
BRANCH="${BRANCH:-main}"
cd "$APP_DIR"

if [ ! -f .env ]; then
  echo "No .env in $APP_DIR. Copy .env.example and fill it first." >&2
  exit 1
fi

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

# Dev dependencies are needed for the build and the Prisma CLI.
npm ci --include=dev
npx prisma generate
npx prisma migrate deploy
NODE_ENV=production npm run db:seed
npm run build

if pm2 describe reviewme > /dev/null 2>&1; then
  pm2 reload deploy/ecosystem.config.cjs --update-env
else
  pm2 start deploy/ecosystem.config.cjs
  pm2 save
fi

for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://127.0.0.1:3010/api/health; then
    echo
    echo "ReviewMe is up."
    exit 0
  fi
  sleep 3
done
echo "Health check failed. Look at: pm2 logs reviewme --lines 50" >&2
exit 1
