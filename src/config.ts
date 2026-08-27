/**
 * Configuracion runtime del frontend.
 *
 * En produccion (Cloud Run) la variable de entorno API_BASE_URL se inyecta
 * al arrancar el contenedor y el entrypoint genera /runtime-config.js con:
 *
 *   window.__GREDA_CONFIG__ = { "API_BASE_URL": "https://..." }
 *
 * Desde Fase 009A.1, API_BASE_URL en produccion es la cadena vacia "": el
 * frontend llama a su PROPIO origen (`/api/v1/...`, ruta relativa) y es
 * nginx quien reenvia `/api/` al backend real (ver nginx/default.conf.template).
 * Esto es deliberado, no "no configurada" — WebKit/Safari bloquea las
 * cookies de auth en llamadas cross-site al dominio del backend; en el mismo
 * origen no hay tal restriccion. Una URL absoluta (p. ej. en desarrollo
 * apuntando a otro backend) sigue siendo valida si hace falta.
 *
 * En desarrollo local el cliente HTTP recae en VITE_API_BASE_URL de .env.local,
 * o en el proxy de Vite dev server para /api (ver vite.config.ts) si no se
 * define ninguna de las dos.
 *
 * IMPORTANTE: Este modulo no expone ningun secreto.
 * API_BASE_URL es una URL publica del backend (o vacia, para mismo origen).
 */

export interface GredaRuntimeConfig {
  API_BASE_URL: string;
}

declare global {
  interface Window {
    __GREDA_CONFIG__?: GredaRuntimeConfig;
  }
}

/**
 * Resuelve la URL base del backend con la siguiente prioridad:
 *
 * 1. window.__GREDA_CONFIG__.API_BASE_URL  (runtime — produccion)
 *    Incluye la cadena vacia "" como valor VALIDO y deliberado: significa
 *    "mismo origen" (las rutas de la API se piden relativas, `/api/v1/...`,
 *    y nginx las reenvia al backend real). No es lo mismo que "no
 *    configurada" — por eso NO cae a VITE_API_BASE_URL en ese caso.
 * 2. import.meta.env.VITE_API_BASE_URL     (build-time — desarrollo local)
 * 3. Error explicito                        (nunca URL vacia en produccion)
 *
 * La funcion lanza en el momento en que se importa el modulo,
 * garantizando un fallo visible e inmediato si la configuracion falta.
 */
export function resolveApiBaseUrl(): string {
  // 1. Runtime config (produccion / contenedor). typeof === "string" (no
  // truthy-check): "" es "mismo origen", un valor real, no ausencia de valor.
  const runtimeConfig = window.__GREDA_CONFIG__;
  if (runtimeConfig && typeof runtimeConfig.API_BASE_URL === "string") {
    return runtimeConfig.API_BASE_URL.replace(/\/+$/, "");
  }

  // 2. Variable de build-time (desarrollo local con npm run dev)
  const viteUrl = import.meta.env.VITE_API_BASE_URL;
  if (viteUrl && typeof viteUrl === "string" && viteUrl.trim()) {
    return viteUrl.replace(/\/+$/, "");
  }

  // 3. Fail-fast — nunca URL vacia en produccion
  throw new Error(
    "[FGreda] API_BASE_URL no configurada.\n" +
      "En produccion: define la variable de entorno API_BASE_URL en el servicio Cloud Run.\n" +
      "En desarrollo: agrega VITE_API_BASE_URL en .env.local.",
  );
}
