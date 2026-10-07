#!/usr/bin/env bash
# Full EC2 production deploy from /home/ubuntu.
#
# Prerequisites:
#   1. RDS snapshot taken (especially before the first run that clears operational data)
#   2. zevooria-deploy.tar.gz uploaded to /home/ubuntu/
#   3. Existing /home/ubuntu/zevooria with production .env
#
# Usage (after SSH):
#   bash /home/ubuntu/zevooria-new/scripts/ec2-server-deploy.sh
#   — or, after unpack:
#   cd /home/ubuntu && bash zevooria-new/scripts/ec2-server-deploy.sh
#
# One-time operational reset:
#   Runs only when /home/ubuntu/.zevooria_operational_reset_done is missing.
#   After success it creates that sentinel so later deploys never wipe data again
#   (even if this script in the tarball still contains the reset block).

set -euo pipefail

HOME_DIR=/home/ubuntu
TARBALL="${HOME_DIR}/zevooria-deploy.tar.gz"
OLD_DIR="${HOME_DIR}/zevooria"
NEW_DIR="${HOME_DIR}/zevooria-new"
SENTINEL="${HOME_DIR}/.zevooria_operational_reset_done"
SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"

if [[ ! -f "${TARBALL}" ]]; then
  echo "Missing ${TARBALL}. Upload the tarball first."
  exit 1
fi

if [[ ! -d "${OLD_DIR}" ]]; then
  echo "Missing ${OLD_DIR}. Expected an existing deploy with .env."
  exit 1
fi

if [[ ! -f "${OLD_DIR}/.env" ]]; then
  echo "Missing ${OLD_DIR}/.env. Aborting so production secrets are not lost."
  exit 1
fi

echo "==> Prepare ${NEW_DIR}"
rm -rf "${NEW_DIR}"
mkdir -p "${NEW_DIR}"
cp "${OLD_DIR}/.env" "${NEW_DIR}/.env"
chmod 600 "${NEW_DIR}/.env"

echo "==> Unpack tarball"
tar -xzf "${TARBALL}" -C "${NEW_DIR}"

echo "==> Keep production product images"
mkdir -p "${NEW_DIR}/assets"
if [[ -d "${OLD_DIR}/assets" ]]; then
  cp -a "${OLD_DIR}/assets/." "${NEW_DIR}/assets/"
fi

echo "==> Stop old stack and swap directories"
cd "${OLD_DIR}"
docker compose down
cd "${HOME_DIR}"
mv "${OLD_DIR}" "${HOME_DIR}/zevooria-prev-$(date +%Y%m%d-%H%M%S)"
mv "${NEW_DIR}" "${OLD_DIR}"
cd "${OLD_DIR}"

echo "==> Public origins (CORS + QR)"
grep -q '^WEB_PUBLIC_URL=' .env \
  && sed -i 's|^WEB_PUBLIC_URL=.*|WEB_PUBLIC_URL=https://zevooria.com|' .env \
  || echo 'WEB_PUBLIC_URL=https://zevooria.com' >> .env
grep -q '^ADMIN_PUBLIC_URL=' .env \
  && sed -i 's|^ADMIN_PUBLIC_URL=.*|ADMIN_PUBLIC_URL=https://admin.zevooria.com|' .env \
  || echo 'ADMIN_PUBLIC_URL=https://admin.zevooria.com' >> .env

echo "==> Build and start (single rebuild — no --no-cache second pass)"
docker compose config >/dev/null
docker compose up -d --build --force-recreate --remove-orphans
docker compose ps

echo "==> Wait for API health"
healthy=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://127.0.0.1:3001/api/health >/dev/null; then
    echo "API healthy."
    healthy=1
    break
  fi
  echo "Waiting for API... (${i}/10)"
  sleep 3
done
if [[ "${healthy}" -ne 1 ]]; then
  echo "API did not become healthy. Check: docker compose logs api"
  exit 1
fi

echo "==> Run migrations"
docker compose exec api npm run migration:run:prod

# --- ONE_TIME_OPERATIONAL_RESET_START ---
if [[ -f "${SENTINEL}" ]]; then
  echo "==> Skip operational reset (sentinel exists: ${SENTINEL})"
else
  echo "==> ONE-TIME operational reset (orders/journals/audits/sessions; inventory=100; promo used_count=0)"
  echo "    Takes an RDS snapshot beforehand if you have not already."
  docker compose exec \
    -e CONFIRM_OPERATIONAL_RESET=YES \
    -e CONFIRM_PRODUCTION_RESET=YES \
    api npm run reset:operational:prod
  touch "${SENTINEL}"
  chmod 600 "${SENTINEL}"
  echo "==> Wrote sentinel ${SENTINEL} — future deploys will skip reset."
  # Strip this one-time block from the deployed copy of this script (cosmetic; sentinel is the real guard).
  if [[ -f "${OLD_DIR}/scripts/ec2-server-deploy.sh" ]]; then
    sed -i '/ONE_TIME_OPERATIONAL_RESET_START/,/ONE_TIME_OPERATIONAL_RESET_END/d' \
      "${OLD_DIR}/scripts/ec2-server-deploy.sh" || true
  fi
fi
# --- ONE_TIME_OPERATIONAL_RESET_END ---

echo "==> Smoke checks"
curl -sS http://127.0.0.1:3001/api/health
echo
curl -sS -o /dev/null -w "web %{http_code}\n" http://127.0.0.1:3000/
curl -sS -o /dev/null -w "admin %{http_code}\n" http://127.0.0.1:3002/

echo "==> Recent logs"
docker compose logs --tail=40 api
docker compose logs --tail=20 admin
docker compose logs --tail=20 web

echo "==> Deploy finished."
