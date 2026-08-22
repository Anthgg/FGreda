/**
 * Operaciones de autenticacion contra BGreda.
 *
 * Ninguna de estas funciones maneja tokens: el backend los guarda en cookies
 * HttpOnly que este codigo no puede leer ni necesita.
 */

import { ApiError, apiClient, resetClientState } from "@/api/client";
import type { LoginPayload, SessionResponse, SessionUser } from "@/types/auth";

/**
 * Recupera la sesion actual desde el backend.
 *
 * `/auth/me` es la unica fuente de verdad. Un 401 no es un error de la
 * aplicacion: significa simplemente que no hay sesion, y se traduce a `null`.
 */
export async function fetchSession(): Promise<SessionUser | null> {
  try {
    const response = await apiClient.get<SessionResponse>("/auth/me");
    return response.user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export async function login(payload: LoginPayload): Promise<SessionUser> {
  const response = await apiClient.post<SessionResponse>("/auth/login", payload);
  return response.user;
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post<{ authenticated: false }>("/auth/logout");
  } finally {
    // El backend ya borro las cookies. Aqui solo queda limpiar el estado en
    // memoria: no existe ningun token local que eliminar.
    resetClientState();
  }
}
