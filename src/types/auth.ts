/**
 * Contratos de autenticacion.
 *
 * Reflejan exactamente lo que devuelve el backend. El frontend no deriva
 * permisos ni interpreta tokens: solo consume lo que BGreda declara.
 */

/** Roles de aplicacion. La autoridad sobre ellos es siempre del backend. */
export type UserRole = "ADMIN" | "OPERATOR";

export interface SessionUser {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
}

export interface SessionResponse {
  authenticated: true;
  user: SessionUser;
}

export interface LoginPayload {
  email: string;
  password: string;
}
