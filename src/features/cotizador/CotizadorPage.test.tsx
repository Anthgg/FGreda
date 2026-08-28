import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  csrfResponse,
  errorResponse,
  jsonResponse,
  mockFetch,
  renderApp,
  sessionResponse,
} from "@/test/utils";
import { KILNS_PAGE } from "@/test/firingsFixtures";
import type { Product } from "@/types/masters";
import type { QuotationBuilderOut } from "@/types/quotationBuilder";

const product: Product = {
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
  sale_price: null,
  sale_tax_rate: null,
  purchase_tax_rate: null,
  material: "Gres",
  grammage: "420",
  width: "20",
  height: null,
  length: "20",
  depth: null,
  sellable: true,
  purchasable: false,
  available_in_pos: true,
  active: true,
  notes: null,
};
const secondProduct: Product = { ...product, id: 43, internal_reference: "LAB50043", name: "Bowl mediano", width: "18", length: "18" };

function itemOut(input: Record<string, unknown>, index: number) {
  const productId = Number(input.product_id);
  const selected = productId === secondProduct.id ? secondProduct : product;
  const dimensions = (input.dimensions ?? {}) as Record<string, string>;
  const quantity = typeof input.quantity === "number" ? input.quantity : null;
  const grams = typeof input.material_grams_per_piece === "string" ? input.material_grams_per_piece : null;
  return {
    id: null,
    product_id: productId,
    product_internal_reference: selected.internal_reference,
    product_name: selected.name,
    product_type: selected.product_type,
    product_uom: selected.base_uom_code,
    product_material: selected.material ?? null,
    product_grammage: selected.grammage == null ? null : String(selected.grammage),
    width: dimensions.width ?? String(selected.width),
    height: dimensions.height ?? null,
    length: dimensions.length ?? String(selected.length),
    depth: dimensions.depth ?? null,
    standard_width: String(selected.width),
    standard_height: null,
    standard_length: String(selected.length),
    standard_depth: null,
    editable_dimensions: ["height", "depth"] as Array<"height" | "depth">,
    dimensions_overridden: false,
    quantity,
    recipe_id: null,
    recipe_version_id: null,
    recipe_version_fingerprint_snapshot: null,
    recipe_auto_selected: false,
    material_grams_per_piece: grams,
    firing_id: null,
    firing_line_id: typeof input.firing_line_id === "number" ? input.firing_line_id : null,
    firing_code_snapshot: typeof input.firing_line_id === "number" ? "HR-2026-000001" : null,
    kiln_id: null,
    low_kiln_id: typeof input.low_kiln_id === "number" ? input.low_kiln_id : null,
    high_kiln_id: typeof input.high_kiln_id === "number" ? input.high_kiln_id : null,
    factor_kiln_id: typeof input.factor_kiln_id === "number" ? input.factor_kiln_id : null,
    production_snapshot: {},
    techniques: [],
    additionals: [],
    other_costs: [],
    materials_calculated: "18.40",
    materials_applied: "18.40",
    firing_cost: "96",
    labor_cost: "48",
    calculated_days: 2,
    days_adjustment: 0,
    waiting_days: 0,
    total_days: 2,
    space_cost: "30",
    final_unit_cost: "16.02",
    final_total_cost: "384.48",
    markup_percent: String(input.markup_percent ?? "100"),
    calculated_sale_unit_price: "32.04",
    suggested_commercial_unit_price: "32.10",
    commercial_sale_unit_price_input:
      input.commercial_sale_unit_price === null || input.commercial_sale_unit_price === undefined
        ? null
        : String(input.commercial_sale_unit_price),
    commercial_sale_unit_price: String(input.commercial_sale_unit_price ?? "32.10"),
    effective_profit_unit: "16.08",
    effective_profit_total: "385.92",
    effective_markup_percent: "100.37",
    commercial_subtotal: "770.40",
    commercial_unit_price_with_tax: "37.878",
    commercial_total: "909.072",
    tax_percentage_snapshot: "18",
    tax_rate_source_snapshot: "COMMERCIAL_SETTINGS",
    tax_amount: "138.672",
    source_fingerprint: "i".repeat(64),
    warnings: [],
    complete: Boolean(quantity && grams),
    sort_order: index,
  };
}

function builder(overrides: Partial<QuotationBuilderOut> = {}): QuotationBuilderOut {
  return {
    id: null,
    code: null,
    workflow: "COTIZADOR",
    status: "DRAFT",
    name: null,
    customer_id: null,
    customer_name_snapshot: null,
    kiln_id: null,
    kiln_snapshot: {},
    production_summary: {},
    items: [],
    item_count: 0,
    commercial_subtotal: "0",
    tax_percentage_snapshot: "18",
    tax_rate_source_snapshot: "COMMERCIAL_SETTINGS",
    tax_amount: "0",
    total_with_tax: "0",
    currency_code_snapshot: "PEN",
    currency_symbol_snapshot: "S/",
    warnings: ["QUOTATION_NAME_REQUIRED", "CUSTOMER_REQUIRED"],
    complete: false,
    next_step: "GENERAL_DATA",
    source_fingerprint: "q".repeat(64),
    created_at: null,
    updated_at: null,
    confirmed_at: null,
    cancelled_at: null,
    ...overrides,
  };
}

function handler(url: string, init: RequestInit) {
  if (url.includes("/auth/me")) return sessionResponse();
  if (url.includes("/auth/csrf")) return csrfResponse();
  if (url.includes("/partners")) return jsonResponse(200, { items: [], total: 0, limit: 100, offset: 0 });
  if (url.includes("/kilns")) return jsonResponse(200, KILNS_PAGE);
  if (url.includes("/firing-lines")) return jsonResponse(200, { items: [], total: 0, limit: 100, offset: 0 });
  if (url.includes("/products")) return jsonResponse(200, { items: [product, secondProduct], total: 2, limit: 50, offset: 0 });
  if (url.includes("/techniques") || url.includes("/additionals") || url.includes("/other-costs")) return jsonResponse(200, { items: [], total: 0, limit: 200, offset: 0 });
  if (url.includes("/quotation-builder/preview") && init.method === "POST") {
    const body = JSON.parse(String(init.body)) as { name?: string; customer_id?: number; items?: Array<Record<string, unknown>>; kiln_id?: number };
    const items = (body.items ?? []).map(itemOut);
    const complete = Boolean(body.name && body.customer_id && body.kiln_id && items.length && items.every((item) => item.complete));
    // Fase 009C: el mock refleja la seleccion real de quemas y devuelve el
    // plan de hornadas, para que los tests midan lo que la UI hara en
    // produccion y no una respuesta fija.
    const sessions = (body.items ?? []).flatMap((item) => {
      const lowKiln = (item["low_kiln_id"] as number | undefined) ?? body.kiln_id;
      const highKiln = (item["high_kiln_id"] as number | undefined) ?? body.kiln_id;
      const batches = Number(item["quantity"] ?? 1) > 20 ? 3 : 1;
      return [
        item["low_kiln_selected"] !== false && lowKiln
          ? { firing_type: "LOW", kiln_id: lowKiln, batches, subtotal: String(350 * batches), capacity_snapshot: "17000.000000", physical_occupancy_percentage: "42.000000" }
          : null,
        item["high_kiln_selected"] !== false && highKiln
          ? { firing_type: "HIGH", kiln_id: highKiln, batches, subtotal: String(500 * batches), capacity_snapshot: "17000.000000", physical_occupancy_percentage: "42.000000" }
          : null,
      ].filter((value) => value !== null);
    });
    return jsonResponse(200, builder({
      name: body.name ?? null,
      customer_id: body.customer_id ?? null,
      items,
      item_count: items.length,
      production_summary: {
        sessions,
        total_batches: sessions.reduce((sum, session) => sum + session.batches, 0),
      },
      kiln_id: body.kiln_id ?? null,
      commercial_subtotal: items.length ? "770.40" : "0",
      tax_amount: items.length ? "138.672" : "0",
      total_with_tax: items.length ? "909.072" : "0",
      complete,
      next_step: complete ? "SUMMARY" : "PRODUCTION",
    }));
  }
  if (url.endsWith("/quotation-builder") && init.method === "POST") return jsonResponse(201, builder({ id: 81, code: "CTZ-2026-000081", created_at: "2026-08-24T12:00:00Z", updated_at: "2026-08-24T12:00:00Z" }));
  return errorResponse(404, "NOT_FOUND");
}

describe("Cotizador integral", () => {
  it("D2: bloquea Siguiente en Datos sin cliente y avanza al completarlo", async () => {
    const user = userEvent.setup();
    mockFetch((url, init) => {
      if (url.includes("/partners")) {
        return jsonResponse(200, {
          items: [{ id: 7, name: "Restaurante Lima", role: "CLIENT", document_type: "RUC", document_number: "20111111111", active: true }],
          total: 1,
          limit: 100,
          offset: 0,
        });
      }
      return handler(url, init);
    });
    renderApp(["/cotizador/nuevo"]);
    await screen.findByRole("heading", { name: "Nuevo cotizador." });

    // Sin nombre ni cliente: Siguiente no debe avanzar.
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByRole("heading", { name: "Nuevo cotizador." })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Selecciona un cliente para continuar.");
    expect(screen.queryByRole("button", { name: /Agregar producto/i })).not.toBeInTheDocument();

    // Con nombre pero sin cliente: sigue bloqueado.
    await user.type(screen.getByLabelText(/Nombre \/ referencia/i), "Vajilla QA");
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByRole("heading", { name: "Nuevo cotizador." })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Selecciona un cliente para continuar.");

    // Al elegir cliente, Siguiente ya avanza a Piezas.
    await user.click(screen.getByRole("combobox", { name: "Cliente" }));
    await user.click(await screen.findByText("Restaurante Lima · 20111111111"));
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(await screen.findByRole("button", { name: /Agregar producto/i })).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------
  // Fase 009C — quemas opcionales, multi-hornada y dias
  // ---------------------------------------------------------------------

  /** Deja una pieza lista y abre el paso Produccion. */
  async function openProduction(user: ReturnType<typeof userEvent.setup>) {
    await screen.findByRole("heading", { name: "Nuevo cotizador." });
    await user.click(screen.getByRole("button", { name: /Piezas/i }));
    await user.click(screen.getByRole("button", { name: /Agregar producto/i }));
    await user.click(screen.getByRole("combobox", { name: "Pieza terminada" }));
    await user.click(await screen.findByText("Plato palta QA"));
    await user.click(screen.getByRole("button", { name: /Producción/i }));
  }

  it("LOW_TOGGLE + HIGH_TOGGLE: ambas quemas arrancan marcadas y son independientes", async () => {
    const user = userEvent.setup();
    mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);
    await openProduction(user);

    const low = screen.getByRole("checkbox", { name: "Quema baja" });
    const high = screen.getByRole("checkbox", { name: "Quema alta" });
    expect(low).toBeChecked();
    expect(high).toBeChecked();

    // Desmarcar una NO desmarca la otra: no son mutuamente excluyentes.
    await user.click(low);
    expect(low).not.toBeChecked();
    expect(high).toBeChecked();
  });

  it("LOW_ONLY: sin quema alta, su horno desaparece y el payload lo refleja", async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);
    await openProduction(user);

    await user.click(screen.getByRole("checkbox", { name: "Quema alta" }));

    expect(screen.getByRole("combobox", { name: "Horno de quema baja" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Horno de quema alta" })).not.toBeInTheDocument();

    await waitFor(() => {
      const previews = fetchSpy.mock.calls.filter(([url]) =>
        String(url).includes("/quotation-builder/preview"),
      );
      const body = JSON.parse(
        String((previews.at(-1)?.[1] as RequestInit | undefined)?.body),
      ) as { items: Array<Record<string, unknown>> };
      expect(body.items[0]).toMatchObject({
        low_kiln_selected: true,
        high_kiln_selected: false,
      });
    });
  });

  it("HIGH_ONLY: sin quema baja, su horno desaparece y el payload lo refleja", async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);
    await openProduction(user);

    await user.click(screen.getByRole("checkbox", { name: "Quema baja" }));

    expect(screen.queryByRole("combobox", { name: "Horno de quema baja" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Horno de quema alta" })).toBeInTheDocument();

    await waitFor(() => {
      const previews = fetchSpy.mock.calls.filter(([url]) =>
        String(url).includes("/quotation-builder/preview"),
      );
      const body = JSON.parse(
        String((previews.at(-1)?.[1] as RequestInit | undefined)?.body),
      ) as { items: Array<Record<string, unknown>> };
      expect(body.items[0]).toMatchObject({
        low_kiln_selected: false,
        high_kiln_selected: true,
      });
    });
  });

  it("VALIDATION: sin ninguna quema seleccionada se avisa que hace falta al menos una", async () => {
    const user = userEvent.setup();
    mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);
    await openProduction(user);

    await user.click(screen.getByRole("checkbox", { name: "Quema baja" }));
    await user.click(screen.getByRole("checkbox", { name: "Quema alta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /seleccione al menos una quema/i,
    );
  });

  it("LOW_HIGH + BATCH_COUNT_DISPLAY + COST_MULTIPLICATION + PRODUCTION_DAYS_DISPLAY", async () => {
    const user = userEvent.setup();
    mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);
    await openProduction(user);

    await user.click(screen.getByRole("combobox", { name: "Horno de quema baja" }));
    await user.click(await screen.findByRole("option", { name: /KILN-001/i }));
    await user.click(screen.getByRole("combobox", { name: "Horno de quema alta" }));
    await user.click(await screen.findByRole("option", { name: /KILN-002/i }));

    // Con cantidad <= 20 el mock devuelve 1 hornada por quema: 2 en total,
    // 6 dias, y el costo de cada quema es el de una sola hornada.
    await waitFor(() => {
      expect(screen.getAllByText("Hornadas necesarias").length).toBe(2);
    });
    const hornadas = screen.getAllByText("Hornadas necesarias");
    for (const label of hornadas) {
      expect(label.nextElementSibling).toHaveTextContent("1");
    }
    expect(screen.getAllByText("Tiempo")[0]?.nextElementSibling).toHaveTextContent("3 días");
  });

  it("COST_MULTIPLICATION: mas hornadas multiplican el costo y los dias", async () => {
    const user = userEvent.setup();
    mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);
    await openProduction(user);

    await user.click(screen.getByRole("combobox", { name: "Horno de quema baja" }));
    await user.click(await screen.findByRole("option", { name: /KILN-001/i }));
    await user.click(screen.getByRole("checkbox", { name: "Quema alta" }));

    // El mock devuelve 3 hornadas cuando la cantidad supera 20.
    const cantidad = screen.getByPlaceholderText("Ej. 24");
    await user.clear(cantidad);
    await user.type(cantidad, "50");

    await waitFor(() => {
      expect(screen.getByText("Hornadas necesarias").nextElementSibling).toHaveTextContent("3");
    });
    // 350 por hornada x 3 = 1050, y 3 x 3 dias = 9.
    expect(screen.getByText("Costo / hornada").nextElementSibling).toHaveTextContent("350");
    expect(screen.getByText("Total de la quema").nextElementSibling).toHaveTextContent("1050");
    expect(screen.getByText("Tiempo").nextElementSibling).toHaveTextContent("9 días");
    expect(screen.getByText(/Total 3 hornadas/i)).toBeInTheDocument();
  });

  it("MULTIPRODUCT: cada linea mantiene su propia seleccion de quemas", async () => {
    const user = userEvent.setup();
    mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);
    await openProduction(user);

    // Segunda pieza desde el paso Piezas.
    await user.click(screen.getByRole("button", { name: /Piezas/i }));
    await user.click(screen.getByRole("button", { name: /Agregar producto/i }));
    const selectors = screen.getAllByRole("combobox", { name: "Pieza terminada" });
    await user.click(selectors[1]!);
    await user.click(await screen.findByText("Bowl mediano"));
    await user.click(screen.getByRole("button", { name: /Producción/i }));

    const lowChecks = screen.getAllByRole("checkbox", { name: "Quema baja" });
    expect(lowChecks).toHaveLength(2);

    // Solo la segunda linea deja de usar quema baja.
    await user.click(lowChecks[1]!);
    expect(lowChecks[0]).toBeChecked();
    expect(lowChecks[1]).not.toBeChecked();
  });

  it("expone seis etapas separadas de Cotizaciones y sólo solicita preview al backend", async () => {
    const fetchSpy = mockFetch(handler);
    const { container } = renderApp(["/cotizador/nuevo"]);

    expect(await screen.findByRole("heading", { name: "Nuevo cotizador." })).toBeInTheDocument();
    for (const step of ["Datos", "Piezas", "Producción", "Costeo", "Margen y precio", "Resumen"]) {
      expect(screen.getByRole("button", { name: new RegExp(step, "i") })).toBeInTheDocument();
    }
    await waitFor(() => expect(fetchSpy.mock.calls.some(([url]) => String(url).includes("/quotation-builder/preview"))).toBe(true));
    expect(fetchSpy.mock.calls.some(([url]) => String(url).includes("/firings/calculate"))).toBe(false);
    expect(container.querySelectorAll("select")).toHaveLength(0);
  });

  it("permite agregar una pieza y bloquea dimensiones ya definidas en el maestro", async () => {
    const user = userEvent.setup();
    mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);

    await screen.findByRole("heading", { name: "Nuevo cotizador." });
    await user.click(screen.getByRole("button", { name: /Piezas/i }));
    await user.click(screen.getByRole("button", { name: /Agregar producto/i }));
    await user.click(screen.getByRole("combobox", { name: "Pieza terminada" }));
    await user.click(await screen.findByText("Plato palta QA"));

    expect(screen.getByRole("combobox", { name: "Pieza terminada" })).toHaveTextContent("LAB50042 · Plato palta QA");
    expect(await screen.findByLabelText(/Ancho \(cm\)/i)).toBeDisabled();
    expect(screen.getByLabelText(/Largo \(cm\)/i)).toBeDisabled();
    expect(screen.getByLabelText(/Alto \(cm\)/i)).toBeEnabled();
    expect(screen.getByLabelText(/Profundidad \(cm\)/i)).toBeEnabled();
    // Fase 009B: por defecto la linea arranca en modo estandar; el aviso de
    // "solo se habilitan datos ausentes" se reemplazo por el badge de modo.
    expect(screen.getByText("Medidas estándar")).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------
  // Fase 009B — medidas personalizadas por linea de cotizacion
  // ---------------------------------------------------------------------

  /** Agrega una pieza en el paso Piezas y devuelve el helper de usuario. */
  async function addPiece(user: ReturnType<typeof userEvent.setup>, label = "Plato palta QA") {
    await screen.findByRole("heading", { name: "Nuevo cotizador." });
    await user.click(screen.getByRole("button", { name: /Piezas/i }));
    await user.click(screen.getByRole("button", { name: /Agregar producto/i }));
    await user.click(screen.getByRole("combobox", { name: "Pieza terminada" }));
    await user.click(await screen.findByText(label));
  }

  it("STANDARD_MODE_DEFAULT: una pieza nueva arranca en modo estándar", async () => {
    const user = userEvent.setup();
    mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);
    await addPiece(user);

    expect(screen.getByRole("radio", { name: /Usar medidas estándar/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Personalizar medidas/i })).not.toBeChecked();
    expect(screen.getByText("Medidas estándar")).toBeInTheDocument();
    // Las medidas que el maestro sí define quedan protegidas.
    expect(screen.getByLabelText(/Ancho \(cm\)/i)).toBeDisabled();
  });

  it("CUSTOM_MODE_ENABLED + CUSTOM_PREFILLS_STANDARD: activar personalizar prellena con el maestro", async () => {
    const user = userEvent.setup();
    mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);
    await addPiece(user);

    await user.click(screen.getByRole("radio", { name: /Personalizar medidas/i }));

    expect(screen.getByRole("radio", { name: /Personalizar medidas/i })).toBeChecked();
    expect(screen.getByText("Medidas personalizadas")).toBeInTheDocument();
    // Prellenado con el estandar del maestro (width=20, length=20), para que
    // el usuario solo ajuste lo que necesita.
    expect(screen.getByLabelText(/Ancho \(cm\)/i)).toHaveValue("20");
    expect(screen.getByLabelText(/Largo \(cm\)/i)).toHaveValue("20");
  });

  it("CUSTOM_EDITABLE: en modo personalizado toda dimensión es editable", async () => {
    const user = userEvent.setup();
    mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);
    await addPiece(user);
    await user.click(screen.getByRole("radio", { name: /Personalizar medidas/i }));

    // Ancho y Largo venian bloqueados por el maestro en modo estandar.
    for (const label of [/Ancho \(cm\)/i, /Alto \(cm\)/i, /Largo \(cm\)/i, /Profundidad \(cm\)/i]) {
      expect(screen.getByLabelText(label)).toBeEnabled();
    }

    const ancho = screen.getByLabelText(/Ancho \(cm\)/i);
    await user.clear(ancho);
    await user.type(ancho, "15");
    expect(ancho).toHaveValue("15");
  });

  it("RETURN_TO_STANDARD: volver a estándar restaura exactamente el maestro", async () => {
    const user = userEvent.setup();
    mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);
    await addPiece(user);

    await user.click(screen.getByRole("radio", { name: /Personalizar medidas/i }));
    const ancho = screen.getByLabelText(/Ancho \(cm\)/i);
    await user.clear(ancho);
    await user.type(ancho, "15");
    expect(screen.getByLabelText(/Ancho \(cm\)/i)).toHaveValue("15");

    await user.click(screen.getByRole("radio", { name: /Usar medidas estándar/i }));

    expect(screen.getByLabelText(/Ancho \(cm\)/i)).toHaveValue("20");
    expect(screen.getByLabelText(/Ancho \(cm\)/i)).toBeDisabled();
    expect(screen.getByText("Medidas estándar")).toBeInTheDocument();
  });

  it("VALIDATION_REQUIRED: una dimensión <= 0 muestra error inline", async () => {
    const user = userEvent.setup();
    mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);
    await addPiece(user);
    await user.click(screen.getByRole("radio", { name: /Personalizar medidas/i }));

    const ancho = screen.getByLabelText(/Ancho \(cm\)/i);
    await user.clear(ancho);
    await user.type(ancho, "0");
    expect(await screen.findByText("Debe ser mayor que 0.")).toBeInTheDocument();

    await user.clear(ancho);
    await user.type(ancho, "-3");
    expect(screen.getByText("Debe ser mayor que 0.")).toBeInTheDocument();

    await user.clear(ancho);
    await user.type(ancho, "15");
    expect(screen.queryByText("Debe ser mayor que 0.")).not.toBeInTheDocument();
  });

  it("MULTIPRODUCT_INDEPENDENT: cada línea mantiene su propio modo de medidas", async () => {
    const user = userEvent.setup();
    mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);
    await addPiece(user);

    // Segunda pieza, producto distinto.
    await user.click(screen.getByRole("button", { name: /Agregar producto/i }));
    const selectors = screen.getAllByRole("combobox", { name: "Pieza terminada" });
    await user.click(selectors[1]!);
    await user.click(await screen.findByText("Bowl mediano"));

    // Solo la SEGUNDA linea pasa a personalizada.
    const customRadios = screen.getAllByRole("radio", { name: /Personalizar medidas/i });
    expect(customRadios).toHaveLength(2);
    await user.click(customRadios[1]!);

    const standardRadios = screen.getAllByRole("radio", { name: /Usar medidas estándar/i });
    expect(standardRadios[0]).toBeChecked();
    expect(customRadios[1]).toBeChecked();
    expect(customRadios[0]).not.toBeChecked();
    expect(screen.getByText("Medidas personalizadas")).toBeInTheDocument();
    expect(screen.getByText("Medidas estándar")).toBeInTheDocument();
  });

  it("SAVE_REOPEN_PRESERVED: el payload envía las medidas efectivas y dimensions_overridden", async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);

    // El cliente no hace falta aqui: lo que se verifica es la forma del
    // payload de medidas, que el preview envia igual con la cotizacion aun
    // incompleta.
    await addPiece(user);
    await user.click(screen.getByRole("radio", { name: /Personalizar medidas/i }));
    const ancho = screen.getByLabelText(/Ancho \(cm\)/i);
    await user.clear(ancho);
    await user.type(ancho, "15");

    await waitFor(() => {
      const previewCall = [...fetchSpy.mock.calls]
        .reverse()
        .find(([url]) => String(url).includes("/quotation-builder/preview"));
      expect(previewCall).toBeDefined();
      const body = JSON.parse(String((previewCall![1] as RequestInit).body)) as {
        items: Array<{ dimensions: Record<string, string>; dimensions_overridden: boolean }>;
      };
      expect(body.items[0]!.dimensions_overridden).toBe(true);
      // En modo personalizado viajan TODAS las medidas con valor, no solo
      // las ausentes en el maestro.
      expect(body.items[0]!.dimensions.width).toBe("15");
      expect(body.items[0]!.dimensions.length).toBe("20");
    });
  });

  it("crea un DRAFT progresivo mediante el endpoint dedicado", async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);

    await screen.findByRole("heading", { name: "Nuevo cotizador." });
    await user.click(screen.getByRole("button", { name: "Crear borrador" }));
    await waitFor(() => expect(fetchSpy.mock.calls.some(([url, init]) => String(url).endsWith("/quotation-builder") && (init as RequestInit).method === "POST")).toBe(true));
    expect(await screen.findByRole("heading", { name: "CTZ-2026-000081" })).toBeInTheDocument();

    const createCall = fetchSpy.mock.calls.find(([url, init]) => String(url).endsWith("/quotation-builder") && (init as RequestInit).method === "POST");
    expect(createCall).toBeTruthy();
    expect(JSON.parse(String((createCall?.[1] as RequestInit).body))).toMatchObject({ items: [] });
  });

  it("administra múltiples piezas y conserva markup y precio por producto en el payload", async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);

    await screen.findByRole("heading", { name: "Nuevo cotizador." });
    await user.click(screen.getByRole("button", { name: /Piezas/i }));
    await user.click(screen.getByRole("button", { name: /Agregar producto/i }));
    await user.click(screen.getByRole("combobox", { name: "Pieza terminada" }));
    await user.click(await screen.findByText("Plato palta QA"));
    await user.click(screen.getByRole("button", { name: /Agregar producto/i }));
    const pieceSelectors = screen.getAllByRole("combobox", { name: "Pieza terminada" });
    await user.click(pieceSelectors[1]!);
    await user.click(await screen.findByText("Bowl mediano"));
    expect(screen.getAllByText("LAB50042 · Plato palta QA").length).toBeGreaterThan(0);
    expect(screen.getAllByText("LAB50043 · Bowl mediano").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /Margen y precio/i }));
    const markups = screen.getAllByLabelText(/Markup/i);
    const prices = screen.getAllByLabelText(/Precio comercial unitario/i);
    await user.clear(markups[0]!);
    await user.type(markups[0]!, "120");
    await user.clear(markups[1]!);
    await user.type(markups[1]!, "80");
    await user.type(prices[0]!, "35.50");
    await user.type(prices[1]!, "28.90");

    await waitFor(() => {
      const previews = fetchSpy.mock.calls.filter(([url]) => String(url).includes("/quotation-builder/preview"));
      const lastBody = JSON.parse(String((previews.at(-1)?.[1] as RequestInit | undefined)?.body)) as { items: Array<Record<string, unknown>> };
      expect(lastBody.items).toHaveLength(2);
      expect(lastBody.items[0]).toMatchObject({ markup_percent: "120", commercial_sale_unit_price: "35.50" });
      expect(lastBody.items[1]).toMatchObject({ markup_percent: "80", commercial_sale_unit_price: "28.90" });
    });

    await user.click(screen.getByRole("button", { name: /Piezas/i }));
    await user.click(screen.getAllByRole("button", { name: "Quitar" })[0]!);
    expect(screen.queryAllByText("LAB50042 · Plato palta QA")).toHaveLength(0);
    expect(screen.getAllByText("LAB50043 · Bowl mediano").length).toBeGreaterThan(0);
  });

  it("configura baja, alta y factor por producto como en Costo de quema", async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);

    await screen.findByRole("heading", { name: "Nuevo cotizador." });
    await user.click(screen.getByRole("button", { name: /Piezas/i }));
    await user.click(screen.getByRole("button", { name: /Agregar producto/i }));
    await user.click(screen.getByRole("combobox", { name: "Pieza terminada" }));
    await user.click(await screen.findByText("Plato palta QA"));

    await user.click(screen.getByRole("button", { name: /Producción/i }));
    expect(screen.queryByRole("combobox", { name: /Horno para simulación/i })).not.toBeInTheDocument();

    // Fase 009C: los hornos viven dentro del toggle de cada quema, que ya
    // viene marcado por defecto (baja + alta, como antes de la fase).
    await user.click(screen.getByRole("combobox", { name: "Horno de quema baja" }));
    await user.click(await screen.findByRole("option", { name: /KILN-001/i }));
    await user.click(screen.getByRole("combobox", { name: "Horno de quema alta" }));
    await user.click(await screen.findByRole("option", { name: /KILN-002/i }));
    await user.click(screen.getByRole("combobox", { name: "Ocupación medida en" }));
    await user.click(await screen.findByRole("option", { name: /KILN-001/i }));

    await waitFor(() => {
      const previews = fetchSpy.mock.calls.filter(([url]) =>
        String(url).includes("/quotation-builder/preview"),
      );
      const lastBody = JSON.parse(
        String((previews.at(-1)?.[1] as RequestInit | undefined)?.body),
      ) as { items: Array<Record<string, unknown>> };
      expect(lastBody.items[0]).toMatchObject({
        low_kiln_id: 1,
        high_kiln_id: 2,
        factor_kiln_id: 1,
      });
    });
  });

  it("reabre, confirma con versión esperada y bloquea la edición posterior", async () => {
    const user = userEvent.setup();
    const updatedAt = "2026-08-24T12:00:00Z";
    const saved = builder({
      id: 81,
      code: "CTZ-2026-000081",
      name: "Vajilla agosto",
      customer_id: 7,
      customer_name_snapshot: "Restaurante Lima",
      kiln_id: 3,
      items: [itemOut({ product_id: 42, quantity: 24, material_grams_per_piece: "450", markup_percent: "120", commercial_sale_unit_price: "35.50" }, 0)],
      item_count: 1,
      complete: true,
      next_step: "SUMMARY",
      created_at: updatedAt,
      updated_at: updatedAt,
    });
    const fetchSpy = mockFetch((url, init) => {
      if (url.includes("/quotation-builder/81/confirm") && init.method === "POST") {
        return jsonResponse(200, { ...saved, status: "CONFIRMED", confirmed_at: "2026-08-24T13:00:00Z" });
      }
      if (url.includes("/quotation-builder/81") && init.method === "GET") return jsonResponse(200, saved);
      if (url.includes("/quotation-builder/pdf-preview") || url.includes("/pdf-preview")) {
        return new Response(new Blob(["%PDF-1.4 mock preview"], { type: "application/pdf" }), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": 'inline; filename="CTZ-2026-000081_Restaurante_Lima.pdf"',
          },
        });
      }
      if (url.includes("/quotations/81/pdf")) {
        return new Response(new Blob(["%PDF-1.4 mock official"], { type: "application/pdf" }), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": 'inline; filename="CTZ-2026-000081_Restaurante_Lima.pdf"',
          },
        });
      }
      return handler(url, init);
    });
    renderApp(["/cotizador/81"]);

    expect(await screen.findByRole("heading", { name: "CTZ-2026-000081" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /PDF/i }));
    const confirmButton = await screen.findByRole("button", { name: "Confirmar cotización" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    await user.click(confirmButton);

    // Modal de confirmacion
    const modal = await screen.findByRole("dialog", { name: "Confirmar cotización" });
    expect(modal).toHaveTextContent(/Al confirmar, la cotización quedará congelada y ya no podrá editarse/i);
    const modalConfirmBtn = within(modal).getByRole("button", { name: "Confirmar cotización" });
    await user.click(modalConfirmBtn);

    expect((await screen.findAllByText("Confirmada"))[0]).toBeInTheDocument();

    const confirmCall = fetchSpy.mock.calls.find(([url]) => String(url).includes("/quotation-builder/81/confirm"));
    expect(JSON.parse(String((confirmCall?.[1] as RequestInit).body))).toEqual({ expected_updated_at: updatedAt });
    expect(screen.queryByRole("button", { name: /Guardar borrador/i })).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Descargar PDF/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Datos/i }));
    expect(screen.getByLabelText(/Nombre \/ referencia/i)).toBeDisabled();
  });

  it("mantiene el snapshot inmutable y reinicia el estado al navegar a un alta nueva", async () => {
    const user = userEvent.setup();
    const saved = builder({
      id: 81,
      code: "CTZ-2026-000081",
      status: "CONFIRMED",
      name: "Snapshot confirmado",
      customer_id: 7,
      customer_name_snapshot: "Restaurante Lima",
      commercial_subtotal: "1000",
      tax_amount: "180",
      total_with_tax: "1180",
      complete: true,
      next_step: "SUMMARY",
      created_at: "2026-08-24T12:00:00Z",
      updated_at: "2026-08-24T12:00:00Z",
      confirmed_at: "2026-08-24T13:00:00Z",
    });
    const fetchSpy = mockFetch((url, init) => {
      if (url.includes("/quotation-builder/81") && init.method === "GET") {
        return jsonResponse(200, saved);
      }
      return handler(url, init);
    });
    renderApp(["/cotizador/81"]);

    expect(await screen.findByRole("heading", { name: "CTZ-2026-000081" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Resumen/i }));
    expect(screen.getByText(/1180\.00/)).toBeInTheDocument();
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    expect(
      fetchSpy.mock.calls.some(([url]) => String(url).includes("/quotation-builder/preview")),
    ).toBe(false);

    await user.click(screen.getByRole("link", { name: "Cotizador" }));
    expect(await screen.findByRole("heading", { name: "Nuevo cotizador." })).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre \/ referencia/i)).toBeEnabled();
    expect(screen.getByLabelText(/Nombre \/ referencia/i)).toHaveValue("");
    expect(screen.getByRole("button", { name: "Crear borrador" })).toBeInTheDocument();
  });

  it("permite previsualizar el PDF comercial en el Paso 7 y detecta estado desactualizado si se modifican datos", async () => {
    const user = userEvent.setup();
    const saved = builder({
      id: 88,
      code: "CTZ-2026-000088",
      status: "DRAFT",
      name: "Borrador con PDF",
      customer_id: 7,
      customer_name_snapshot: "Restaurante Lima",
      items: [itemOut({ product_id: 42, quantity: 10, markup_percent: "100", commercial_sale_unit_price: "50" }, 0)],
      item_count: 1,
      complete: true,
      next_step: "SUMMARY",
      created_at: "2026-08-24T12:00:00Z",
      updated_at: "2026-08-24T12:00:00Z",
    });

    let pdfCallCount = 0;
    mockFetch((url, init) => {
      if (url.includes("/quotation-builder/88") && init.method === "GET") return jsonResponse(200, saved);
      if (url.includes("/quotation-builder/pdf-preview") || url.includes("/pdf-preview")) {
        pdfCallCount++;
        return new Response(new Blob(["%PDF-1.4 mock preview"], { type: "application/pdf" }), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": 'inline; filename="CTZ-2026-000088_Restaurante_Lima.pdf"',
          },
        });
      }
      return handler(url, init);
    });

    renderApp(["/cotizador/88"]);

    expect(await screen.findByRole("heading", { name: "CTZ-2026-000088" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /PDF/i }));

    // Verifica que el iframe de previsualización se renderiza
    expect(await screen.findByTitle("Documento Comercial de Cotización")).toBeInTheDocument();
    expect(screen.getByText("CTZ-2026-000088_Restaurante_Lima.pdf")).toBeInTheDocument();
    expect(pdfCallCount).toBeGreaterThanOrEqual(1);

    // Modificar datos en el paso Datos y volver a PDF
    await user.click(screen.getByRole("button", { name: /Datos/i }));
    await user.type(screen.getByLabelText(/Nombre \/ referencia/i), " Modificado");

    await user.click(screen.getByRole("button", { name: /PDF/i }));
    expect(await screen.findByText(/Vista previa desactualizada debido a cambios recientes/i)).toBeInTheDocument();

    const previousCount = pdfCallCount;
    // Actualizar vista previa
    await user.click(screen.getByRole("button", { name: /Actualizar vista previa/i }));
    await waitFor(() => expect(pdfCallCount).toBeGreaterThan(previousCount));
    expect(screen.queryByText(/Vista previa desactualizada debido a cambios recientes/i)).not.toBeInTheDocument();
  });
});
