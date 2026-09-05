/**
 * Fase 009K.1.1 — el Cotizador de Prototipos en pantalla.
 *
 * Lo que se protege aquí es una sola frase: **el navegador manda intención y
 * recibe importes**. Ni un IGV, ni un redondeo, ni una conversión de moneda,
 * ni una suma de días salen de este componente. Si alguien vuelve a meter
 * aritmética de dinero aquí, estas pruebas se caen.
 *
 * El segundo bloque es la paridad de moneda con el Cotizador principal: la
 * casa emite en soles o en dólares, y un prototipo no es menos documento que
 * una pieza de catálogo.
 */

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PrototypeQuoterPage } from "@/features/prototypeQuotations/PrototypeQuoterPage";
import {
  csrfResponse,
  errorResponse,
  jsonResponse,
  mockFetch,
  renderApp,
  renderWithProviders,
  sessionResponse,
} from "@/test/utils";
import type {
  PrototypeCostBreakdown,
  PrototypeQuotation,
} from "@/types/prototypeQuotations";

// El caso canónico del Excel v2: 800 de costo, 144 de IGV, 944 de total.
const COSTEO: PrototypeCostBreakdown = {
  design_cost: "240.00",
  artist_cost: "200.00",
  mold_maker_cost: "0.00",
  materials_cost: "10.00",
  firing_cost: "350.00",
  fixed_cost: "0.00",
  base_cost: "800.00",
  raw_net_total: "800.00",
  currency: "PEN",
  exchange_rate: null,
  raw_tax: "144.00",
  raw_gross_total: "944.00",
  commercial_net_total: "800.00",
  tax_percent: "18",
  commercial_tax_total: "144.00",
  commercial_gross_total: "944.00",
  total_per_prototype: "944.00",
  rounding_step: "0.50",
  rounding_source: "COMMERCIAL_SETTINGS",
  design_rate: "80.00",
  artist_rate: "100.00",
  mold_maker_price: "0.00",
  firing_rate: "350.00",
  firing_days_per_batch: 3,
  design_days: "3",
  artist_days: "2",
  mold_maker_days: "0",
  drying_days: "1",
  firing_days: 3,
  adjustment_days: "0",
  estimated_days: "9",
  target_date: "2026-09-14",
  materials: [
    {
      id: 1,
      product_id: 5,
      product_name: "Pasta prototipo",
      quantity_per_prototype: "1.25",
      total_quantity: "1.25",
      uom_code: "kg",
      unit_cost: "8.00",
      cost: "10.00",
      is_body_material: true,
    },
  ],
};

// El mismo caso en dólares a 4.00: el costo sigue siendo 800 soles y el precio
// pasa a 200 + 36 = 236 dólares.
const COSTEO_USD: PrototypeCostBreakdown = {
  ...COSTEO,
  raw_net_total: "200.00",
  currency: "USD",
  exchange_rate: "4.000000",
  raw_tax: "36.00",
  raw_gross_total: "236.00",
  commercial_net_total: "200.00",
  commercial_tax_total: "36.00",
  commercial_gross_total: "236.00",
  total_per_prototype: "236.00",
};

function cotizacion(overrides: Partial<PrototypeQuotation> = {}): PrototypeQuotation {
  return {
    id: 12,
    code: null,
    status: "DRAFT",
    payment_status: "UNPAID",
    paid_at: null,
    confirmed_at: null,
    cancelled_at: null,
    customer_id: 3,
    customer_name: "Cliente prototipo",
    product_id: null,
    description: "Taza personalizada",
    quantity: 1,
    width_cm: "15",
    length_cm: "15",
    height_cm: "20",
    depth_cm: null,
    technical_specifications: null,
    notes: null,
    design_days: "3",
    design_rate_override: null,
    artist_days: "2",
    artist_rate_override: null,
    mold_maker_partner_id: null,
    mold_maker_price_override: null,
    mold_maker_days: "0",
    kiln_id: 2,
    firing_type: "LOW",
    firing_batches: 1,
    drying_days: "1",
    adjustment_days: "0",
    fixed_cost_override: null,
    currency_code: "PEN",
    currency_symbol: "S/",
    exchange_rate: null,
    costing: COSTEO,
    prototype_id: null,
    prototype_code: null,
    updated_at: "2026-09-04T10:00:00Z",
    ...overrides,
  };
}

interface Espias {
  enviados: Array<{ url: string; body: unknown }>;
}

/**
 * Un backend de mentira que devuelve lo que devolvería el de verdad.
 *
 * `guardada` es lo que responden `GET /{id}`, `create`, `update`, `confirm` y
 * `mark-paid`; `costeo` es lo que responde `preview`. Se separan porque el
 * borrador que se está escribiendo y el que está guardado no tienen por qué
 * coincidir, y confundirlos escondería justamente los errores que importan.
 */
function mockApi(
  guardada: PrototypeQuotation = cotizacion(),
  costeo: PrototypeCostBreakdown = COSTEO,
): Espias {
  const espias: Espias = { enviados: [] };
  mockFetch((url, init) => {
    if (url.includes("/auth/csrf")) return csrfResponse();
    if (url.includes("/auth/me")) return sessionResponse();
    if (url.includes("/products")) return jsonResponse(200, { items: [], total: 0 });
    if (url.includes("/kilns")) return jsonResponse(200, { items: [], total: 0 });
    if (url.includes("/partners")) return jsonResponse(200, { items: [], total: 0 });
    if (url.includes("/prototype-quotations")) {
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      if (init?.method && init.method !== "GET") espias.enviados.push({ url, body });
      if (url.includes("/preview")) return jsonResponse(200, { ...guardada, costing: costeo });
      return jsonResponse(url.endsWith("/prototype-quotations") && init?.method === "POST" ? 201 : 200, guardada);
    }
    return errorResponse(404, "NOT_FOUND");
  });
  return espias;
}

const ultimoEnviado = (espias: Espias) => espias.enviados.at(-1)?.body as Record<string, unknown>;

async function irA(user: ReturnType<typeof userEvent.setup>, etapa: string) {
  await user.click(screen.getByRole("button", { name: new RegExp(etapa, "i") }));
}

/**
 * Elige en un `SelectField`, que no es un `<select>` nativo sino el combobox
 * propio de Greda: se abre con un clic y la opción es un `role="option"`.
 */
async function elegir(
  user: ReturnType<typeof userEvent.setup>,
  campo: string,
  opcion: RegExp,
) {
  await user.click(screen.getByRole("combobox", { name: campo }));
  await user.click(await screen.findByRole("option", { name: opcion }));
}

/** Pone la moneda en dólares con su tasa, que es como se cotiza fuera de Perú. */
async function enDolaresA(user: ReturnType<typeof userEvent.setup>, tasa: string) {
  await elegir(user, "Moneda", /Dólares/);
  await user.type(screen.getByLabelText(/Tipo de cambio/), tasa);
}

/**
 * Describe la pieza, que es lo mínimo para que haya algo que costear.
 *
 * Sin descripción el paso de Costeo no pide el cálculo a propósito: preguntar
 * el precio de una pieza que todavía no existe daría un número inventado.
 */
async function describirPieza(user: ReturnType<typeof userEvent.setup>) {
  await irA(user, "Prototipo");
  await user.type(screen.getByLabelText(/Descripción/), "Taza personalizada");
}

// ---------------------------------------------------------------------------
// El wizard
// ---------------------------------------------------------------------------
describe("Cotizador de prototipos · wizard", () => {
  it("abre en Datos y enseña las siete etapas del documento", () => {
    mockApi();
    renderWithProviders(<PrototypeQuoterPage />);

    for (const etapa of ["Datos", "Prototipo", "Trabajo", "Materiales", "Quema", "Costeo", "Resumen"]) {
      expect(screen.getByRole("button", { name: new RegExp(etapa, "i") })).toBeInTheDocument();
    }
    expect(screen.getByText("Datos generales")).toBeInTheDocument();
  });

  it("se puede saltar de etapa sin perder lo escrito", async () => {
    const user = userEvent.setup();
    mockApi();
    renderWithProviders(<PrototypeQuoterPage />);

    await irA(user, "Prototipo");
    await user.type(screen.getByLabelText(/Descripción/), "Taza");
    await irA(user, "Trabajo");
    await irA(user, "Prototipo");

    expect(screen.getByLabelText(/Descripción/)).toHaveValue("Taza");
  });

  it("el paso de Trabajo dice que una tarifa vacía usa la de la casa", async () => {
    const user = userEvent.setup();
    mockApi();
    renderWithProviders(<PrototypeQuoterPage />);

    await irA(user, "Trabajo");
    expect(screen.getAllByText(/Vacío = la de Configuración/).length).toBeGreaterThan(0);
  });

  it("el precio del matricero se anuncia como fijo, no por día", async () => {
    const user = userEvent.setup();
    mockApi();
    renderWithProviders(<PrototypeQuoterPage />);

    await irA(user, "Trabajo");
    expect(screen.getByText(/Precio fijo en soles/i)).toBeInTheDocument();
  });

  it("el tipo de quema no trae valor por defecto", async () => {
    const user = userEvent.setup();
    mockApi();
    renderWithProviders(<PrototypeQuoterPage />);

    await irA(user, "Quema");
    // Elegir BAJA en silencio cotizaría a una tarifa que nadie escogió.
    expect(screen.getByLabelText(/Tipo de quema/)).toHaveValue("");
  });

  it("la cantidad de material es POR MUESTRA, no el total", async () => {
    const user = userEvent.setup();
    mockApi();
    renderWithProviders(<PrototypeQuoterPage />);

    await irA(user, "Materiales");
    await user.click(screen.getByRole("button", { name: /Añadir material/i }));
    expect(screen.getByLabelText(/Cantidad por muestra/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Autoridad del dinero
// ---------------------------------------------------------------------------
describe("Cotizador de prototipos · autoridad del backend", () => {
  it("FRONT_PROTOTYPE_NO_MONEY_INPUT: el payload no lleva ni un importe calculado", async () => {
    const user = userEvent.setup();
    const espias = mockApi();
    renderWithProviders(<PrototypeQuoterPage />);

    await describirPieza(user);
    await irA(user, "Costeo");
    await vi.waitFor(() => expect(espias.enviados.length).toBeGreaterThan(0));

    const enviado = ultimoEnviado(espias);
    for (const prohibido of [
      "subtotal",
      "tax",
      "tax_amount",
      "total",
      "commercial_net_total",
      "commercial_tax_total",
      "commercial_gross_total",
      "total_per_prototype",
      "estimated_days",
      "rounding_step",
      "unit_cost",
      "uom_code",
    ]) {
      expect(enviado).not.toHaveProperty(prohibido);
    }
  });

  it("los importes del costeo se pintan tal cual llegan, sin recalcular", async () => {
    const user = userEvent.setup();
    mockApi();
    renderWithProviders(<PrototypeQuoterPage />);

    await describirPieza(user);
    await irA(user, "Costeo");
    expect(await screen.findByText("S/ 944.00")).toBeInTheDocument();
    expect(screen.getByText("S/ 144.00")).toBeInTheDocument();
    // Aparece dos veces y está bien: sin factor ni margen, el costo base ES el
    // subtotal comercial. Es justamente lo que distingue este motor del de
    // producción, y verlo repetido es la prueba de que nadie multiplicó nada.
    expect(screen.getAllByText("S/ 800.00")).toHaveLength(2);
  });

  it("el plazo también llega del backend y no se suma en pantalla", async () => {
    const user = userEvent.setup();
    mockApi();
    renderWithProviders(<PrototypeQuoterPage />);

    await describirPieza(user);
    await irA(user, "Costeo");
    expect(await screen.findByText(/9 días/)).toBeInTheDocument();
  });

  it("una tarifa vacía viaja como null, no como cero", async () => {
    const user = userEvent.setup();
    const espias = mockApi();
    renderWithProviders(<PrototypeQuoterPage />);

    await describirPieza(user);
    await irA(user, "Costeo");
    await vi.waitFor(() => expect(espias.enviados.length).toBeGreaterThan(0));

    // Null significa «cobra lo que cobre la casa». Un cero sería un precio
    // pactado de cero, y el borrador dejaría de seguir a Configuración.
    expect(ultimoEnviado(espias).design_rate_override ?? null).toBeNull();
  });

  it("la unidad del material la enseña el backend y no se puede elegir", async () => {
    const user = userEvent.setup();
    mockApi(cotizacion({ id: 12 }));
    renderWithProviders(<PrototypeQuoterPage />);

    await describirPieza(user);
    await irA(user, "Costeo");
    await screen.findByText("S/ 944.00");
    // No hay ningún campo de unidad: viene del catálogo.
    expect(screen.queryByLabelText(/Unidad/i)).not.toBeInTheDocument();
  });

  it("un error del backend se muestra traducido en vez de callarse", async () => {
    const user = userEvent.setup();
    mockFetch((url) => {
      if (url.includes("/auth/csrf")) return csrfResponse();
      if (url.includes("/auth/me")) return sessionResponse();
      if (url.includes("/prototype-quotations")) {
        return errorResponse(422, "PROTOTYPE_QUOTATION_FIRING_RATE_MISSING");
      }
      return jsonResponse(200, { items: [], total: 0 });
    });
    renderWithProviders(<PrototypeQuoterPage />);

    await describirPieza(user);
    await irA(user, "Costeo");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Paridad de moneda con el Cotizador principal
// ---------------------------------------------------------------------------
describe("Cotizador de prototipos · moneda y tipo de cambio", () => {
  it("FRONT_PROTOTYPE_CURRENCY_PARITY: se puede elegir la moneda", () => {
    mockApi();
    renderWithProviders(<PrototypeQuoterPage />);

    expect(screen.getByRole("combobox", { name: "Moneda" })).toBeEnabled();
  });

  it("arranca en soles y sin campo de tipo de cambio", () => {
    mockApi();
    renderWithProviders(<PrototypeQuoterPage />);

    expect(screen.getByRole("combobox", { name: "Moneda" })).toHaveTextContent(/Soles/);
    // En soles no hay conversión que declarar.
    expect(screen.queryByLabelText(/Tipo de cambio/)).not.toBeInTheDocument();
  });

  it("al elegir dólares aparece el tipo de cambio", async () => {
    const user = userEvent.setup();
    mockApi();
    renderWithProviders(<PrototypeQuoterPage />);

    await elegir(user, "Moneda", /Dólares/);
    expect(screen.getByLabelText(/Tipo de cambio/)).toBeInTheDocument();
  });

  it("en dólares sin tasa se avisa y no se deja guardar", async () => {
    const user = userEvent.setup();
    mockApi();
    renderWithProviders(<PrototypeQuoterPage />);

    await elegir(user, "Moneda", /Dólares/);
    expect(screen.getByRole("alert")).toHaveTextContent(/Ingresa el tipo de cambio/i);
    expect(screen.getByRole("button", { name: /Crear borrador/i })).toBeDisabled();
  });

  it("una tasa que no es mayor que cero se rechaza en pantalla", async () => {
    const user = userEvent.setup();
    mockApi();
    renderWithProviders(<PrototypeQuoterPage />);

    await enDolaresA(user, "0");

    expect(screen.getByRole("alert")).toHaveTextContent(/mayor que 0/i);
  });

  it("la pista dice la dirección entera, no sólo el número", async () => {
    const user = userEvent.setup();
    mockApi();
    renderWithProviders(<PrototypeQuoterPage />);

    await enDolaresA(user, "3.75");

    // «3.75» a secas no dice si hay que multiplicar o dividir, y esa duda
    // cuadruplica precios.
    expect(screen.getByText("1 USD = S/ 3.75")).toBeInTheDocument();
  });

  it("volver a soles descarta la tasa en vez de dejarla puesta", async () => {
    const user = userEvent.setup();
    const espias = mockApi();
    renderWithProviders(<PrototypeQuoterPage />);

    await enDolaresA(user, "3.75");
    await elegir(user, "Moneda", /Soles/);

    expect(screen.queryByLabelText(/Tipo de cambio/)).not.toBeInTheDocument();

    await describirPieza(user);
    await irA(user, "Costeo");
    await vi.waitFor(() => expect(espias.enviados.length).toBeGreaterThan(0));
    // El backend devuelve 422 si una cotización en soles trae tasa.
    expect(ultimoEnviado(espias).exchange_rate).toBeNull();
  });

  it("FRONT_PROTOTYPE_CURRENCY_PAYLOAD: la moneda y la tasa viajan al backend", async () => {
    const user = userEvent.setup();
    const espias = mockApi(cotizacion(), COSTEO_USD);
    renderWithProviders(<PrototypeQuoterPage />);

    await enDolaresA(user, "4");
    await describirPieza(user);
    await irA(user, "Costeo");
    await vi.waitFor(() => expect(espias.enviados.length).toBeGreaterThan(0));

    const enviado = ultimoEnviado(espias);
    expect(enviado.currency_code).toBe("USD");
    // Viaja como cadena: convertirla a número es el primer paso para sumarla.
    expect(enviado.exchange_rate).toBe("4");
  });

  it("el precio se enseña en la moneda de emisión", async () => {
    const user = userEvent.setup();
    mockApi(cotizacion(), COSTEO_USD);
    renderWithProviders(<PrototypeQuoterPage />);

    await enDolaresA(user, "4");
    await describirPieza(user);
    await irA(user, "Costeo");

    expect(await screen.findByText("US$ 236.00")).toBeInTheDocument();
    expect(screen.getByText("US$ 36.00")).toBeInTheDocument();
  });

  it("FRONT_PROTOTYPE_COST_STAYS_IN_PEN: el costo interno sigue en soles", async () => {
    const user = userEvent.setup();
    mockApi(cotizacion(), COSTEO_USD);
    renderWithProviders(<PrototypeQuoterPage />);

    await enDolaresA(user, "4");
    await describirPieza(user);
    await irA(user, "Costeo");

    // En soles se le paga al artista: encabezar 200 con `US$` sería mentir.
    expect(await screen.findByText("S/ 200.00")).toBeInTheDocument();
    expect(screen.getByText("S/ 240.00")).toBeInTheDocument();
    expect(screen.getByText(/Costo interno \(en soles\)/)).toBeInTheDocument();
  });

  it("se enseña el neto convertido para explicar por qué el total no es el costo", async () => {
    const user = userEvent.setup();
    mockApi(cotizacion(), COSTEO_USD);
    renderWithProviders(<PrototypeQuoterPage />);

    await enDolaresA(user, "4");
    await describirPieza(user);
    await irA(user, "Costeo");

    expect(await screen.findByText(/Neto convertido/)).toBeInTheDocument();
    expect(screen.getByText("1 USD = S/ 4.00")).toBeInTheDocument();
  });

  it("una cotización emitida en dólares no deja cambiar de moneda", async () => {
    mockApi(
      cotizacion({
        id: 12,
        status: "CONFIRMED",
        code: "CPR-2026-000001",
        currency_code: "USD",
        currency_symbol: "US$",
        exchange_rate: "4.000000",
        costing: COSTEO_USD,
      }),
    );
    renderApp(["/prototipos/cotizador/12"]);

    // Un documento emitido es un papel entregado, no un formulario.
    // «Ver PDF» sólo existe para una emitida: es la señal de que ya cargó.
    await screen.findByRole("link", { name: /Ver PDF/i });
    expect(screen.getByRole("combobox", { name: "Moneda" })).toBeDisabled();
  });

  it("una emitida vuelve a la pantalla con su moneda y su tasa, no con las de hoy", async () => {
    mockApi(
      cotizacion({
        id: 12,
        status: "CONFIRMED",
        code: "CPR-2026-000002",
        currency_code: "USD",
        currency_symbol: "US$",
        exchange_rate: "4.000000",
        costing: COSTEO_USD,
      }),
    );
    renderApp(["/prototipos/cotizador/12"]);

    await screen.findByRole("link", { name: /Ver PDF/i });
    expect(screen.getByLabelText(/Tipo de cambio/)).toHaveValue("4.000000");
  });
});
