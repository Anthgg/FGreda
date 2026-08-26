#!/bin/sh
# 40-generate-runtime-config.sh — Genera runtime-config.js antes de arrancar nginx.
#
# Se ejecuta automaticamente por el entrypoint oficial de nginx (/docker-entrypoint.sh)
# como usuario sin privilegios (UID 101).
#
# Lee la variable de entorno API_BASE_URL e inyecta la URL en:
#   /usr/share/nginx/html/runtime-config.js
#
# SEGURIDAD: API_BASE_URL es una URL publica del backend.
#            NO colocar tokens, passwords, ni claves privadas aqui.

set -e

API_URL="${API_BASE_URL:-}"
if [ -z "$API_URL" ]; then
  echo "[FGreda] ERROR: La variable de entorno API_BASE_URL no esta configurada." >&2
  echo "[FGreda] Configura API_BASE_URL en el servicio Cloud Run antes de desplegar." >&2
  echo "[FGreda] STATUS: CONTAINER_STARTUP_FAILED_MISSING_API_BASE_URL" >&2
  exit 1
fi

cat > /usr/share/nginx/html/runtime-config.js <<JSEOF
/* runtime-config.js — generado en el arranque del contenedor. NO editar. */
window.__GREDA_CONFIG__ = { "API_BASE_URL": "${API_URL}" };
JSEOF

echo "[FGreda] runtime-config.js generado: API_BASE_URL=${API_URL}"
