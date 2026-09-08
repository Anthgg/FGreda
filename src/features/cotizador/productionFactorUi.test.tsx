import { cleanup, screen, waitFor, within } from "@testing-library/react";
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
 * Fase 009K.4.1 — T01 a T23. El factor de produccion visto desde la pantalla.
 *
 * El factor YA era opcional desde 009K.3 y el cableado estaba entero: el
 * borrador lo guarda, el preview lo recalcula y el navegador nunca manda un
 * valor. Lo que fallaba era decirlo. La pantalla lo llamaba «factor
 * comercial» —que en la base es OTRA columna— y debajo del control ponia
 * «Configuración → Comercial», que se lee como que apagarlo se hace en
 * Ajustes. El desglose del paso 4 ensenaba «×1.00» sin decir si esta
 * cotizacion lo aplica, y el resumen callaba.
 *
 * Asi que lo que aqui se prueba son PALABRAS, no aritmetica: que el nombre sea
 * el mismo en las tres pantallas, que se vea de quien es la decision, y que
 * ninguna de las tres se contradiga con las otras. El calculo sigue siendo del
 * backend y esta cubierto contra PostgreSQL real.
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

/** El factor de la casa, tal y como lo devuelve Configuracion en el fixture. */
const FACTOR = String(COMMERCIAL_FILLED.production_factor_default);

/**
 * Lo que el backend contestaria para una linea.
 *
 * Los importes se derivan del factor recibido, no se fijan a mano: si el mock
 * devolviera siempre el mismo numero, la pantalla se probaria contra una
 * respuesta que el backend nunca da y encender el factor «funcionaria» sin
 * mover nada.
 */
function itemOut(input: Record<string, unknown>, index: number, enabled: boolean) {
  const tecnico = 100;
  const factor = enabled ? Number(FACTOR) : 1;
  const factorado = tecnico * factor;
  const fijos = 20;
  const base = factorado + fijos;
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
    quantity: typeof input.quantity === "number" ? input.quantity : 1,
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
    materials_calculated: "80",
    materials_applied: "80",
    firing_cost: "20",
    labor_cost: "0",
    calculated_days: 3,
    days_adjustment: 0,
    waiting_days: 0,
    total_days: 3,
    space_cost: String(fijos),
    technical_cost: String(tecnico),
    production_factor: String(factor),
    factored_cost: String(factorado),
    fixed_cost_allocation: String(fijos),
    commercial_base_cost: String(base),
    commercial_base_unit_cost: String(base),
    raw_net_unit_base: String(base),
    raw_net_unit: String(base),
    raw_tax_unit: "0",
    raw_gross_unit: String(base),
    rounding_step: "0.50",
    rounding_adjustment_unit: "0",
    currency_code_snapshot: "PEN",
    exchange_rate_snapshot: null,
    final_gross_unit: String(base),
    final_net_unit: String(base),
    final_tax_unit: "0",
    line_total_gross: String(base),
    line_total_net: String(base),
    line_total_tax: "0",
    final_unit_cost: String(base),
    final_total_cost: String(base),
    markup_percent: "0",
    calculated_sale_unit_price: String(base),
    suggested_commercial_unit_price: String(base),
    commercial_sale_unit_price_input: null,
    commercial_sale_unit_price: String(base),
    effective_profit_unit: "0",
    effective_profit_total: "0",
    effective_markup_percent: "0",
    commercial_subtotal: String(base),
    commercial_unit_price_with_tax: String(base),
    commercial_total: String(base),
    tax_percentage_snapshot: "18",
    tax_rate_source_snapshot: "COMMERCIAL_SETTINGS",
    tax_amount: "0",
    source_fingerprint: "s".repeat(64),
    warnings: [],
    complete: true,
    sort_order: index,
  };
}

type PreviewBody = {
  production_factor_enabled?: boolean;
  kiln_mode?: string;
  production_factor?: string;
  kiln_id?: number;
  items?: Array<Record<string, unknown>>;
};

/** La respuesta del backend para un cuerpo dado. */
function builderPara(body: PreviewBody, overrides: Partial<QuotationBuilderOut> = {}) {
  const enabled = Boolean(body.production_factor_enabled);
  const items = (body.items ?? []).map((item, index) => itemOut(item, index, enabled));
  const subtotal = items.reduce((suma, item) => suma + Number(item.commercial_subtotal), 0);
  return {
    id: null,
    code: null,
    workflow: "COTIZADOR",
    status: "DRAFT",
    name: null,
    customer_id: null,
    customer_name_snapshot: null,
    kiln_id: body.kiln_id ?? null,
    kiln_snapshot: {},
    production_summary: { sessions: [], total_batches: 0, total_days: 0 },
    items,
    commercial_lines: [],
    item_count: items.length,
    commercial_subtotal: String(subtotal),
    tax_percentage_snapshot: "18",
    tax_rate_source_snapshot: "COMMERCIAL_SETTINGS",
    tax_amount: "0",
    total_with_tax: String(subtotal),
    quotation_net_total: String(subtotal),
    quotation_tax_total: "0",
    quotation_gross_total: String(subtotal),
    // El backend resuelve la decision y devuelve el factor EFECTIVO: el
    // configurado encendido, el neutro apagado. Nunca el configurado apagado.
    production_factor: enabled ? FACTOR : "1",
    production_factor_enabled: enabled,
    kiln_mode: body.kiln_mode === "PER_PRODUCT" ? "PER_PRODUCT" : "TOGETHER",
    rounding_step: "0.50",
    total_fixed_cost: "20",
    currency_code_snapshot: "PEN",
    currency_symbol_snapshot: "S/",
    exchange_rate_snapshot: null,
    exchange_rate_source_snapshot: null,
    warnings: [],
    complete: true,
    next_step: "READY",
    source_fingerprint: "q".repeat(64),
    created_at: "2026-09-08T10:00:00Z",
    updated_at: "2026-09-08T10:00:00Z",
    confirmed_at: null,
    cancelled_at: null,
    created_by_name: "Administrador",
    confirmed_by_name: null,
    payment_status: null,
    paid_at: null,
    ...overrides,
  } as QuotationBuilderOut;
}

/**
 * Un backend con MEMORIA, que es lo que hace falta para probar persistencia:
 * guardar y volver a abrir sobre un doble sin estado siempre «funciona»,
 * porque el doble contesta lo mismo se haya guardado lo que se haya guardado.
 */
function escenario() {
  let guardado: QuotationBuilderOut | null = null;

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
      return jsonResponse(200, builderPara(JSON.parse(String(init.body)) as PreviewBody));
    }
    if (url.includes("/commercial-lines"))
      return jsonResponse(200, { items: [], total: 0, limit: 100, offset: 0 });
    // Alta y actualizacion del borrador: se GUARDA lo recibido.
    if (/\/quotation-builder(\/7)?$/.test(url) && (init.method === "POST" || init.method === "PUT")) {
      guardado = builderPara(JSON.parse(String(init.body)) as PreviewBody, {
        id: 7,
        code: "CTZ-2026-000007",
        name: "Factor QA",
      });
      return jsonResponse(200, guardado);
    }
    if (url.includes("/quotation-builder/7") && (init.method ?? "GET") === "GET") {
      return guardado ? jsonResponse(200, guardado) : errorResponse(404, "NOT_FOUND");
    }
    return errorResponse(404, "NOT_FOUND");
  }

  return { handler, guardadas: () => guardado };
}

function cuerposDePreview(spy: ReturnType<typeof mockFetch>): PreviewBody[] {
  return spy.mock.calls
    .filter(([url]) => String(url).includes("/quotation-builder/preview"))
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)) as PreviewBody);
}

type Usuario = ReturnType<typeof userEvent.setup>;

async function conUnaPieza(user: Usuario) {
  await screen.findByRole("heading", { name: "Nuevo cotizador." });
  await user.click(screen.getByRole("button", { name: /Piezas/i }));
  await user.click(screen.getByRole("button", { name: /Agregar producto/i }));
  await user.click(screen.getByRole("combobox", { name: "Pieza terminada" }));
  await user.click(await screen.findByText("Plato palta QA"));
}

const irA = async (user: Usuario, paso: RegExp) =>
  user.click(screen.getByRole("button", { name: paso }));

const MARGEN = /Margen y precio/i;
const COSTEO = /Costeo/i;
const RESUMEN = /Resumen/i;

/** El bloque del factor en el paso 5, con su ayuda y su numero dentro. */
const bloqueFactor = () => screen.getByRole("group", { name: "Factor de producción" });

async function activar(user: Usuario) {
  await user.click(screen.getByRole("radio", { name: "Activado" }));
}

async function desactivar(user: Usuario) {
  await user.click(screen.getByRole("radio", { name: "Desactivado" }));
}

/** Espera a que el preview mostrado ya se haya calculado con la decision. */
async function preguntadoAlBackend(spy: ReturnType<typeof mockFetch>, enabled: boolean) {
  await waitFor(() => {
    expect(cuerposDePreview(spy).at(-1)?.production_factor_enabled).toBe(enabled);
  });
}

// ---------------------------------------------------------------------------
// T01 a T09 — el control del paso 5 dice qué es y de quién es la decisión
// ---------------------------------------------------------------------------
describe("T01–T09 · el control del factor en «Margen y precio»", () => {
  it("T01: se llama «Factor de producción», el mismo nombre que en Configuración", async () => {
    const user = userEvent.setup();
    mockFetch(escenario().handler);
    renderApp(["/cotizador/nuevo"]);
    await conUnaPieza(user);
    await irA(user, MARGEN);

    expect(bloqueFactor()).toBeInTheDocument();
  });

  it("T02: ya no se llama «Factor comercial», que en la base es otra cosa", async () => {
    const user = userEvent.setup();
    mockFetch(escenario().handler);
    renderApp(["/cotizador/nuevo"]);
    await conUnaPieza(user);
    await irA(user, MARGEN);

    // `commercial_factor` es una columna historica distinta del factor de
    // produccion. Llamarlos igual en pantalla los confundia.
    expect(screen.queryByText(/Factor comercial/i)).not.toBeInTheDocument();
  });

  it("T03: una cotización nueva nace con el factor desactivado", async () => {
    const user = userEvent.setup();
    mockFetch(escenario().handler);
    renderApp(["/cotizador/nuevo"]);
    await conUnaPieza(user);
    await irA(user, MARGEN);

    expect(screen.getByRole("radio", { name: "Desactivado" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Activado" })).not.toBeChecked();
  });

  it("T04: apagado dice que no multiplica y enseña el neutro, no el configurado", async () => {
    const user = userEvent.setup();
    mockFetch(escenario().handler);
    renderApp(["/cotizador/nuevo"]);
    await conUnaPieza(user);
    await irA(user, MARGEN);

    const bloque = within(bloqueFactor());
    expect(bloque.getByText("No se aplica multiplicador de producción.")).toBeInTheDocument();
    expect(bloque.getByText("Factor efectivo:")).toBeInTheDocument();
    expect(bloque.getByText("×1")).toBeInTheDocument();
    // Ensenar «×3» apagado anunciaria un multiplicador que no se aplica.
    expect(bloque.queryByText(`×${FACTOR}`)).not.toBeInTheDocument();
  });

  it("T05: encendido dice que se aplica y enseña el factor configurado", async () => {
    const user = userEvent.setup();
    const spy = mockFetch(escenario().handler);
    renderApp(["/cotizador/nuevo"]);
    await conUnaPieza(user);
    await irA(user, MARGEN);
    await activar(user);
    await preguntadoAlBackend(spy, true);

    const bloque = within(bloqueFactor());
    expect(
      bloque.getByText("Se aplica el factor configurado para producción."),
    ).toBeInTheDocument();
    expect(bloque.getByText("Factor configurado:")).toBeInTheDocument();
    expect(bloque.getByText(`×${FACTOR}`)).toBeInTheDocument();
  });

  it("T06: el valor es de lectura y se dice de quién es cada mitad de la decisión", async () => {
    const user = userEvent.setup();
    const spy = mockFetch(escenario().handler);
    renderApp(["/cotizador/nuevo"]);
    await conUnaPieza(user);
    await irA(user, MARGEN);
    await activar(user);
    await preguntadoAlBackend(spy, true);

    const bloque = within(bloqueFactor());
    // Ni caja de texto ni desplegable: cuanto vale el factor de la casa se
    // decide en Configuracion, y un segundo sitio donde escribirlo serian dos
    // respuestas a la misma pregunta.
    expect(bloque.queryByRole("textbox")).not.toBeInTheDocument();
    expect(bloque.queryByRole("combobox")).not.toBeInTheDocument();
    expect(
      bloque.getByText(
        /El valor del factor se define en Configuración; aquí decides si esta cotización lo aplica\./,
      ),
    ).toBeInTheDocument();
    // Y ya no queda la atribucion a secas, que se leia como que apagarlo o
    // encenderlo tambien se hacia en Ajustes.
    expect(screen.queryByText("Configuración → Comercial")).not.toBeInTheDocument();
  });

  it("T07: no hay campo numérico para escribir el factor", async () => {
    const user = userEvent.setup();
    mockFetch(escenario().handler);
    renderApp(["/cotizador/nuevo"]);
    await conUnaPieza(user);
    await irA(user, MARGEN);

    expect(within(bloqueFactor()).queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("T08: no hay selector manual de 1, 2 o 3", async () => {
    const user = userEvent.setup();
    const spy = mockFetch(escenario().handler);
    renderApp(["/cotizador/nuevo"]);
    await conUnaPieza(user);
    await irA(user, MARGEN);
    await activar(user);
    await preguntadoAlBackend(spy, true);

    // Esa regla no existe en el sistema: el factor es UN valor configurado.
    const opciones = within(bloqueFactor())
      .getAllByRole("radio")
      .map((radio) => radio.getAttribute("value"));
    expect(opciones).toEqual(["NO", "SI"]);
  });

  it("T09: el factor no se escribe como dinero", async () => {
    const user = userEvent.setup();
    const spy = mockFetch(escenario().handler);
    renderApp(["/cotizador/nuevo"]);
    await conUnaPieza(user);
    await irA(user, MARGEN);
    await activar(user);
    await preguntadoAlBackend(spy, true);

    // Tres no son tres soles: son tres veces el costo tecnico. Con simbolo de
    // moneda alguien lo sumaria al precio.
    expect(bloqueFactor().textContent ?? "").not.toMatch(/S\/|\$/);
  });
});

// ---------------------------------------------------------------------------
// T10 a T12 — el paso 4 LEE el estado, el paso 5 lo DECIDE
// ---------------------------------------------------------------------------
describe("T10–T12 · costeo lee, margen decide", () => {
  it("T10: apagado, el desglose del costeo dice «No aplicado · ×1»", async () => {
    const user = userEvent.setup();
    const spy = mockFetch(escenario().handler);
    renderApp(["/cotizador/nuevo"]);
    await conUnaPieza(user);
    await irA(user, COSTEO);
    await preguntadoAlBackend(spy, false);

    expect(await screen.findByText("No aplicado · ×1")).toBeInTheDocument();
    expect(screen.getByText("Se decide en «Margen y precio»")).toBeInTheDocument();
  });

  it("T11: encendido, el desglose dice «Aplicado · ×3» con el factor real", async () => {
    const user = userEvent.setup();
    const spy = mockFetch(escenario().handler);
    renderApp(["/cotizador/nuevo"]);
    await conUnaPieza(user);
    await irA(user, MARGEN);
    await activar(user);
    await preguntadoAlBackend(spy, true);
    await irA(user, COSTEO);

    expect(await screen.findByText(`Aplicado · ×${FACTOR}`)).toBeInTheDocument();
  });

  it("T12: el costeo no ofrece el control; la decisión vive en «Margen y precio»", async () => {
    const user = userEvent.setup();
    const spy = mockFetch(escenario().handler);
    renderApp(["/cotizador/nuevo"]);
    await conUnaPieza(user);
    await irA(user, COSTEO);
    await preguntadoAlBackend(spy, false);

    expect(document.querySelectorAll('input[name="production-factor-enabled"]')).toHaveLength(0);

    await irA(user, MARGEN);
    expect(document.querySelectorAll('input[name="production-factor-enabled"]')).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// T13 a T15 — el resumen dice el estado y no lo edita
// ---------------------------------------------------------------------------
describe("T13–T15 · el resumen", () => {
  it("T13: apagado, el resumen dice «No aplicado · ×1»", async () => {
    const user = userEvent.setup();
    const spy = mockFetch(escenario().handler);
    renderApp(["/cotizador/nuevo"]);
    await conUnaPieza(user);
    await irA(user, RESUMEN);
    await preguntadoAlBackend(spy, false);

    expect(await screen.findByText("No aplicado · ×1")).toBeInTheDocument();
  });

  it("T14: encendido, el resumen dice «Aplicado · ×3»", async () => {
    const user = userEvent.setup();
    const spy = mockFetch(escenario().handler);
    renderApp(["/cotizador/nuevo"]);
    await conUnaPieza(user);
    await irA(user, MARGEN);
    await activar(user);
    await preguntadoAlBackend(spy, true);
    await irA(user, RESUMEN);

    expect(await screen.findByText(`Aplicado · ×${FACTOR}`)).toBeInTheDocument();
  });

  it("T15: el resumen no deja cambiarlo desde ahí", async () => {
    const user = userEvent.setup();
    const spy = mockFetch(escenario().handler);
    renderApp(["/cotizador/nuevo"]);
    await conUnaPieza(user);
    await irA(user, RESUMEN);
    await preguntadoAlBackend(spy, false);

    expect(document.querySelectorAll('input[name="production-factor-enabled"]')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// T16 y T17 — lo que viaja es la INTENCION
// ---------------------------------------------------------------------------
describe("T16–T17 · el payload", () => {
  it("T16: apagado manda production_factor_enabled=false", async () => {
    const user = userEvent.setup();
    const spy = mockFetch(escenario().handler);
    renderApp(["/cotizador/nuevo"]);
    await conUnaPieza(user);
    await irA(user, MARGEN);
    await preguntadoAlBackend(spy, false);
  });

  it("T17: encendido manda true, y nunca un valor de factor", async () => {
    const user = userEvent.setup();
    const spy = mockFetch(escenario().handler);
    renderApp(["/cotizador/nuevo"]);
    await conUnaPieza(user);
    await irA(user, MARGEN);
    await activar(user);
    await preguntadoAlBackend(spy, true);

    for (const cuerpo of cuerposDePreview(spy)) {
      expect(cuerpo).not.toHaveProperty("production_factor");
    }
  });
});

// ---------------------------------------------------------------------------
// T18 a T20 — el borrador recuerda la decisión
// ---------------------------------------------------------------------------
describe("T18–T20 · persistencia del borrador", () => {
  /** Guarda el borrador, cierra la pantalla y la vuelve a abrir de cero. */
  async function guardarYReabrir(user: Usuario) {
    // Un borrador que aun no existe se CREA; el boton lo dice asi.
    await user.click(screen.getByRole("button", { name: "Crear borrador" }));
    // Con el alta hecha el boton cambia de nombre: es la senal de que la
    // pantalla ya tiene un id detras, y por tanto de que el POST volvio.
    await screen.findByRole("button", { name: "Guardar borrador" });
    cleanup();
    renderApp(["/cotizador/7"]);
    await screen.findByRole("button", { name: MARGEN });
    await irA(user, MARGEN);
  }

  it("T18: guardado apagado, vuelve apagado", async () => {
    const user = userEvent.setup();
    const { handler, guardadas } = escenario();
    const spy = mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);
    await conUnaPieza(user);
    await irA(user, MARGEN);
    await preguntadoAlBackend(spy, false);

    await guardarYReabrir(user);

    expect(guardadas()?.production_factor_enabled).toBe(false);
    expect(screen.getByRole("radio", { name: "Desactivado" })).toBeChecked();
  });

  it("T19: guardado encendido, vuelve encendido", async () => {
    const user = userEvent.setup();
    const { handler, guardadas } = escenario();
    const spy = mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);
    await conUnaPieza(user);
    await irA(user, MARGEN);
    await activar(user);
    await preguntadoAlBackend(spy, true);

    await guardarYReabrir(user);

    expect(guardadas()?.production_factor_enabled).toBe(true);
    expect(screen.getByRole("radio", { name: "Activado" })).toBeChecked();
    expect(within(bloqueFactor()).getByText(`×${FACTOR}`)).toBeInTheDocument();
  });

  it("T20: encendido y apagado antes de guardar, vuelve apagado", async () => {
    const user = userEvent.setup();
    const { handler, guardadas } = escenario();
    const spy = mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);
    await conUnaPieza(user);
    await irA(user, MARGEN);
    await activar(user);
    await preguntadoAlBackend(spy, true);
    await desactivar(user);
    await preguntadoAlBackend(spy, false);

    await guardarYReabrir(user);

    expect(guardadas()?.production_factor_enabled).toBe(false);
    expect(screen.getByRole("radio", { name: "Desactivado" })).toBeChecked();
  });
});

// ---------------------------------------------------------------------------
// T21 — apagarlo devuelve exactamente lo que había antes de encenderlo
// ---------------------------------------------------------------------------
describe("T21 · reversibilidad", () => {
  it("T21: apagado → encendido → apagado devuelve el mismo resultado del backend", async () => {
    const user = userEvent.setup();
    const spy = mockFetch(escenario().handler);
    renderApp(["/cotizador/nuevo"]);
    await conUnaPieza(user);
    await irA(user, RESUMEN);
    await preguntadoAlBackend(spy, false);

    const total = async () =>
      (await screen.findByText("Total con IGV")).parentElement?.textContent ?? "";

    await waitFor(async () => expect(await total()).toContain("120.00"));
    const apagadoA = await total();

    await irA(user, MARGEN);
    await activar(user);
    await preguntadoAlBackend(spy, true);
    await irA(user, RESUMEN);
    await waitFor(async () => expect(await total()).toContain("320.00"));
    const encendido = await total();

    await irA(user, MARGEN);
    await desactivar(user);
    await preguntadoAlBackend(spy, false);
    await irA(user, RESUMEN);
    await waitFor(async () => expect(await total()).toContain("120.00"));
    const apagadoC = await total();

    // Ni un cargo residual del estado encendido.
    expect(apagadoC).toBe(apagadoA);
    expect(encendido).not.toBe(apagadoA);
  });
});

// ---------------------------------------------------------------------------
// T22 y T23 — el factor y el horno son decisiones distintas
// ---------------------------------------------------------------------------
describe("T22–T23 · el modo de horno es independiente del factor", () => {
  /** Recorre la matriz factor × modo comprobando que nada esconde a nada. */
  async function combinar(user: Usuario, spy: ReturnType<typeof mockFetch>, modo: string) {
    await irA(user, /Producción/i);
    const etiqueta = modo === "PER_PRODUCT" ? "Por producto" : "Todo junto";
    await user.click(screen.getByRole("radio", { name: etiqueta }));
    await waitFor(() => {
      expect(cuerposDePreview(spy).at(-1)?.kiln_mode).toBe(modo);
    });

    for (const encendido of [true, false]) {
      await irA(user, MARGEN);
      // El control del factor sigue estando, se elija el horno como se elija.
      expect(bloqueFactor()).toBeInTheDocument();
      await (encendido ? activar(user) : desactivar(user));
      await preguntadoAlBackend(spy, encendido);
      // Y el modo de horno no se ha movido por tocar el factor.
      expect(cuerposDePreview(spy).at(-1)?.kiln_mode).toBe(modo);

      await irA(user, /Producción/i);
      expect(screen.getByRole("radio", { name: etiqueta })).toBeChecked();
    }
  }

  it("T22: «Todo junto» convive con el factor encendido y apagado", async () => {
    const user = userEvent.setup();
    const spy = mockFetch(escenario().handler);
    renderApp(["/cotizador/nuevo"]);
    await conUnaPieza(user);
    await combinar(user, spy, "TOGETHER");
  });

  it("T23: «Por producto» convive con el factor encendido y apagado", async () => {
    const user = userEvent.setup();
    const spy = mockFetch(escenario().handler);
    renderApp(["/cotizador/nuevo"]);
    await conUnaPieza(user);
    await combinar(user, spy, "PER_PRODUCT");
  });
});
