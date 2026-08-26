# =============================================================================
# Imagen de produccion de FGreda, orientada a Google Cloud Run.
#
# IMPORTANTE: el bundle de Vite se construye SIN incrustar API_BASE_URL.
# La URL del backend se inyecta en tiempo de arranque del contenedor via
# la variable de entorno API_BASE_URL, que el entrypoint escribe en
# /usr/share/nginx/html/runtime-config.js.
# =============================================================================

# ---- Etapa 1: build ---------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Capa cacheable: solo se invalida al cambiar las dependencias.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Bundle SIN API_BASE_URL incrustada en build-time.
# La URL se resuelve en tiempo de ejecucion del navegador via runtime-config.js.
# En desarrollo local, VITE_API_BASE_URL actua como fallback (ver src/config.ts).
RUN npm run build

# ---- Etapa 2: runtime -------------------------------------------------------
# nginx-unprivileged corre como UID 101 y nunca como root.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

ENV PORT=8080

# El entrypoint de la imagen aplica envsubst sobre los ficheros de templates.
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
# El snippet no lleva variables: se copia tal cual, fuera de templates.
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=builder /app/dist /usr/share/nginx/html

# Entrypoint que genera runtime-config.js antes de arrancar nginx.
# Corre como root para escribir runtime-config.js, luego cede a UID 101 (nginx)
# via su-exec para que el proceso principal del contenedor no sea root.
USER root
RUN apk add --no-cache su-exec
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh \
    && chown -R nginx:nginx /usr/share/nginx/html

EXPOSE 8080

ENTRYPOINT ["/docker-entrypoint.sh"]
