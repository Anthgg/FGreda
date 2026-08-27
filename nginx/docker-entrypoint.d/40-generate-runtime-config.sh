#!/bin/sh
# 40-generate-runtime-config.sh — Genera runtime-config.js antes de arrancar nginx.
#
# Se ejecuta automaticamente por el entrypoint oficial de nginx (/docker-entrypoint.sh)
# como usuario sin privilegios (UID 101).
#
# Lee la variable de entorno API_BASE_URL e inyecta la URL en:
#   /usr/share/nginx/html/runtime-config.js
#
# Desde Fase 009A.1, API_BASE_URL="" (cadena vacia, explicitamente
# configurada) es un valor VALIDO: significa "mismo origen" — el navegador
# llama a /api/v1/... en su propio origen y nginx reenvia /api/ al backend
# real (ver default.conf.template, location /api/). Por eso la validacion de
# abajo comprueba que la variable este DEFINIDA (con ${API_BASE_URL+x}), no
# que no este vacia: una variable vacia a proposito no es lo mismo que una
# variable que nunca se configuro.
#
# SEGURIDAD: API_BASE_URL es una URL publica del backend (o vacia).
#            NO colocar tokens, passwords, ni claves privadas aqui.

set -e

if [ -z "${API_BASE_URL+x}" ]; then
  echo "[FGreda] ERROR: La variable de entorno API_BASE_URL no esta definida." >&2
  echo "[FGreda] Configura API_BASE_URL en el servicio Cloud Run antes de desplegar" >&2
  echo "[FGreda] (usa API_BASE_URL=\"\" para 'mismo origen' via el proxy de nginx)." >&2
  echo "[FGreda] STATUS: CONTAINER_STARTUP_FAILED_MISSING_API_BASE_URL" >&2
  exit 1
fi
API_URL="$API_BASE_URL"

cat > /usr/share/nginx/html/runtime-config.js <<JSEOF
/* runtime-config.js — generado en el arranque del contenedor. NO editar. */
window.__GREDA_CONFIG__ = { "API_BASE_URL": "${API_URL}" };
JSEOF

if [ -z "$API_URL" ]; then
  echo "[FGreda] runtime-config.js generado: API_BASE_URL=\"\" (mismo origen, via proxy de nginx)"
else
  echo "[FGreda] runtime-config.js generado: API_BASE_URL=${API_URL}"
fi
