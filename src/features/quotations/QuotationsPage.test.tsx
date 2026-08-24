import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { csrfResponse, errorResponse, jsonResponse, mockFetch, renderApp, sessionResponse, TEST_USER } from "@/test/utils";
import type { Product } from "@/types/masters";
import type { QuotationOut } from "@/types/quotations";

const finished: Product = {
  id: 42,
  internal_reference: "LAB50042",
  name: "Plato palta QA",
  product_type: "FINISHED_PRODUCT",
  product_category_id: 1,
  product_category_path: "Piezas",
  pos_category_id: null,
  pos_category_name: null,
  base_uom_code: "unit",
  purchase_uom_code: null,
  cost: null,
  sale_price: "459",
  sale_tax_rate: "0.18",
  purchase_tax_rate: null,
  sellable: true,
  purchasable: false,
  available_in_pos: true,
  active: true,
  notes: null,
};

const page = (items: unknown[] = []) => ({ items, total: items.length, limit: 200, offset: 0 });
const preview = {
  product_id: 42,
  product_internal_reference: "LAB50042",
  product_name: "Plato palta QA",
  quantity: 19,
  recipe_id: null,
  recipe_version_id: null,
  recipe_version_fingerprint_snapshot: null,
  firing_id: null,
  firing_line_id: null,
  firing_code_snapshot: null,
  firing_snapshot: {},
  materials_calculated: "0",
  materials_applied: "11.58",
  firing_cost: "0",
  labor_cost: "0",
  calculated_days: 0,
  days_adjustment: 0,
  waiting_days: 0,
  total_days: 0,
  space_cost: "257",
  commercial_factor_default_snapshot: "2",
  commercial_factor: "2",
  current_sale_price_snapshot: "459",
  base_commercial_cost: "11.58",
  calculated_total: "280.16",
  calculated_unit_price: "14.745263157894736842",
  materials_without_cost: [],
  material_grams_per_piece: "1",
  material_total_grams: "19",
  tax_percentage: "18",
  tax_rate_source: "COMMERCIAL_SETTINGS" as const,
  tax_amount: "50.4288",
  total_with_tax: "330.5888",
  unit_price_with_tax: "17.399410526315789474",
  source_fingerprint: "a".repeat(64),
  warnings: ["RECIPE_REQUIRED", "FIRING_LINE_REQUIRED"],
  // El contrato los fija como literales: ninguna fuente define la posicion del
  // IGV ni la regla de descuento, y el tipo lo deja dicho.
  igv_rule_source: "FOUND" as const,
  discount_rule_source: "NOT_FOUND" as const,
  techniques: [],
  additionals: [],
  other_costs: [],
};
const draftQuote: QuotationOut = {
  ...preview,
  id: 7,
  code: "CTZ-2026-000007",
  status: "DRAFT",
  created_by_id: TEST_USER.id,
  confirmed_at: null,
  cancelled_at: null,
  created_at: "2026-08-23T14:00:00Z",
  updated_at: "2026-08-23T14:00:00Z",
};

function quoteHandler(url: string, init: RequestInit) {
  if (url.includes("/auth/me")) return sessionResponse();
  if (url.includes("/auth/csrf")) return csrfResponse();
  if (url.includes("/products")) return jsonResponse(200, { items: [finished], total: 1, limit: 50, offset: 0 });
  if (url.includes("/techniques")) return jsonResponse(200, page([{ id: 1, code: "MANO", name: "A mano", unit_price: "110", formula_type: "ONE_FACTOR", factor_1: "15", factor_2: null, active: true, notes: null, created_at: "2026-08-23", updated_at: "2026-08-23" }]));
  if (url.includes("/additionals")) return jsonResponse(200, page([]));
  if (url.includes("/other-costs")) return jsonResponse(200, page([]));
  if (url.includes("/recipes")) return jsonResponse(200, page([]));
  if (url.includes("/firings")) return jsonResponse(200, page([]));
  if (url.includes("/quotations/calculate") && init.method === "POST") return jsonResponse(200, preview);
  if (url.includes("/quotations")) return jsonResponse(200, { items: [], total: 0, limit: 25, offset: 0 });
  return errorResponse(404, "NOT_FOUND");
}

describe("pantallas de cotizaciones", () => {
  it("renderiza el listado full-width, filtros React y estado vacío", async () => {
    mockFetch(quoteHandler);
    const { container } = renderApp(["/cotizaciones"]);

    expect(await screen.findByRole("heading", { name: "Cotizaciones." })).toBeInTheDocument();
    expect(await screen.findByText(/no hay cotizaciones/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /nueva cotización/i })).toHaveAttribute("href", "/cotizaciones/nueva");
    expect(container.querySelectorAll("select")).toHaveLength(0);
    expect(container.querySelectorAll('input[type="date"]')).toHaveLength(0);
    expect(container.firstElementChild?.querySelector(".w-full")).toBeInTheDocument();
  });

  it("muestra la página nueva, usa selector remoto y obtiene preview del backend", async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetch(quoteHandler);
    const { container } = renderApp(["/cotizaciones/nueva"]);

    expect(await screen.findByRole("heading", { name: "Nueva cotización" })).toBeInTheDocument();
    expect(screen.getByText("Resumen")).toBeInTheDocument();
    expect(container.querySelectorAll("select")).toHaveLength(0);
    expect(container.querySelectorAll('input[type="date"]')).toHaveLength(0);

    await user.click(screen.getByRole("combobox", { name: "Producto" }));
    await user.click(await screen.findByText("Plato palta QA"));
    await user.type(screen.getByLabelText(/Cantidad/i), "19");
    await user.type(screen.getByLabelText(/Costo de materiales a usar en el precio/i), "11.58");

    await waitFor(() => {
      expect(fetchSpy.mock.calls.some(([url]) => String(url).includes("/quotations/calculate"))).toBe(true);
    });
    expect(await screen.findByText("S/ 280.16")).toBeInTheDocument();
    expect(screen.getAllByText(/RECIPE_REQUIRED/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/FIRING_LINE_REQUIRED/).length).toBeGreaterThan(0);
  });

  it("oculta acciones de escritura para OPERATOR", async () => {
    mockFetch((url, init) => url.includes("/auth/me")
      ? sessionResponse({ ...TEST_USER, role: "OPERATOR" })
      : quoteHandler(url, init));
    renderApp(["/cotizaciones"]);
    expect(await screen.findByRole("heading", { name: "Cotizaciones." })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /nueva cotización/i })).not.toBeInTheDocument();
  });

  it("cubre detalle, confirmación con fuente obsoleta y anulación explícita", async () => {
    const user = userEvent.setup();
    let confirmCalls = 0;
    const fetchSpy = mockFetch((url, init) => {
      if (url.includes("/quotations/7/confirm")) {
        confirmCalls += 1;
        return confirmCalls === 1
          ? errorResponse(409, "SOURCE_CHANGED", "Las fuentes cambiaron")
          : jsonResponse(200, { ...draftQuote, status: "CONFIRMED", confirmed_at: "2026-08-23T15:00:00Z" });
      }
      if (url.includes("/quotations/7/cancel")) {
        return jsonResponse(200, { ...draftQuote, status: "CANCELLED", cancelled_at: "2026-08-23T15:00:00Z" });
      }
      if (url.includes("/quotations/7")) return jsonResponse(200, draftQuote);
      return quoteHandler(url, init);
    });
    renderApp(["/cotizaciones/7"]);

    expect(await screen.findByRole("heading", { name: draftQuote.code })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Editar" })).toHaveAttribute("href", "/cotizaciones/7/editar");
    expect(screen.getByText("S/ 280.16")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByRole("button", { name: /aceptar nuevas fuentes/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /aceptar nuevas fuentes/i }));
    await waitFor(() => expect(confirmCalls).toBe(2));

    await user.click(screen.getByRole("button", { name: "Anular" }));
    await user.click(screen.getByRole("button", { name: "Confirmar anulación" }));
    await waitFor(() => {
      expect(fetchSpy.mock.calls.some(([url]) => String(url).includes("/quotations/7/cancel"))).toBe(true);
    });
  });

  it("renderiza edición y muestra el error del backend sin quedar cargando", async () => {
    mockFetch((url, init) => {
      if (url.includes("/quotations/7")) return jsonResponse(200, draftQuote);
      return quoteHandler(url, init);
    });
    const rendered = renderApp(["/cotizaciones/7/editar"]);
    expect(await screen.findByRole("heading", { name: `Editar ${draftQuote.code}` })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeInTheDocument();
    rendered.unmount();

    mockFetch((url, init) => {
      if (url.includes("/quotations/8")) return errorResponse(500, "QUOTE_LOAD_FAILED", "No se pudo cargar");
      return quoteHandler(url, init);
    });
    renderApp(["/cotizaciones/8/editar"]);
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar");
  });

  it("pide confirmación antes de actualizar el precio del producto", async () => {
    const user = userEvent.setup();
    const confirmed = { ...draftQuote, status: "CONFIRMED" as const, confirmed_at: "2026-08-23T15:00:00Z" };
    const fetchSpy = mockFetch((url, init) => {
      if (url.includes("/quotations/7/update-product-price")) {
        return jsonResponse(200, { quotation_id: 7, product_id: 42, old_price: "459", new_price: preview.calculated_unit_price, updated_at: "2026-08-23T15:01:00Z" });
      }
      if (url.includes("/quotations/7")) return jsonResponse(200, confirmed);
      return quoteHandler(url, init);
    });
    renderApp(["/cotizaciones/7"]);

    await user.click(await screen.findByRole("button", { name: "Actualizar precio" }));
    expect(screen.getByText(/el costo del producto no cambiará/i)).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Actualizar precio" }).at(-1)!);
    expect(await screen.findByRole("status")).toHaveTextContent("Precio actualizado");
    expect(fetchSpy.mock.calls.some(([url]) => String(url).includes("update-product-price"))).toBe(true);
  });

  it("permite crear una técnica desde el propio selector, sin salir del formulario", async () => {
    const user = userEvent.setup();
    let creadas = 0;
    const panDeOro = {
      id: 99, code: "TEC-ORO", name: "Pan de oro", unit_price: "300",
      formula_type: "ONE_FACTOR", factor_1: "10", factor_2: null,
      active: true, notes: null, created_at: "2026-08-24", updated_at: "2026-08-24",
    };
    mockFetch((url, init) => {
      if (url.includes("/techniques") && init.method === "POST") {
        creadas += 1;
        return jsonResponse(201, panDeOro);
      }
      // Tras crearla, el maestro ya la incluye: es lo que hace el backend real
      // cuando la mutación invalida la consulta.
      if (url.includes("/techniques") && creadas > 0) {
        return jsonResponse(200, page([panDeOro]));
      }
      return quoteHandler(url, init);
    });
    renderApp(["/cotizaciones/nueva"]);

    await screen.findByRole("heading", { name: "Nueva cotización" });
    await user.click(screen.getByRole("combobox", { name: "Añadir técnica" }));

    // Se busca algo que no está en el maestro: en vez de un callejón sin
    // salida, el selector ofrece crearlo.
    const buscador = screen.getByPlaceholderText(/buscar opción/i);
    await user.type(buscador, "Pan de oro");
    await user.click(await screen.findByRole("button", { name: /crear técnica «Pan de oro»/i }));

    const dialogo = await screen.findByRole("dialog", { name: "Nueva técnica" });
    await user.type(within(dialogo).getByLabelText(/Precio unitario/i), "300");
    await user.type(within(dialogo).getByLabelText(/Factor 1/i), "10");
    await user.click(within(dialogo).getByRole("button", { name: /crear y usar/i }));

    await waitFor(() => expect(creadas).toBe(1));
    // Y queda añadida a la cotización, no solo guardada en el maestro.
    expect(await screen.findByText("Pan de oro")).toBeInTheDocument();
  });
});

describe("selector remoto de recetas", () => {
  /** Catálogo de 125 recetas: más de lo que cabe en una sola página. */
  const receta = (id: number) => ({
    id,
    product_id: 1000 + id,
    product_internal_reference: `LAB70${String(id).padStart(3, "0")}`,
    name: `BARNIZ ${id}`,
    active: true,
    current_version_id: id,
    current_version: null,
    versions: [],
    created_at: "2026-08-24T00:00:00Z",
    updated_at: "2026-08-24T00:00:00Z",
  });
  const CATALOGO = Array.from({ length: 125 }, (_, i) => receta(i + 1));

  function handlerConRecetas(url: string, init: RequestInit) {
    if (url.includes("/recipes")) {
      const u = new URL(url, "http://localhost");
      const limit = Number(u.searchParams.get("limit") ?? "50");
      const offset = Number(u.searchParams.get("offset") ?? "0");
      const search = (u.searchParams.get("search") ?? "").toLowerCase();
      const filtradas = search
        ? CATALOGO.filter((r) => r.name.toLowerCase().includes(search))
        : CATALOGO;
      return jsonResponse(200, {
        items: filtradas.slice(offset, offset + limit),
        total: filtradas.length,
        limit,
        offset,
      });
    }
    return quoteHandler(url, init);
  }

  it("pagina en el servidor y llega a la receta 125", async () => {
    const user = userEvent.setup();
    const spy = mockFetch(handlerConRecetas);
    renderApp(["/cotizaciones/nueva"]);

    await screen.findByRole("heading", { name: "Nueva cotización" });
    await user.click(screen.getByRole("combobox", { name: "Receta" }));

    // Primera página: cincuenta, no el catálogo entero.
    await screen.findByText("LAB70001 · BARNIZ 1");
    expect(screen.queryByText("LAB70051 · BARNIZ 51")).not.toBeInTheDocument();
    expect(
      spy.mock.calls.some(([u]) => String(u).includes("limit=50") && String(u).includes("offset=0")),
    ).toBe(true);

    await user.click(screen.getByRole("button", { name: /ver más \(50 de 125\)/i }));
    await screen.findByText("LAB70051 · BARNIZ 51");
    await waitFor(() =>
      expect(spy.mock.calls.some(([u]) => String(u).includes("offset=50"))).toBe(true),
    );

    await user.click(screen.getByRole("button", { name: /ver más \(100 de 125\)/i }));
    await waitFor(() =>
      expect(spy.mock.calls.some(([u]) => String(u).includes("offset=100"))).toBe(true),
    );

    // La 125 existe y se puede elegir: no se asume un máximo de cien.
    await user.click(await screen.findByText("LAB70125 · BARNIZ 125"));
    expect(screen.getByRole("combobox", { name: "Receta" })).toHaveTextContent(
      "LAB70125 · BARNIZ 125",
    );
  });

  it("la búsqueda viaja al servidor", async () => {
    const user = userEvent.setup();
    const spy = mockFetch(handlerConRecetas);
    renderApp(["/cotizaciones/nueva"]);

    await screen.findByRole("heading", { name: "Nueva cotización" });
    await user.click(screen.getByRole("combobox", { name: "Receta" }));
    await user.type(screen.getByLabelText(/buscar receta/i), "BARNIZ 77");

    await waitFor(
      () => expect(spy.mock.calls.some(([u]) => String(u).includes("search=BARNIZ+77"))).toBe(true),
      { timeout: 3000 },
    );
  });

  it("avisa de que faltan los gramos por pieza y no supone ninguno", async () => {
    mockFetch((url, init) =>
      url.includes("/quotations/calculate")
        ? jsonResponse(200, {
            ...preview,
            material_grams_per_piece: null,
            material_total_grams: null,
            materials_calculated: "0",
            warnings: ["MATERIAL_GRAMS_PER_PIECE_REQUIRED"],
          })
        : quoteHandler(url, init),
    );
    const user = userEvent.setup();
    renderApp(["/cotizaciones/nueva"]);

    await screen.findByRole("heading", { name: "Nueva cotización" });
    // Sin producto ni cantidad no hay vista previa que avisar.
    await user.click(screen.getByRole("combobox", { name: "Producto" }));
    await user.click(await screen.findByText("Plato palta QA"));
    await user.type(screen.getByLabelText(/Cantidad/i), "19");

    expect(
      await screen.findByText(/cuántos gramos de receta lleva una pieza/i),
    ).toBeInTheDocument();
  });
});
