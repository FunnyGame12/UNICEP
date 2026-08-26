#!/usr/bin/env bash
set -euo pipefail

SERVER_USER="ricardo"
SERVER_HOST="unicepmerida.com"
BRANCH="main"

SSH_TARGET="${SERVER_USER}@${SERVER_HOST}"

read -r -d '' REMOTE_SCRIPT <<'EOS' || true
set -euo pipefail

BRANCH="__BRANCH__"

DEPLOY_PATH=""
if [[ -d /var/www/UNICEP/.git ]]; then
  DEPLOY_PATH="/var/www/UNICEP"
elif [[ -d /var/www/unicep/.git ]]; then
  DEPLOY_PATH="/var/www/unicep"
else
  echo "No se encontro repo git en /var/www/UNICEP ni /var/www/unicep" >&2
  exit 1
fi

echo "[deploy] Ruta detectada: ${DEPLOY_PATH}"
cd "${DEPLOY_PATH}"

echo "[deploy] Actualizando codigo (${BRANCH})"
git fetch origin "${BRANCH}"
git reset --hard "origin/${BRANCH}"

echo "[deploy] Backend: dependencias + migraciones + restart"
cd backend
npm install
npm run migrate
pm2 restart ecosystem.config.cjs
pm2 status

echo "[deploy] Frontend: dependencias + build"
cd ../frontend
npm install
npm run build

echo "[deploy] Ajuste de CSP para nginx (solo si sudo no requiere password)"
if sudo -n true >/dev/null 2>&1; then
  for nginx_file in /etc/nginx/sites-available/unicep /etc/nginx/sites-enabled/unicep; do
    if [[ -f "${nginx_file}" ]]; then
      sudo sed -i "s|script-src 'self'; style-src 'self' 'unsafe-inline'|script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'|" "${nginx_file}"
    fi
  done
  sudo nginx -t
  sudo systemctl reload nginx
  echo "[deploy] Nginx actualizado correctamente."
else
  echo "[deploy] sudo requiere password; se omite el ajuste de nginx para no interrumpir el despliegue."
fi

echo "[deploy] Despliegue completado correctamente"
EOS

REMOTE_SCRIPT=${REMOTE_SCRIPT/__BRANCH__/${BRANCH}}

echo "[deploy] Conectando a ${SSH_TARGET}"
ssh "${SSH_TARGET}" "${REMOTE_SCRIPT}"
