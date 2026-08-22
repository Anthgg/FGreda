import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

import { AppRoutes } from "@/routes/AppRoutes";
import type { SessionUser } from "@/types/auth";

export const TEST_USER: SessionUser = {
  id: "11111111-2222-3333-4444-555555555555",
  email: "admin@empresa.com",
  display_name: "Administrador",
  role: "ADMIN",
};

export const CSRF_TOKEN = "token-csrf-de-prueba";

/** Construye una respuesta JSON equivalente a la del backend. */
export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Respuesta de error con el contrato uniforme de BGreda. */
export function errorResponse(status: number, code: string, message = "Error"): Response {
  return jsonResponse(status, { error: { code, message } });
}

export function sessionResponse(user: SessionUser = TEST_USER): Response {
  return jsonResponse(200, { authenticated: true, user });
}

export function csrfResponse(): Response {
  return jsonResponse(200, { csrf_token: CSRF_TOKEN, expires_in: 28_800 });
}

/**
 * Instala un doble de `fetch` que resuelve por ruta.
 *
 * Devuelve el espia para poder inspeccionar las llamadas realizadas.
 */
export function mockFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    return handler(url, init ?? {});
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

/** Renderiza la aplicacion completa con un cliente de consultas aislado. */
export function renderApp(initialEntries: string[] = ["/"]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { ...view, queryClient };
}

/** Renderiza un componente aislado con los proveedores minimos. */
export function renderWithProviders(ui: ReactElement, initialEntries: string[] = ["/"]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}
