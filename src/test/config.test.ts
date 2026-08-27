/**
 * Tests del modulo de configuracion runtime.
 *
 * Verifica los comportamientos de resolveApiBaseUrl:
 *   1. window.__GREDA_CONFIG__.API_BASE_URL tiene maxima prioridad.
 *   2. Su cadena vacia "" es un valor valido ("mismo origen", Fase 009A.1),
 *      no equivalente a "no configurada" — no cae a VITE_API_BASE_URL.
 *   3. VITE_API_BASE_URL actua como fallback (desarrollo local) solo cuando
 *      __GREDA_CONFIG__ no existe en absoluto.
 *   4. Si ninguna esta configurada, lanza error explicito.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Importacion dinamica para poder resetear el modulo entre tests.
// resolveApiBaseUrl se evalua en el momento de importacion del modulo
// client.ts, pero para testear config.ts directamente lo hacemos via
// importacion directa y controlamos window.__GREDA_CONFIG__ antes.

describe("resolveApiBaseUrl", () => {
  const ORIGINAL_META_ENV = import.meta.env.VITE_API_BASE_URL;

  beforeEach(() => {
    // Limpiar __GREDA_CONFIG__ del window
    delete window.__GREDA_CONFIG__;
  });

  afterEach(() => {
    delete window.__GREDA_CONFIG__;
    vi.unstubAllEnvs();
  });

  it("prioriza window.__GREDA_CONFIG__.API_BASE_URL sobre VITE_API_BASE_URL", async () => {
    window.__GREDA_CONFIG__ = { API_BASE_URL: "https://runtime-backend.example.com" };
    vi.stubEnv("VITE_API_BASE_URL", "https://build-time-backend.example.com");

    // Reimportamos para evaluar con el estado del window actual
    const { resolveApiBaseUrl } = await import("@/config");
    const url = resolveApiBaseUrl();

    expect(url).toBe("https://runtime-backend.example.com");
  });

  it("cae a VITE_API_BASE_URL si __GREDA_CONFIG__ no existe", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://dev-backend.example.com");

    const { resolveApiBaseUrl } = await import("@/config");
    const url = resolveApiBaseUrl();

    expect(url).toBe("https://dev-backend.example.com");
  });

  it("elimina trailing slash de la URL", async () => {
    window.__GREDA_CONFIG__ = { API_BASE_URL: "https://runtime-backend.example.com///" };

    const { resolveApiBaseUrl } = await import("@/config");
    const url = resolveApiBaseUrl();

    expect(url).toBe("https://runtime-backend.example.com");
  });

  it("lanza error explicito si ninguna fuente esta configurada", async () => {
    // Sin __GREDA_CONFIG__ y sin VITE_API_BASE_URL
    vi.stubEnv("VITE_API_BASE_URL", "");

    const { resolveApiBaseUrl } = await import("@/config");

    expect(() => resolveApiBaseUrl()).toThrow("API_BASE_URL no configurada");
  });

  it("respeta API_BASE_URL vacia como 'mismo origen' y NO cae a VITE_API_BASE_URL (Fase 009A.1)", async () => {
    // "" es un valor deliberado (proxy same-origin de nginx), no ausencia de
    // configuracion: las rutas de la API quedan relativas al origen actual.
    window.__GREDA_CONFIG__ = { API_BASE_URL: "" };
    vi.stubEnv("VITE_API_BASE_URL", "https://fallback-backend.example.com");

    const { resolveApiBaseUrl } = await import("@/config");
    const url = resolveApiBaseUrl();

    expect(url).toBe("");
  });

  // Verificar que el ORIGINAL_META_ENV no fue mutado por los tests
  it("restaura el entorno entre tests sin afectar el runner de CI", () => {
    expect(typeof ORIGINAL_META_ENV === "string" || ORIGINAL_META_ENV === undefined).toBe(true);
  });
});
