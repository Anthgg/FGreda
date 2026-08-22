import { describe, expect, it } from "vitest";

import { ApiError, apiClient, CSRF_HEADER, ErrorCode } from "@/api/client";
import { csrfResponse, CSRF_TOKEN, errorResponse, jsonResponse, mockFetch } from "@/test/utils";

function headerValue(init: RequestInit, name: string): string | undefined {
  return (init.headers as Record<string, string> | undefined)?.[name];
}

describe("cliente HTTP", () => {
  it("envia las cookies en todas las peticiones", async () => {
    const fetchSpy = mockFetch(() => jsonResponse(200, { ok: true }));

    await apiClient.get("/auth/me");

    const [, init] = fetchSpy.mock.calls[0]!;
    expect(init?.credentials).toBe("include");
  });

  it("apunta al backend bajo el prefijo /api/v1", async () => {
    const fetchSpy = mockFetch(() => jsonResponse(200, {}));

    await apiClient.get("/auth/me");

    expect(fetchSpy.mock.calls[0]![0]).toContain("/api/v1/auth/me");
  });

  it("no envia token CSRF en las lecturas", async () => {
    const fetchSpy = mockFetch(() => jsonResponse(200, {}));

    await apiClient.get("/auth/me");

    expect(headerValue(fetchSpy.mock.calls[0]![1] ?? {}, CSRF_HEADER)).toBeUndefined();
  });

  it("obtiene y envia el token CSRF en las mutaciones", async () => {
    const fetchSpy = mockFetch((url) =>
      url.includes("/auth/csrf") ? csrfResponse() : jsonResponse(200, { ok: true }),
    );

    await apiClient.post("/auth/logout");

    const mutation = fetchSpy.mock.calls.find(([url]) => String(url).includes("/auth/logout"))!;
    expect(headerValue(mutation[1] ?? {}, CSRF_HEADER)).toBe(CSRF_TOKEN);
  });

  it("reutiliza el token CSRF entre mutaciones sucesivas", async () => {
    const fetchSpy = mockFetch((url) =>
      url.includes("/auth/csrf") ? csrfResponse() : jsonResponse(200, {}),
    );

    await apiClient.post("/recurso");
    await apiClient.post("/recurso");

    const csrfCalls = fetchSpy.mock.calls.filter(([url]) => String(url).includes("/auth/csrf"));
    expect(csrfCalls).toHaveLength(1);
  });

  it("traduce los errores del backend al formato uniforme", async () => {
    mockFetch(() => errorResponse(401, ErrorCode.INVALID_CREDENTIALS, "Credenciales invalidas"));

    const error = await apiClient.get("/auth/me").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(ErrorCode.INVALID_CREDENTIALS);
    expect((error as ApiError).status).toBe(401);
    expect((error as ApiError).message).toBe("Credenciales invalidas");
  });

  it("traduce un backend inalcanzable a un error de red", async () => {
    mockFetch(() => {
      throw new TypeError("Failed to fetch");
    });

    const error = (await apiClient.get("/auth/me").catch((caught: unknown) => caught)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe(ErrorCode.NETWORK);
    expect(error.isUnreachable).toBe(true);
  });

  it("ante un 401 renueva la sesion y reintenta una sola vez", async () => {
    let meCalls = 0;
    const fetchSpy = mockFetch((url) => {
      if (url.includes("/auth/csrf")) return csrfResponse();
      if (url.includes("/auth/refresh")) return jsonResponse(200, { authenticated: true });
      meCalls += 1;
      return meCalls === 1
        ? errorResponse(401, ErrorCode.SESSION_EXPIRED)
        : jsonResponse(200, { authenticated: true });
    });

    const result = await apiClient.get<{ authenticated: boolean }>("/auth/me");

    expect(result.authenticated).toBe(true);
    expect(meCalls).toBe(2);
    const refreshCalls = fetchSpy.mock.calls.filter(([url]) => String(url).includes("/auth/refresh"));
    expect(refreshCalls).toHaveLength(1);
  });

  it("no entra en bucle si el refresh tambien falla", async () => {
    let meCalls = 0;
    const fetchSpy = mockFetch((url) => {
      if (url.includes("/auth/csrf")) return csrfResponse();
      if (url.includes("/auth/refresh")) return errorResponse(401, ErrorCode.SESSION_EXPIRED);
      meCalls += 1;
      return errorResponse(401, ErrorCode.SESSION_EXPIRED);
    });

    const error = (await apiClient.get("/auth/me").catch((caught: unknown) => caught)) as ApiError;

    expect(error.status).toBe(401);
    expect(meCalls).toBe(1);
    expect(fetchSpy.mock.calls.filter(([url]) => String(url).includes("/auth/refresh"))).toHaveLength(
      1,
    );
  });

  it("nunca intenta renovar la sesion desde el propio login", async () => {
    const fetchSpy = mockFetch((url) => {
      if (url.includes("/auth/csrf")) return csrfResponse();
      return errorResponse(401, ErrorCode.INVALID_CREDENTIALS);
    });

    await apiClient.post("/auth/login", { email: "a@b.com", password: "x" }).catch(() => null);

    expect(fetchSpy.mock.calls.some(([url]) => String(url).includes("/auth/refresh"))).toBe(false);
  });

  it("comparte un unico refresh entre peticiones concurrentes", async () => {
    let refreshCalls = 0;
    const attempts = new Map<string, number>();
    mockFetch((url) => {
      if (url.includes("/auth/csrf")) return csrfResponse();
      if (url.includes("/auth/refresh")) {
        refreshCalls += 1;
        return jsonResponse(200, { authenticated: true });
      }
      const seen = (attempts.get(url) ?? 0) + 1;
      attempts.set(url, seen);
      return seen === 1 ? errorResponse(401, ErrorCode.SESSION_EXPIRED) : jsonResponse(200, {});
    });

    await Promise.all([apiClient.get("/recurso-a"), apiClient.get("/recurso-b")]);

    expect(refreshCalls).toBe(1);
  });

  it("ante un CSRF invalido pide un token nuevo y reintenta una vez", async () => {
    let csrfCalls = 0;
    let mutationCalls = 0;
    mockFetch((url) => {
      if (url.includes("/auth/csrf")) {
        csrfCalls += 1;
        return csrfResponse();
      }
      mutationCalls += 1;
      return mutationCalls === 1
        ? errorResponse(403, ErrorCode.CSRF_INVALID)
        : jsonResponse(200, { ok: true });
    });

    await apiClient.post("/recurso");

    expect(csrfCalls).toBe(2);
    expect(mutationCalls).toBe(2);
  });

  it("propaga el error si el CSRF sigue fallando tras el reintento", async () => {
    let mutationCalls = 0;
    mockFetch((url) => {
      if (url.includes("/auth/csrf")) return csrfResponse();
      mutationCalls += 1;
      return errorResponse(403, ErrorCode.CSRF_INVALID);
    });

    const error = (await apiClient.post("/recurso").catch((caught: unknown) => caught)) as ApiError;

    expect(error.code).toBe(ErrorCode.CSRF_INVALID);
    expect(mutationCalls).toBe(2);
  });
});
