import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { csrfResponse, errorResponse, jsonResponse, mockFetch, renderApp } from "@/test/utils";

const COTIZACION_V2 = {
  id: 7,
  code: "CTZ-V2-2026-000001",
  pricing_engine_version: "V2",
  status: "DRAFT",
  production_type: "RETAIL",
  customer_id: null,
  customer_name: null,
  name: "Pedido demo",
  notes: null,
  created_at: "2026-09-10T12:00:00Z",
  updated_at: "2026-09-10T12:00:00Z",
};

const LISTADO_VACIO = { items: [], total: 0 };

/** Resuelve sesión, CSRF y las rutas de V2; cualquier otra cosa es un fallo. */
function mockV2(
  overrides: Partial<{ list: Response; detail: Response; create: Response }> = {},
) {
  return mockFetch((url, init) => {
    if (url.includes("/auth/csrf")) return csrfResponse();
    if (url.includes("/auth/me")) return jsonResponse(200, { authenticated: true, user: USER });
    if (url.includes("/quotations-v2")) {
      if ((init.method ?? "GET") === "POST") {
        return overrides.create ?? jsonResponse(201, COTIZACION_V2);
      }
      if (/\/quotations-v2\/\d+$/.test(url.split("?")[0] ?? "")) {
        return overrides.detail ?? jsonResponse(200, COTIZACION_V2);
      }
      return overrides.list ?? jsonResponse(200, LISTADO_VACIO);
    }
    return errorResponse(404, "NOT_FOUND");
  });
}

const USER = {
  id: "11111111-2222-3333-4444-555555555555",
  email: "admin@empresa.com",
  display_name: "Administrador",
  role: "ADMIN" as const,
};

describe("Cotizador V2 (Fase 010A)", () => {
  it("tiene ruta propia y se identifica como motor V2", async () => {
    mockV2();

    renderApp(["/cotizador-v2"]);

    expect(await screen.findByRole("heading", { level: 1, name: /cotizador v2/i })).toBeInTheDocument();
    expect(screen.getAllByTestId("v2-engine-badge").length).toBeGreaterThan(0);
  });

  it("nunca llama a la ruta del Cotizador Legacy", async () => {
    const fetchSpy = mockV2();

    renderApp(["/cotizador-v2"]);
    await screen.findByRole("heading", { level: 1, name: /cotizador v2/i });

    const rutas = fetchSpy.mock.calls.map(([url]) => String(url));
    expect(rutas.some((ruta) => ruta.includes("/quotations-v2"))).toBe(true);
    expect(
      rutas.some((ruta) => /\/quotations(\?|$|\/)/.test(ruta) || ruta.includes("/quotation-builder")),
    ).toBe(false);
  });

  it("crea una cotización V2 y navega a su ficha", async () => {
    const user = userEvent.setup();
    const fetchSpy = mockV2();

    renderApp(["/cotizador-v2"]);
    await screen.findByRole("heading", { level: 1, name: /cotizador v2/i });

    await user.click(screen.getByRole("button", { name: /crear cotización v2/i }));

    await waitFor(() =>
      expect(screen.getByText(COTIZACION_V2.code)).toBeInTheDocument(),
    );
    const alta = fetchSpy.mock.calls.find(
      ([url, init]) =>
        String(url).includes("/quotations-v2") &&
        (init as RequestInit | undefined)?.method === "POST",
    );
    expect(alta).toBeDefined();
  });

  it("por menor es el tipo de producción por defecto", async () => {
    mockV2();

    renderApp(["/cotizador-v2"]);
    await screen.findByRole("heading", { level: 1, name: /cotizador v2/i });

    expect(screen.getByText("Por menor")).toBeInTheDocument();
  });

  it("la ficha muestra el motor persistido que devuelve el backend", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7"]);

    expect(await screen.findByText(COTIZACION_V2.code)).toBeInTheDocument();
    expect(screen.getByText("V2")).toBeInTheDocument();
  });

  it("una ficha inexistente no inventa nada: lo dice", async () => {
    mockV2({ detail: errorResponse(404, "V2_QUOTATION_NOT_FOUND") });

    renderApp(["/cotizador-v2/999"]);

    expect(await screen.findByText(/esa cotización v2 no existe/i)).toBeInTheDocument();
  });

  it("no muestra ningún importe: en 010A todavía no hay motor de cálculo", async () => {
    mockV2({ detail: jsonResponse(200, COTIZACION_V2) });

    renderApp(["/cotizador-v2/7"]);
    await screen.findByText(COTIZACION_V2.code);

    expect(screen.queryByText(/S\//)).not.toBeInTheDocument();
    expect(screen.queryByText(/IGV/i)).not.toBeInTheDocument();
  });
});
