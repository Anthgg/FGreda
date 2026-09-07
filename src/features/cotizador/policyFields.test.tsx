import { screen, waitFor } from "@testing-library/react";
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
import { COMMERCIAL_FILLED } from "@/test/settingsFixtures";
import { KILNS_PAGE } from "@/test/firingsFixtures";
import type { Product } from "@/types/masters";
import type { QuotationBuilderOut } from "@/types/quotationBuilder";

/**
 * Fase 009K.3 — las dos decisiones nuevas, vistas desde la pantalla.
 *
 * Lo que aqui se comprueba no es el calculo —eso es del backend, y esta
 * cubierto contra PostgreSQL real— sino tres cosas que solo se ven en la UI:
 *
 * 1. con que ARRANCA una cotizacion nueva: factor apagado, horno todo junto;
 * 2. que lo que viaja al backend sea la INTENCION y nunca un valor de factor,
 *    para que el navegador no pueda elegir el factor de la casa;
 * 3. que la pantalla no prometa lo que el sistema no hace. En concreto, que
 *    no diga «automatico 1/2/3»: esa regla no existe, y escribirla haria que
 *    alguien esperara tramos que nadie calcula.
 */

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
  height: "6",
  length: "20",
  depth: null,
  sellable: true,
  purchasable: false,
  available_in_pos: true,
  active: true,
  notes: null,
};

function itemOut(input: Record<string, unknown>, index: number) {
  return {
    id: null,
    product_id: Number(input.product_id),
    product_internal_reference: product.internal_reference,
    product_name: product.name,
    product_type: product.product_type,
    product_uom: product.base_uom_code,
    product_material: product.material ?? null,
    product_grammage: "420",
    width: "20",
    height: "6",
    length: "20",
    depth: null,
    standard_width: "20",
    standard_height: "6",
    standard_length: "20",
    standard_depth: null,
    editable_dimensions: [],
    dimensions_overridden: false,
    quantity: typeof input.quantity === "number" ? input.quantity : null,
    body_material: null,
    recipe_id: null,
    recipe_version_id: null,
    recipe_version_fingerprint_snapshot: null,
    recipe_auto_selected: false,
    materials_applied_input: null,
    material_grams_per_piece: null,
    firing_id: null,
    firing_line_id: null,
    firing_code_snapshot: null,
    kiln_id: null,
    low_kiln_id: (input.low_kiln_id as number | undefined) ?? null,
    high_kiln_id: (input.high_kiln_id as number | undefined) ?? null,
    low_kiln_selected: input.low_kiln_selected !== false,
    high_kiln_selected: input.high_kiln_selected !== false,
    factor_kiln_id: null,
    production_snapshot: {},
    glaze_plan: null,
    glaze_unit: "g" as const,
    glaze_selection_touched: false,
    techniques: [],
    additionals: [],
    other_costs: [],
    materials_calculated: "0",
    materials_applied: "0",
    firing_cost: "0",
    labor_cost: "0",
    calculated_days: 3,
    days_adjustment: 0,
    waiting_days: 0,
    total_days: 3,
    space_cost: "0",
    technical_cost: "100",
    production_factor: "1",
    factored_cost: "100",
    fixed_cost_allocation: "0",
    commercial_base_cost: "100",
    commercial_base_unit_cost: "100",
    raw_net_unit_base: "0",
    raw_net_unit: "0",
    raw_tax_unit: "0",
    raw_gross_unit: "0",
    rounding_step: "0.50",
    rounding_adjustment_unit: "0",
    currency_code_snapshot: "PEN",
    exchange_rate_snapshot: null,
    final_gross_unit: "0",
    final_net_unit: "0",
    final_tax_unit: "0",
    line_total_gross: "0",
    line_total_net: "0",
    line_total_tax: "0",
    final_unit_cost: "0",
    final_total_cost: "0",
    markup_percent: "100",
    calculated_sale_unit_price: "0",
    suggested_commercial_unit_price: "0",
    commercial_sale_unit_price_input: null,
    commercial_sale_unit_price: "0",
    effective_profit_unit: "0",
    effective_profit_total: "0",
    effective_markup_percent: "0",
    commercial_subtotal: "0",
    commercial_unit_price_with_tax: "0",
    commercial_total: "0",
    tax_percentage_snapshot: "18",
    tax_rate_source_snapshot: "COMMERCIAL_SETTINGS",
    tax_amount: "0",
    source_fingerprint: "s".repeat(64),
    warnings: [],
    complete: true,
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
    commercial_lines: [],
    item_count: 0,
    commercial_subtotal: "0",
    tax_percentage_snapshot: "18",
    tax_rate_source_snapshot: "COMMERCIAL_SETTINGS",
    tax_amount: "0",
    total_with_tax: "0",
    quotation_net_total: "0",
    quotation_tax_total: "0",
    quotation_gross_total: "0",
    production_factor: "1",
    production_factor_enabled: false,
    kiln_mode: "TOGETHER",
    rounding_step: "0.50",
    total_fixed_cost: "0",
    currency_code_snapshot: "PEN",
    currency_symbol_snapshot: "S/",
    exchange_rate_snapshot: null,
    exchange_rate_source_snapshot: null,
    warnings: [],
    complete: false,
    next_step: "GENERAL_DATA",
    source_fingerprint: "q".repeat(64),
    created_at: null,
    updated_at: null,
    confirmed_at: null,
    cancelled_at: null,
    created_by_name: null,
    confirmed_by_name: null,
    payment_status: null,
    paid_at: null,
    ...overrides,
  };
}

/** Cuerpos de `preview` enviados, en orden. */
type PreviewBody = {
  production_factor_enabled?: boolean;
  kiln_mode?: string;
  production_factor?: string;
  kiln_id?: number;
  items?: Array<Record<string, unknown>>;
};

function handler(url: string, init: RequestInit) {
  if (url.includes("/auth/me")) return sessionResponse();
  if (url.includes("/auth/csrf")) return csrfResponse();
  if (url.includes("/settings/commercial")) return jsonResponse(200, COMMERCIAL_FILLED);
  if (url.includes("/partners"))
    return jsonResponse(200, { items: [], total: 0, limit: 100, offset: 0 });
  if (url.includes("/kilns")) return jsonResponse(200, KILNS_PAGE);
  if (url.includes("/firing-lines"))
    return jsonResponse(200, { items: [], total: 0, limit: 100, offset: 0 });
  if (url.includes("/products"))
    return jsonResponse(200, { items: [product], total: 1, limit: 50, offset: 0 });
  if (url.includes("/techniques") || url.includes("/additionals") || url.includes("/other-costs"))
    return jsonResponse(200, { items: [], total: 0, limit: 200, offset: 0 });
  if (url.includes("/quotation-builder/preview") && init.method === "POST") {
    const body = JSON.parse(String(init.body)) as PreviewBody;
    const items = (body.items ?? []).map(itemOut);
    // El mock devuelve lo que el backend devolveria: la decision resuelta y,
    // encendido, el factor de Configuracion. Fijarlo aqui a mano haria que la
    // pantalla se probara contra una respuesta que el backend nunca da.
    return jsonResponse(
      200,
      builder({
        items,
        item_count: items.length,
        kiln_id: body.kiln_id ?? null,
        production_factor_enabled: Boolean(body.production_factor_enabled),
        production_factor: body.production_factor_enabled ? "3" : "1",
        kiln_mode: body.kiln_mode === "PER_PRODUCT" ? "PER_PRODUCT" : "TOGETHER",
        production_summary: { sessions: [], total_batches: 0, total_days: 0 },
      }),
    );
  }
  return errorResponse(404, "NOT_FOUND");
}

function previewBodies(spy: ReturnType<typeof mockFetch>): PreviewBody[] {
  return spy.mock.calls
    .filter(([url]) => String(url).includes("/quotation-builder/preview"))
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)) as PreviewBody);
}

async function abrirConUnaPieza(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole("heading", { name: "Nuevo cotizador." });
  await user.click(screen.getByRole("button", { name: /Piezas/i }));
  await user.click(screen.getByRole("button", { name: /Agregar producto/i }));
  await user.click(screen.getByRole("combobox", { name: "Pieza terminada" }));
  await user.click(await screen.findByText("Plato palta QA"));
}

async function abrirMargen(user: ReturnType<typeof userEvent.setup>) {
  await abrirConUnaPieza(user);
  await user.click(screen.getByRole("button", { name: /Margen y precio/i }));
}

async function abrirProduccion(user: ReturnType<typeof userEvent.setup>) {
  await abrirConUnaPieza(user);
  await user.click(screen.getByRole("button", { name: /Producción/i }));
}

// ---------------------------------------------------------------------------
// FF01–FF08: el factor comercial
// ---------------------------------------------------------------------------
describe("Factor comercial opcional", () => {
  it("FF01: nace desactivado", async () => {
    const user = userEvent.setup();
    mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);
    await abrirMargen(user);

    expect(screen.getByRole("radio", { name: "Desactivado" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Activado" })).not.toBeChecked();
  });

  it("FF02 + FF03: activarlo manda la intencion y enseña el factor configurado", async () => {
    const user = userEvent.setup();
    const spy = mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);
    await abrirMargen(user);

    await user.click(screen.getByRole("radio", { name: "Activado" }));

    // El numero sale de Configuracion, que es su unica autoridad.
    expect(await screen.findByText(/Factor configurado:/i)).toBeInTheDocument();
    expect(screen.getByText("×3.00")).toBeInTheDocument();
    await waitFor(() => {
      expect(previewBodies(spy).at(-1)?.production_factor_enabled).toBe(true);
    });
  });

  it("FF04: desactivarlo vuelve a mandar la intencion contraria", async () => {
    const user = userEvent.setup();
    const spy = mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);
    await abrirMargen(user);

    await user.click(screen.getByRole("radio", { name: "Activado" }));
    await waitFor(() => {
      expect(previewBodies(spy).at(-1)?.production_factor_enabled).toBe(true);
    });
    await user.click(screen.getByRole("radio", { name: "Desactivado" }));

    await waitFor(() => {
      expect(previewBodies(spy).at(-1)?.production_factor_enabled).toBe(false);
    });
  });

  it("FF07: el navegador nunca manda un valor de factor", async () => {
    const user = userEvent.setup();
    const spy = mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);
    await abrirMargen(user);
    await user.click(screen.getByRole("radio", { name: "Activado" }));

    await waitFor(() => {
      expect(previewBodies(spy).at(-1)?.production_factor_enabled).toBe(true);
    });
    // Ni encendido ni apagado: cuanto vale el factor de la casa se decide en
    // Configuracion, y un numero saliendo de aqui seria una segunda respuesta
    // a la misma pregunta.
    for (const body of previewBodies(spy)) {
      expect(body).not.toHaveProperty("production_factor");
    }
  });

  it("FF07 bis: no hay selector manual de 1, 2 o 3", async () => {
    const user = userEvent.setup();
    mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);
    await abrirMargen(user);
    await user.click(screen.getByRole("radio", { name: "Activado" }));

    const radios = screen.getAllByRole("radio").map((radio) => radio.getAttribute("value"));
    expect(radios).not.toContain("1");
    expect(radios).not.toContain("2");
    expect(radios).not.toContain("3");
  });

  it("FF08: la pantalla no promete una regla automatica por tramos", async () => {
    const user = userEvent.setup();
    mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);
    await abrirMargen(user);
    await user.click(screen.getByRole("radio", { name: "Activado" }));

    // Esa regla no existe en el sistema: el factor es UN valor configurado.
    // Anunciar tramos haria esperar un calculo que nadie hace.
    expect(screen.queryByText(/autom[áa]tico\s*1\s*\/\s*2\s*\/\s*3/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tramo/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// FH01–FH11: el modo de horno
// ---------------------------------------------------------------------------
describe("Modo de horno", () => {
  it("FH01: nace en «Todo junto»", async () => {
    const user = userEvent.setup();
    mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);
    await abrirProduccion(user);

    expect(screen.getByRole("radio", { name: "Todo junto" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Por producto" })).not.toBeChecked();
  });

  it("FH02 + FH03: junto hay un solo selector, y no es de la pieza", async () => {
    const user = userEvent.setup();
    mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);
    await abrirProduccion(user);

    expect(
      screen.getByRole("combobox", { name: "Horno de la cotización" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Horno de quema baja" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Horno de quema alta" }),
    ).not.toBeInTheDocument();
  });

  it("FH04 + FH05: por producto aparecen los selectores de la pieza", async () => {
    const user = userEvent.setup();
    const spy = mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);
    await abrirProduccion(user);

    await user.click(screen.getByRole("radio", { name: "Por producto" }));

    expect(
      await screen.findByRole("combobox", { name: "Horno de quema baja" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Horno de quema alta" })).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Horno de la cotización" }),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(previewBodies(spy).at(-1)?.kiln_mode).toBe("PER_PRODUCT");
    });
  });

  it("FH06: al pasar a por producto la pieza hereda el horno comun", async () => {
    const user = userEvent.setup();
    const spy = mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);
    await abrirProduccion(user);

    await user.click(screen.getByRole("combobox", { name: "Horno de la cotización" }));
    await user.click(await screen.findByRole("option", { name: /KILN-001/i }));
    await user.click(screen.getByRole("radio", { name: "Por producto" }));

    await waitFor(() => {
      const ultimo = previewBodies(spy).at(-1);
      expect(ultimo?.kiln_mode).toBe("PER_PRODUCT");
      // Heredado, no en blanco: empezar de cero obligaria a volver a elegir
      // lo que ya estaba elegido.
      expect(ultimo?.items?.[0]).toMatchObject({ low_kiln_id: 1, high_kiln_id: 1 });
    });
  });

  it("FH08: volver a junto con hornos distintos no elige uno en silencio", async () => {
    const user = userEvent.setup();
    const spy = mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);
    await abrirProduccion(user);

    await user.click(screen.getByRole("radio", { name: "Por producto" }));
    await user.click(await screen.findByRole("combobox", { name: "Horno de quema baja" }));
    await user.click(await screen.findByRole("option", { name: /KILN-001/i }));
    await user.click(screen.getByRole("combobox", { name: "Horno de quema alta" }));
    await user.click(await screen.findByRole("option", { name: /KILN-002/i }));

    await user.click(screen.getByRole("radio", { name: "Todo junto" }));

    // Quedarse con el primero cambiaria de horno la quema alta —y con el su
    // tarifa, sus hornadas y sus dias— sin que nadie lo hubiera pedido.
    await waitFor(() => {
      const ultimo = previewBodies(spy).at(-1);
      expect(ultimo?.kiln_mode).toBe("TOGETHER");
      expect(ultimo?.kiln_id).toBeUndefined();
    });
  });

  it("FH11: cambiar de modo no deja hornos por pieza en el payload", async () => {
    const user = userEvent.setup();
    const spy = mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);
    await abrirProduccion(user);

    await user.click(screen.getByRole("radio", { name: "Por producto" }));
    await user.click(await screen.findByRole("combobox", { name: "Horno de quema baja" }));
    await user.click(await screen.findByRole("option", { name: /KILN-002/i }));
    await user.click(screen.getByRole("radio", { name: "Todo junto" }));

    await waitFor(() => {
      const ultimo = previewBodies(spy).at(-1);
      expect(ultimo?.kiln_mode).toBe("TOGETHER");
      expect(ultimo?.items?.[0]?.["low_kiln_id"]).toBeUndefined();
      expect(ultimo?.items?.[0]?.["high_kiln_id"]).toBeUndefined();
    });
  });
});
