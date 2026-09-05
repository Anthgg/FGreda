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

// El caso de referencia: 450 de costo, 81 de IGV, 531 de total, 6 días.
//
// El ejemplo del Excel v2 daba 800 / 144 / 944 / 9 porque incluía una hornada.
// La quema salió del Cotizador de Prototipos —lo que se cotiza es la muestra en
// barro— y con ella esos números.
const COSTEO: PrototypeCostBreakdown = {
  design_cost: "240.00",
  artist_cost: "200.00",
  mold_maker_cost: "0.00",
  materials_cost: "10.00",
  fixed_cost: "0.00",
  base_cost: "450.00",
  raw_net_total: "450.00",
  currency: "PEN",
  exchange_rate: null,
  raw_tax: "81.00",
  raw_gross_total: "531.00",
  commercial_net_total: "450.00",
  tax_percent: "18",
  commercial_tax_total: "81.00",
  commercial_gross_total: "531.00",
  total_per_prototype: "531.00",
  rounding_step: "0.50",
  rounding_source: "COMMERCIAL_SETTINGS",
  design_rate: "80.00",
  artist_rate: "100.00",
  mold_maker_price: "0.00",
  design_days: "3",
  artist_days: "2",
  mold_maker_days: "0",
  drying_days: "1",
  adjustment_days: "0",
  estimated_days: "6",
  target_date: "2026-09-11",
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

// El mismo caso en dólares a 4.50: el costo sigue siendo 450 soles y el precio
// pasa a 100 + 18 = 118 dólares.
const COSTEO_USD: PrototypeCostBreakdown = {
  ...COSTEO,
  raw_net_total: "100.00",
  currency: "USD",
  exchange_rate: "4.500000",
  raw_tax: "18.00",
  raw_gross_total: "118.00",
  commercial_net_total: "100.00",
  commercial_tax_total: "18.00",
  commercial_gross_total: "118.00",
  total_per_prototype: "118.00",
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
    product_category_id: 4,
    product_code: null,
    product_name: null,
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
  /** TODA url pedida, no solo las que escriben: sirve para probar ausencias. */
  visitadas: string[];
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
  const espias: Espias = { enviados: [], visitadas: [] };
  mockFetch((url, init) => {
    espias.visitadas.push(url);
    if (url.includes("/auth/csrf")) return csrfResponse();
    if (url.includes("/auth/me")) return sessionResponse();
    if (url.includes("/categories"))
      return jsonResponse(200, [{ id: 4, name: "Piezas", display_path: "Piezas", active: true }]);
    if (url.includes("/products")) return jsonResponse(200, { items: [], total: 0 });
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
  // Un concepto nuevo declara su familia: al cobrar se convierte en producto
  // maestro, y el maestro la exige.
  await elegir(user, "Familia del nuevo producto", /Piezas/);
}

// ---------------------------------------------------------------------------
// El wizard
// ---------------------------------------------------------------------------
describe("Cotizador de prototipos · wizard", () => {
  it("PROTOTYPE_QUOTER_STEPS: abre en Datos y enseña las SEIS etapas", () => {
    mockApi();
    renderWithProviders(<PrototypeQuoterPage />);

    for (const etapa of ["Datos", "Prototipo", "Trabajo", "Materiales", "Costeo", "Resumen"]) {
      expect(screen.getByRole("button", { name: new RegExp(etapa, "i") })).toBeInTheDocument();
    }
    expect(screen.getByText("Datos generales")).toBeInTheDocument();
  });

  it("PROTOTYPE_QUOTATION_HAS_FIRING_STEP: no hay etapa de Quema", () => {
    mockApi();
    renderWithProviders(<PrototypeQuoterPage />);

    // Lo que se cotiza es la muestra en barro: no pasa por el horno.
    expect(screen.queryByRole("button", { name: /Quema/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^[1-9]/ })).toHaveLength(6);
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

  it("PROTOTYPE_QUOTATION_USES_KILN: no se pide horno, tipo de quema ni hornadas", async () => {
    const user = userEvent.setup();
    mockApi();
    renderWithProviders(<PrototypeQuoterPage />);

    // Se recorren TODAS las etapas: un campo escondido en cualquiera de ellas
    // seguiría rellenando el modelo viejo en silencio.
    for (const etapa of ["Datos", "Prototipo", "Trabajo", "Materiales", "Costeo", "Resumen"]) {
      await irA(user, etapa);
      expect(screen.queryByLabelText(/Horno/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Tipo de quema/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/hornadas/i)).not.toBeInTheDocument();
    }
  });

  it("el secado y el ajuste siguen pidiéndose: son plazo, no costo", async () => {
    const user = userEvent.setup();
    mockApi();
    renderWithProviders(<PrototypeQuoterPage />);

    await irA(user, "Trabajo");
    expect(screen.getByLabelText(/Días de secado/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Días de ajuste/)).toBeInTheDocument();
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
    expect(await screen.findByText("S/ 531.00")).toBeInTheDocument();
    expect(screen.getByText("S/ 81.00")).toBeInTheDocument();
    // Aparece dos veces y está bien: sin factor ni margen, el costo base ES el
    // subtotal comercial. Es justamente lo que distingue este motor del de
    // producción, y verlo repetido es la prueba de que nadie multiplicó nada.
    expect(screen.getAllByText("S/ 450.00")).toHaveLength(2);
  });

  it("el plazo también llega del backend y no se suma en pantalla", async () => {
    const user = userEvent.setup();
    mockApi();
    renderWithProviders(<PrototypeQuoterPage />);

    await describirPieza(user);
    await irA(user, "Costeo");
    expect(await screen.findByText(/6 días/)).toBeInTheDocument();
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
    await screen.findByText("S/ 531.00");
    // No hay ningún campo de unidad: viene del catálogo.
    expect(screen.queryByLabelText(/Unidad/i)).not.toBeInTheDocument();
  });

  it("un error del backend se muestra traducido en vez de callarse", async () => {
    const user = userEvent.setup();
    mockFetch((url) => {
      if (url.includes("/auth/csrf")) return csrfResponse();
      if (url.includes("/auth/me")) return sessionResponse();
      if (url.includes("/categories"))
        return jsonResponse(200, [{ id: 4, name: "Piezas", display_path: "Piezas", active: true }]);
      if (url.includes("/prototype-quotations")) {
        return errorResponse(422, "PROTOTYPE_QUOTATION_INCOMPLETE");
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

    await enDolaresA(user, "4.5");
    await describirPieza(user);
    await irA(user, "Costeo");
    await vi.waitFor(() => expect(espias.enviados.length).toBeGreaterThan(0));

    const enviado = ultimoEnviado(espias);
    expect(enviado.currency_code).toBe("USD");
    // Viaja como cadena: convertirla a número es el primer paso para sumarla.
    expect(enviado.exchange_rate).toBe("4.5");
  });

  it("el precio se enseña en la moneda de emisión", async () => {
    const user = userEvent.setup();
    mockApi(cotizacion(), COSTEO_USD);
    renderWithProviders(<PrototypeQuoterPage />);

    await enDolaresA(user, "4.5");
    await describirPieza(user);
    await irA(user, "Costeo");

    expect(await screen.findByText("US$ 118.00")).toBeInTheDocument();
    expect(screen.getByText("US$ 18.00")).toBeInTheDocument();
  });

  it("FRONT_PROTOTYPE_COST_STAYS_IN_PEN: el costo interno sigue en soles", async () => {
    const user = userEvent.setup();
    mockApi(cotizacion(), COSTEO_USD);
    renderWithProviders(<PrototypeQuoterPage />);

    await enDolaresA(user, "4.5");
    await describirPieza(user);
    await irA(user, "Costeo");

    // En soles se le paga al artista: encabezar 200 con `US$` sería mentir.
    expect(await screen.findByText("S/ 200.00")).toBeInTheDocument();
    expect(screen.getByText("S/ 240.00")).toBeInTheDocument();
    // Y el costo base tampoco se convierte: sigue siendo el de soles.
    expect(screen.getByText("S/ 450.00")).toBeInTheDocument();
    expect(screen.getByText(/Costo interno \(en soles\)/)).toBeInTheDocument();
  });

  it("se enseña el neto convertido para explicar por qué el total no es el costo", async () => {
    const user = userEvent.setup();
    mockApi(cotizacion(), COSTEO_USD);
    renderWithProviders(<PrototypeQuoterPage />);

    await enDolaresA(user, "4.5");
    await describirPieza(user);
    await irA(user, "Costeo");

    expect(await screen.findByText(/Neto convertido/)).toBeInTheDocument();
    expect(screen.getByText("1 USD = S/ 4.50")).toBeInTheDocument();
  });

  it("una cotización emitida en dólares no deja cambiar de moneda", async () => {
    mockApi(
      cotizacion({
        id: 12,
        status: "CONFIRMED",
        code: "CPR-2026-000001",
        currency_code: "USD",
        currency_symbol: "US$",
        exchange_rate: "4.500000",
        costing: COSTEO_USD,
      }),
    );
    renderApp(["/prototipos/cotizador/12"]);

    // Un documento emitido es un papel entregado, no un formulario.
    // «Registrar cobro» sólo existe para una emitida sin pagar: es la señal
    // de que la cotización guardada ya cargó.
    await screen.findByRole("button", { name: /Registrar cobro/i });
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
        exchange_rate: "4.500000",
        costing: COSTEO_USD,
      }),
    );
    renderApp(["/prototipos/cotizador/12"]);

    await screen.findByRole("button", { name: /Registrar cobro/i });
    // Lo que se afirma es que vuelve LA TASA CONGELADA —4.5, la del día en que
    // se emitió— y no la de hoy. Se escribe «4.5» y no «4.500000» porque la
    // escala de la columna no es parte del acuerdo: ver la prueba de escala.
    expect(screen.getByLabelText(/Tipo de cambio/)).toHaveValue("4.5");
  });
});


// ---------------------------------------------------------------------------
// El producto interno
//
// El código lo emite el backend al cobrar. Antes de eso la pantalla dice que
// está pendiente; inventarlo aquí daría un código que no existe en el maestro.
// ---------------------------------------------------------------------------
describe("Cotizador de prototipos · producto interno", () => {
  it("un concepto nuevo tiene que declarar su familia antes de guardarse", async () => {
    const user = userEvent.setup();
    // Se abre una guardada para que el cliente ya esté puesto y lo único que
    // falte sea la familia.
    mockApi(cotizacion({ product_id: null, product_category_id: null }));
    renderApp(["/prototipos/cotizador/12"]);

    await user.click(await screen.findByRole("button", { name: /Prototipo/i }));

    // Sin familia no se puede guardar: al cobrar habría que crear el producto
    // maestro, y el maestro la exige.
    expect(screen.getByRole("button", { name: /Guardar borrador/i })).toBeDisabled();

    await elegir(user, "Familia del nuevo producto", /Piezas/);
    expect(screen.getByRole("button", { name: /Guardar borrador/i })).toBeEnabled();
  });

  it("FRONTEND_FINISHED_PRODUCT_CODE_AUTHORITY: sin cobrar no hay código, y no se inventa", async () => {
    const user = userEvent.setup();
    mockApi();
    renderWithProviders(<PrototypeQuoterPage />);

    await irA(user, "Prototipo");
    expect(screen.getByText(/pendiente de código interno/i)).toBeInTheDocument();
    // Ni un LAB50 a mano, ni un contador, ni la cantidad de productos + 1.
    expect(screen.queryByText(/LAB50/)).not.toBeInTheDocument();
  });

  it("cobrada, la pantalla enseña el código real y el nombre", async () => {
    mockApi(
      cotizacion({
        id: 12,
        status: "CONFIRMED",
        payment_status: "PAID",
        code: "CPR-2026-000003",
        product_id: 77,
        product_code: "LAB50042",
        product_name: "Jarra Mediterránea",
        prototype_id: 5,
        prototype_code: "PRT-2026-000005",
      }),
    );
    renderApp(["/prototipos/cotizador/12"]);

    // La muestra ya existe: es la señal de que el cobro se registró.
    await screen.findByRole("link", { name: /PRT-2026-000005/ });
    expect(screen.getByText(/LAB50042/)).toBeInTheDocument();
    expect(screen.getAllByText(/Jarra Mediterránea/).length).toBeGreaterThan(0);
  });

  it("una muestra de un producto del catálogo no pide familia nueva", async () => {
    const user = userEvent.setup();
    mockApi(cotizacion({ product_id: 77, product_code: "LAB50001", product_name: "Taza" }));
    renderApp(["/prototipos/cotizador/12"]);

    await user.click(await screen.findByRole("button", { name: /Prototipo/i }));
    // Ya tiene identidad: pedir familia daría a entender que va a nacer otro.
    expect(screen.queryByLabelText(/Familia del nuevo producto/)).not.toBeInTheDocument();
    // Sale en la cabecera y en la ficha de la pieza: las dos son correctas.
    expect(screen.getAllByText(/LAB50001/).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// La escala de la columna no es lo que se tecleó
//
// Defecto encontrado mirando la pantalla, no leyendo el código: se escribía
// «15» de ancho, se guardaba, y el campo volvía como «15.000000». Es la
// precisión de `Numeric(18, 6)` asomando por un sitio donde nadie la pidió.
// Recortar ceros no es aritmética —el valor que viaja es el mismo—, pero
// devolverle a alguien algo distinto de lo que escribió sí es un defecto.
// ---------------------------------------------------------------------------
describe("Cotizador de prototipos · escala de las columnas", () => {
  it("al reabrir una guardada, las medidas y los días vuelven como se teclearon", async () => {
    const user = userEvent.setup();
    mockApi(
      cotizacion({
        width_cm: "15.000000",
        height_cm: "22.000000",
        design_days: "1.000000",
        drying_days: "0.500000",
        currency_code: "USD",
        exchange_rate: "3.800000",
      }),
    );
    renderApp(["/prototipos/cotizador/12"]);

    // La tasa, en el primer paso.
    const tasa = await screen.findByLabelText(/Tipo de cambio/i);
    expect(tasa).toHaveValue("3.8");

    await user.click(screen.getByRole("button", { name: /Prototipo/i }));
    expect(screen.getByLabelText(/Ancho cm/i)).toHaveValue(15);
    expect(screen.getByLabelText(/Alto cm/i)).toHaveValue(22);

    await user.click(screen.getByRole("button", { name: /Trabajo/i }));
    expect(screen.getByLabelText(/Días de diseño/i)).toHaveValue(1);
    // Medio día de secado es medio día: se recortan ceros, no decimales.
    expect(screen.getByLabelText(/Días de secado/i)).toHaveValue(0.5);
  });
});

// ---------------------------------------------------------------------------
// Que no se pida el horno tiene que poder fallar
//
// Habia un mock de `/kilns` respondiendo 200 a nadie. Eso no probaba nada: si
// alguien volviera a llamar a `useKilns()`, el mock contestaria y estas pruebas
// seguirian verdes. Una red de seguridad donde hacia falta un cable trampa.
//
// Ahora el backend de mentira no conoce esa ruta —devolveria 404— y ademas se
// afirma la ausencia sobre lo que REALMENTE se pidio.
// ---------------------------------------------------------------------------
describe("Cotizador de prototipos · el horno no se consulta", () => {
  it("PROTOTYPE_QUOTATION_USES_KILN: recorrer el asistente entero no pide /kilns", async () => {
    const user = userEvent.setup();
    const espias = mockApi();
    renderWithProviders(<PrototypeQuoterPage />);

    // Se usa el mismo ayudante que el resto: el boton de etapa lleva su numero
    // dentro del nombre accesible, asi que anclar el texto no lo encuentra.
    await screen.findByRole("button", { name: /Prototipo/i });
    for (const paso of ["Prototipo", "Trabajo", "Materiales", "Costeo", "Resumen"]) {
      await irA(user, paso);
    }

    expect(espias.visitadas.length).toBeGreaterThan(0);
    const alHorno = espias.visitadas.filter(
      (url) => url.includes("/kilns") || url.includes("/firings") || url.includes("/kiln-rates"),
    );
    expect(alHorno).toEqual([]);
  });
});
