#!/bin/sh
# docker-entrypoint.sh — Genera runtime-config.js antes de arrancar nginx.
#
# Este script se ejecuta como ENTRYPOINT del contenedor de produccion.
# Corre como root, escribe runtime-config.js en /usr/share/nginx/html/,
# y luego cede el control a nginx como UID 101 (nginx) via su-exec.
#
# Resultado en /usr/share/nginx/html/runtime-config.js:
#   window.__GREDA_CONFIG__ = { "API_BASE_URL": "https://..." };
#
# SEGURIDAD: API_BASE_URL es una URL publica del backend.
#            NO colocar tokens, passwords, ni claves privadas aqui.

set -e

# Validar que API_BASE_URL esta configurada
API_URL="${API_BASE_URL:-}"
if [ -z "$API_URL" ]; then
  echo "[FGreda] ERROR: La variable de entorno API_BASE_URL no esta configurada." >&2
  echo "[FGreda] Configura API_BASE_URL en el servicio Cloud Run antes de desplegar." >&2
  echo "[FGreda] STATUS: CONTAINER_STARTUP_FAILED_MISSING_API_BASE_URL" >&2
  exit 1
fi

# Generar runtime-config.js con la URL del backend inyectada en runtime
cat > /usr/share/nginx/html/runtime-config.js <<JSEOF
/* runtime-config.js — generado en el arranque del contenedor. NO editar. */
window.__GREDA_CONFIG__ = { "API_BASE_URL": "${API_URL}" };
JSEOF

echo "[FGreda] runtime-config.js generado: API_BASE_URL=${API_URL}"

# Ceder control a nginx como UID 101 (nginx).
# su-exec cambia el UID del proceso antes de exec, garantizando que el
# proceso principal del contenedor no sea root.
exec su-exec nginx nginx -g "daemon off;"
