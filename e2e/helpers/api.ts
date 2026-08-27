/**
 * Cliente HTTP directo al backend, para setup/verificacion (conteos de
 * quemas, movimientos de inventario, intentos de bypass de permisos) sin
 * pasar por la UI. Usa el mismo mecanismo de cookies+CSRF que el frontend
 * real: nada de tokens hardcodeados ni headers de autenticacion fantasma.
 */

import { request, type APIRequestContext } from "@playwright/test";

import { E2E_EMAIL, E2E_PASSWORD } from "./fixtures";

const BACKEND_BASE_URL =
  process.env.E2E_BACKEND_URL ?? "https://bgreda-api-303244958634.southamerica-west1.run.app";

export interface ApiSession {
  context: APIRequestContext;
  csrfToken: string;
  dispose: () => Promise<void>;
}

/** Inicia sesion contra el backend real y devuelve un contexto listo para llamadas autenticadas. */
export async function createApiSession(
  email = E2E_EMAIL,
  password = E2E_PASSWORD,
): Promise<ApiSession> {
  const context = await request.newContext({ baseURL: BACKEND_BASE_URL });

  const csrfResponse = await context.get("/api/v1/auth/csrf");
  const { csrf_token: initialToken } = (await csrfResponse.json()) as { csrf_token: string };

  const loginResponse = await context.post("/api/v1/auth/login", {
    headers: { "X-CSRF-Token": initialToken },
    data: { email, password },
  });
  if (!loginResponse.ok()) {
    throw new Error(`No se pudo iniciar sesion via API: HTTP ${loginResponse.status()}`);
  }

  // El login rota el token CSRF; las siguientes mutaciones deben usar el nuevo.
  const rotatedCsrf = await context.get("/api/v1/auth/csrf");
  const { csrf_token: csrfToken } = (await rotatedCsrf.json()) as { csrf_token: string };

  return {
    context,
    csrfToken,
    dispose: () => context.dispose(),
  };
}

export async function getJson<T>(session: ApiSession, path: string): Promise<T> {
  const response = await session.context.get(path);
  if (!response.ok()) {
    throw new Error(`GET ${path} -> HTTP ${response.status()}`);
  }
  return response.json() as Promise<T>;
}

export interface FiringsCount {
  total: number;
}

export async function firingsCount(session: ApiSession): Promise<number> {
  const data = await getJson<FiringsCount>(session, "/api/v1/firings?limit=1");
  return data.total;
}

export interface InventoryMovementsCount {
  total: number;
}

export async function inventoryMovementsCount(session: ApiSession): Promise<number> {
  const data = await getJson<InventoryMovementsCount>(session, "/api/v1/inventory/movements?limit=1");
  return data.total;
}
