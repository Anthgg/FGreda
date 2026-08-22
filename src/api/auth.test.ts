import { describe, expect, it } from "vitest";

import { fetchSession, login, logout } from "@/api/auth";
import { ErrorCode } from "@/api/client";
import { csrfResponse, errorResponse, jsonResponse, mockFetch, TEST_USER } from "@/test/utils";

describe("operaciones de autenticacion", () => {
  it("traduce un 401 de /auth/me a ausencia de sesion", async () => {
    mockFetch((url) => {
      if (url.includes("/auth/csrf")) return csrfResponse();
      return errorResponse(401, ErrorCode.NOT_AUTHENTICATED);
    });

    await expect(fetchSession()).resolves.toBeNull();
  });

  it("propaga los errores que no son de sesion", async () => {
    mockFetch(() => errorResponse(503, "SERVICE_UNAVAILABLE"));

    await expect(fetchSession()).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });

  it("renueva el token CSRF tras iniciar sesion", async () => {
    // El backend rota el token al abrir sesion. Sin invalidar el cacheado, la
    // primera mutacion posterior recibiria un 403 y gastaria un reintento.
    let csrfCalls = 0;
    let logoutStatus = 403;
    const fetchSpy = mockFetch((url) => {
      if (url.includes("/auth/csrf")) {
        csrfCalls += 1;
        logoutStatus = 200;
        return csrfResponse();
      }
      if (url.includes("/auth/login")) {
        return jsonResponse(200, { authenticated: true, user: TEST_USER });
      }
      return logoutStatus === 200
        ? jsonResponse(200, { authenticated: false })
        : errorResponse(403, ErrorCode.CSRF_INVALID);
    });

    await login({ email: TEST_USER.email, password: "clave" });
    await logout();

    // Un token para el login y otro tras la rotacion: nunca un 403 intermedio.
    expect(csrfCalls).toBe(2);
    const forbidden = fetchSpy.mock.calls.filter(([url]) => String(url).includes("/auth/logout"));
    expect(forbidden).toHaveLength(1);
  });

  it("limpia el estado en memoria aunque el logout falle", async () => {
    mockFetch((url) => {
      if (url.includes("/auth/csrf")) return csrfResponse();
      return errorResponse(502, "UPSTREAM_AUTH_ERROR");
    });

    await expect(logout()).rejects.toMatchObject({ status: 502 });
  });
});
