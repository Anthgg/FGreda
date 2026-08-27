/**
 * Fase 009A.1: verifica que, en modo "mismo origen" (API_BASE_URL=""), el
 * cliente HTTP arma rutas relativas limpias hacia /api/v1/... — sin
 * duplicar el prefijo (/api/api/v1) y sin caer de vuelta a un host absoluto.
 *
 * BASE_URL se resuelve una sola vez al importar el modulo, por eso este
 * archivo esta separado de client.test.ts: necesita re-importar con
 * window.__GREDA_CONFIG__ ya configurado, igual que src/test/config.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, mockFetch } from "@/test/utils";

describe("cliente HTTP en modo mismo origen (API_BASE_URL vacia)", () => {
  beforeEach(() => {
    // src/test/setup.ts ya importo @/api/client a nivel de modulo (para
    // resetClientState) antes de que este beforeEach corriera, con
    // window.__GREDA_CONFIG__ todavia sin definir — BASE_URL habria
    // quedado cacheada con el fallback VITE_API_BASE_URL. resetModules()
    // fuerza que el import() de abajo re-evalue resolveApiBaseUrl() con la
    // config que se acaba de fijar.
    vi.resetModules();
    window.__GREDA_CONFIG__ = { API_BASE_URL: "" };
  });

  afterEach(() => {
    delete window.__GREDA_CONFIG__;
    vi.resetModules();
  });

  it("arma una ruta relativa /api/v1/... sin host absoluto", async () => {
    const fetchSpy = mockFetch(() => jsonResponse(200, {}));

    const { apiClient } = await import("@/api/client");
    await apiClient.get("/auth/me");

    const requestedUrl = String(fetchSpy.mock.calls[0]![0]);
    expect(requestedUrl).toBe("/api/v1/auth/me");
  });

  it("nunca duplica el prefijo /api (no /api/api/v1)", async () => {
    const fetchSpy = mockFetch(() => jsonResponse(200, {}));

    const { apiClient } = await import("@/api/client");
    await apiClient.get("/partners");

    const requestedUrl = String(fetchSpy.mock.calls[0]![0]);
    expect(requestedUrl).not.toContain("/api/api");
    expect(requestedUrl).toBe("/api/v1/partners");
  });

  it("nunca apunta al dominio del backend (bgreda-api) en modo mismo origen", async () => {
    const fetchSpy = mockFetch(() => jsonResponse(200, {}));

    const { apiClient } = await import("@/api/client");
    await apiClient.get("/auth/me");

    const requestedUrl = String(fetchSpy.mock.calls[0]![0]);
    expect(requestedUrl).not.toContain("bgreda-api");
    expect(requestedUrl).not.toMatch(/^https?:\/\//);
  });
});
