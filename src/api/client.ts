/**
 * Cliente HTTP unico de la aplicacion.
 *
 * Es el unico modulo autorizado a usar `fetch` (ESLint lo hace cumplir). Aqui
 * se centralizan:
 *
 * - la URL base del backend (`VITE_API_BASE_URL`),
 * - `credentials: "include"` en todas las peticiones,
 * - el token CSRF, guardado **solo en memoria**,
 * - el reintento controlado ante expiracion de sesion,
 * - el timeout y la traduccion uniforme de errores.
 *
 * No existe ningun token de sesion accesible desde JavaScript: la sesion vive
 * en cookies HttpOnly que el navegador envia y el backend valida.
 */

const RAW_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const BASE_URL = RAW_BASE_URL.replace(/\/+$/, "");
const API_PREFIX = "/api/v1";

const DEFAULT_TIMEOUT_MS = 15_000;

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Rutas que nunca deben disparar un refresh automatico. Sin esta lista, un 401
 * de `/auth/refresh` provocaria un bucle infinito de renovacion.
 */
const NO_REFRESH_PATHS = ["/auth/refresh", "/auth/login", "/auth/logout", "/auth/csrf"];

export const CSRF_HEADER = "X-CSRF-Token";

export const ErrorCode = {
  NETWORK: "NETWORK_ERROR",
  TIMEOUT: "TIMEOUT_ERROR",
  UNKNOWN: "UNKNOWN_ERROR",
  NOT_AUTHENTICATED: "AUTH_NOT_AUTHENTICATED",
  SESSION_EXPIRED: "AUTH_SESSION_EXPIRED",
  INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  PROFILE_NOT_PROVISIONED: "AUTH_PROFILE_NOT_PROVISIONED",
  ACCOUNT_INACTIVE: "AUTH_ACCOUNT_INACTIVE",
  CSRF_MISSING: "CSRF_TOKEN_MISSING",
  CSRF_INVALID: "CSRF_TOKEN_INVALID",
} as const;

export interface ApiErrorDetail {
  field: string;
  reason: string;
  type: string;
}

/** Error normalizado. Todo fallo de red o de API llega al componente asi. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: ApiErrorDetail[];

  constructor(code: string, message: string, status: number, details: ApiErrorDetail[] = []) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /** True cuando el backend no respondio (caido, CORS, sin red o timeout). */
  get isUnreachable(): boolean {
    return this.code === ErrorCode.NETWORK || this.code === ErrorCode.TIMEOUT;
  }
}

export interface RequestConfig {
  signal?: AbortSignal;
  timeoutMs?: number;
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

// ---------------------------------------------------------------------------
// Estado en memoria
// ---------------------------------------------------------------------------
// El token CSRF vive aqui y solo aqui. Nunca se escribe en localStorage ni en
// sessionStorage: al recargar la pagina simplemente se vuelve a pedir.
let csrfToken: string | null = null;
let csrfRequest: Promise<string> | null = null;
let refreshRequest: Promise<boolean> | null = null;

/** Descarta el estado en memoria. Se usa al cerrar sesion y en las pruebas. */
export function resetClientState(): void {
  csrfToken = null;
  csrfRequest = null;
  refreshRequest = null;
}

// ---------------------------------------------------------------------------
// Utilidades internas
// ---------------------------------------------------------------------------
function buildUrl(path: string): string {
  return `${BASE_URL}${API_PREFIX}${path}`;
}

function isMutating(method: HttpMethod): boolean {
  return MUTATING_METHODS.has(method);
}

function allowsRefresh(path: string): boolean {
  return !NO_REFRESH_PATHS.some((exempt) => path.startsWith(exempt));
}

function isCsrfFailure(code: string): boolean {
  return code === ErrorCode.CSRF_MISSING || code === ErrorCode.CSRF_INVALID;
}

/** Combina el `signal` del llamante con un timeout propio. */
function createSignal(config: RequestConfig): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), timeoutMs);

  const external = config.signal;
  const forward = () => controller.abort(external?.reason);
  if (external) {
    if (external.aborted) forward();
    else external.addEventListener("abort", forward, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      external?.removeEventListener("abort", forward);
    },
  };
}

async function readErrorBody(response: Response): Promise<ApiError> {
  let code = `HTTP_${response.status}`;
  let message = "No se pudo completar la operacion";
  let details: ApiErrorDetail[] = [];

  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "error" in body) {
      const error = (body as { error: unknown }).error;
      if (error && typeof error === "object") {
        const shaped = error as { code?: string; message?: string; details?: ApiErrorDetail[] };
        if (shaped.code) code = shaped.code;
        if (shaped.message) message = shaped.message;
        if (Array.isArray(shaped.details)) details = shaped.details;
      }
    }
  } catch {
    // El cuerpo no era JSON. Se conserva el error derivado del status.
  }

  return new ApiError(code, message, response.status, details);
}

function toTransportError(error: unknown): ApiError {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return new ApiError(ErrorCode.TIMEOUT, "El servidor tardo demasiado en responder", 0);
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    throw error; // cancelacion deliberada del llamante: no es un fallo
  }
  return new ApiError(
    ErrorCode.NETWORK,
    "No se pudo conectar con el servidor. Verifique su conexion.",
    0,
  );
}

// ---------------------------------------------------------------------------
// CSRF
// ---------------------------------------------------------------------------
async function requestCsrfToken(): Promise<string> {
  const { signal, cleanup } = createSignal({});
  try {
    const response = await fetch(buildUrl("/auth/csrf"), {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
      signal,
    });
    if (!response.ok) throw await readErrorBody(response);
    const body = (await response.json()) as { csrf_token: string };
    return body.csrf_token;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw toTransportError(error);
  } finally {
    cleanup();
  }
}

/**
 * Devuelve el token CSRF vigente, pidiendolo si hace falta.
 *
 * Las peticiones concurrentes comparten una unica solicitud en vuelo.
 */
async function ensureCsrfToken(force = false): Promise<string> {
  if (force) csrfToken = null;
  if (csrfToken) return csrfToken;

  if (!csrfRequest) {
    csrfRequest = requestCsrfToken()
      .then((token) => {
        csrfToken = token;
        return token;
      })
      .finally(() => {
        csrfRequest = null;
      });
  }
  return csrfRequest;
}

// ---------------------------------------------------------------------------
// Refresh de sesion
// ---------------------------------------------------------------------------
async function performRefresh(): Promise<boolean> {
  const { signal, cleanup } = createSignal({});
  try {
    const token = await ensureCsrfToken();
    const response = await fetch(buildUrl("/auth/refresh"), {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json", [CSRF_HEADER]: token },
      signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    cleanup();
  }
}

/**
 * Renueva la sesion como maximo una vez a la vez.
 *
 * Si varias peticiones reciben 401 simultaneamente comparten un unico refresh,
 * evitando una tormenta de renovaciones.
 */
async function refreshSession(): Promise<boolean> {
  if (!refreshRequest) {
    refreshRequest = performRefresh().finally(() => {
      refreshRequest = null;
    });
  }
  return refreshRequest;
}

// ---------------------------------------------------------------------------
// Peticion
// ---------------------------------------------------------------------------
interface Attempt {
  csrfRetried: boolean;
  authRetried: boolean;
}

async function send(
  method: HttpMethod,
  path: string,
  body: unknown,
  config: RequestConfig,
): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (isMutating(method)) headers[CSRF_HEADER] = await ensureCsrfToken();

  const { signal, cleanup } = createSignal(config);
  const init: RequestInit = {
    method,
    // Sin esto el navegador no enviaria las cookies HttpOnly de sesion.
    credentials: "include",
    headers,
    signal,
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  try {
    return await fetch(buildUrl(path), init);
  } catch (error) {
    throw toTransportError(error);
  } finally {
    cleanup();
  }
}

async function request<T>(
  method: HttpMethod,
  path: string,
  body: unknown,
  config: RequestConfig,
  attempt: Attempt = { csrfRetried: false, authRetried: false },
): Promise<T> {
  const response = await send(method, path, body, config);

  if (response.ok) {
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  const error = await readErrorBody(response);

  // El backend rota el token CSRF al iniciar sesion y lo borra al cerrarla.
  // Un unico reintento con token fresco evita fallos espurios.
  if (response.status === 403 && isCsrfFailure(error.code) && !attempt.csrfRetried) {
    await ensureCsrfToken(true);
    return request<T>(method, path, body, config, { ...attempt, csrfRetried: true });
  }

  // Como maximo un refresh automatico por peticion.
  if (response.status === 401 && allowsRefresh(path) && !attempt.authRetried) {
    const renewed = await refreshSession();
    if (renewed) {
      return request<T>(method, path, body, config, { ...attempt, authRetried: true });
    }
  }

  throw error;
}

export const apiClient = {
  get: <T>(path: string, config: RequestConfig = {}) => request<T>("GET", path, undefined, config),
  post: <T>(path: string, body?: unknown, config: RequestConfig = {}) =>
    request<T>("POST", path, body, config),
  put: <T>(path: string, body?: unknown, config: RequestConfig = {}) =>
    request<T>("PUT", path, body, config),
  patch: <T>(path: string, body?: unknown, config: RequestConfig = {}) =>
    request<T>("PATCH", path, body, config),
  delete: <T>(path: string, config: RequestConfig = {}) =>
    request<T>("DELETE", path, undefined, config),
};
