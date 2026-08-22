# =============================================================================
# Imagen de produccion de FGreda, orientada a Google Cloud Run.
# =============================================================================

# ---- Etapa 1: build ---------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Capa cacheable: solo se invalida al cambiar las dependencias.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite incrusta las variables VITE_* en el bundle en tiempo de compilacion, de
# modo que la URL del backend debe conocerse aqui. Es informacion publica: no
# hay ningun secreto en el frontend.
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

# ---- Etapa 2: runtime -------------------------------------------------------
# nginx-unprivileged corre como UID 101 y nunca como root.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

ENV PORT=8080

# El entrypoint de la imagen aplica envsubst sobre los ficheros de templates.
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080
