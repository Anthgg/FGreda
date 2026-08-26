/**
 * Configuracion runtime del frontend.
 *
 * En produccion (Cloud Run) la variable de entorno API_BASE_URL se inyecta
 * al arrancar el contenedor y el entrypoint genera /runtime-config.js con:
 *
 *   window.__GREDA_CONFIG__ = { "API_BASE_URL": "https://..." }
 *
 * En desarrollo local el cliente HTTP recae en VITE_API_BASE_URL de .env.local.
 *
 * IMPORTANTE: Este modulo no expone ningun secreto.
 * API_BASE_URL es una URL publica del backend.
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
 * 2. import.meta.env.VITE_API_BASE_URL     (build-time — desarrollo local)
 * 3. Error explicito                        (nunca URL vacia en produccion)
 *
 * La funcion lanza en el momento en que se importa el modulo,
 * garantizando un fallo visible e inmediato si la configuracion falta.
 */
export function resolveApiBaseUrl(): string {
  // 1. Runtime config (produccion / contenedor)
  const runtimeConfig = window.__GREDA_CONFIG__;
  if (runtimeConfig && typeof runtimeConfig.API_BASE_URL === "string" && runtimeConfig.API_BASE_URL) {
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
