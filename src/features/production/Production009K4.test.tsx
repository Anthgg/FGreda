/**
 * Fase 009K.4 — la producción de una muestra vive en una orden. F01 a F32.
 *
 * Hasta aquí había dos sistemas para el mismo hecho físico: la orden servía a
 * las cotizaciones y el prototipo tenía su propio arranque, su propio consumo y
 * su propia pantalla. Dos caminos para lo mismo acaban discrepando, y el taller
 * tenía que aprenderse los dos.
 *
 * Lo que estas pruebas fijan en la interfaz:
 *
 * 1. **Una sola lista y una sola ficha.** `/produccion` es de ÓRDENES, vengan
 *    de una cotización o de una muestra, y el origen se lee con códigos.
 * 2. **El almacén es una decisión.** Cobrar abre un diálogo, el almacén empieza
 *    vacío y no se preselecciona ni cuando sólo hay uno activo.
 * 3. **Lo histórico se lee, no se toca.** Las muestras anteriores a esta fase
 *    no tienen orden, no aparecen en la lista y no se les crea una al abrirlas.
 */

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { resetClientState } from "@/api/client";
import {
  ProductionFactorField,
  KilnModeField,
} from "@/features/cotizador/CotizadorPolicyFields";
import {
  csrfResponse,
  errorResponse,
  jsonResponse,
  mockFetch,
  renderApp,
  renderWithProviders,
  sessionResponse,
} from "@/test/utils";
import type { ProductionOrder, ProductionOrderSummary } from "@/types/production";
import type { PrototypeQuotation } from "@/types/prototypeQuotations";
import type { Prototype } from "@/types/prototypes";

const ALMACENES = [
  { id: 1, name: "Almacén principal", active: true },
  { id: 2, name: "Almacén secundario", active: true },
];

function ordenCTZ(overrides: Partial<ProductionOrder> = {}): ProductionOrder {
  return {
    id: 2,
    code: "OP-2026-000002",
    status: "CREATED",
    origin_type: "QUOTATION",
    quotation_id: 349,
    quotation_code: "CTZ-2026-000349",
    quotation_customer_name: "ANA MARIA CISNEROS",
    quotation_payment_status: "PAID",
    prototype_id: null,
    prototype_code: null,
    prototype_quotation_id: null,
    prototype_quotation_code: null,
    stock_location_id: 1,
    stock_location_name: "Almacén principal",
    line_count: 1,
    created_at: "2026-09-02T06:06:00Z",
    started_at: null,
    completed_at: null,
    cancelled_at: null,
    qr_token: "t".repeat(43),
    lines: [
      {
        id: 1,
        quotation_item_id: 1,
        sort_order: 1,
        product_id: 1,
        product_name: "JARRAS",
        product_internal_reference: "LAB50021",
        quantity: 12,
        width: null,
        height: null,
        length: null,
        depth: null,
        recipe_id: 1,
        recipe_version_id: 1,
        material_grams_per_piece: "100",
        prepared_product_id: 7,
        prepared_product_name: "BARNIZ BASE 57",
        prepared_product_internal_reference: "LAB70005",
        required_material_quantity: "1200",
        required_material_uom: "g",
      },
    ],
    readiness: { ready: true, issues: [] },
    ...overrides,
  };
}

function ordenPRT(overrides: Partial<ProductionOrder> = {}): ProductionOrder {
  return {
    ...ordenCTZ(),
    id: 501,
    code: "OP-2026-000501",
    origin_type: "PROTOTYPE",
    quotation_id: null,
    quotation_code: null,
    quotation_customer_name: null,
    quotation_payment_status: null,
    prototype_id: 101,
    prototype_code: "PRT-2026-000101",
    prototype_quotation_id: 12,
    prototype_quotation_code: "CPR-2026-000012",
    lines: [
      {
        id: 9,
        quotation_item_id: null,
        sort_order: 0,
        product_id: 77,
        product_name: "Maceta de muestra",
        product_internal_reference: "LAB50077",
        quantity: 1,
        width: "15",
        height: "20",
        length: "15",
        depth: null,
        recipe_id: null,
        recipe_version_id: null,
        material_grams_per_piece: null,
        prepared_product_id: null,
        prepared_product_name: null,
        prepared_product_internal_reference: null,
        required_material_quantity: null,
        required_material_uom: null,
      },
    ],
    ...overrides,
  };
}

function muestra(overrides: Partial<Prototype> = {}): Prototype {
  return {
    id: 101,
    code: "PRT-2026-000101",
    name: "Maceta de muestra",
    status: "COMPLETED",
    approval: "PENDING",
    technical_specifications: null,
    origin_quotation_ids: [],
    quotation_id: null,
    quotation_code: null,
    product_id: 77,
    stock_location_id: 1,
    quantity: 1,
    target_days: 5,
    requested_at: "2026-09-01T10:00:00Z",
    started_at: "2026-09-02T10:00:00Z",
    completed_at: "2026-09-03T10:00:00Z",
    cancelled_at: null,
    decided_at: null,
    supersedes_prototype_id: null,
    material_count: 1,
    notes: null,
    quotation_payment_status: null,
    production_order_id: 501,
    production_order_code: "OP-2026-000501",
    materials: [
      {
        id: 1,
        product_id: 5,
        sort_order: 0,
        product_name: "Pasta prototipo",
        product_internal_reference: "LAB70001",
        quantity: "1.25",
        quantity_planned: "1.25",
        quantity_actual: "1.25",
        uom_code: "kg",
        material_role: "BODY",
        stage: "PREPARATION",
      },
    ],
    readiness: { ready: true, issues: [] },
    ...overrides,
  };
}

function cpr(overrides: Partial<PrototypeQuotation> = {}): PrototypeQuotation {
  return {
    id: 12,
    code: "CPR-2026-000012",
    status: "CONFIRMED",
    payment_status: "UNPAID",
    paid_at: null,
    confirmed_at: "2026-09-06T10:00:00Z",
    cancelled_at: null,
    customer_id: 3,
    customer_name: "Cliente Prototipo SAC",
    product_id: null,
    product_code: null,
    product_name: null,
    product_category_id: 4,
    description: "Maceta de muestra",
    quantity: 1,
    width_cm: "15",
    length_cm: "15",
    height_cm: "20",
    depth_cm: null,
    technical_specifications: null,
    design_days: "3",
    artist_days: "2",
    design_rate_override: null,
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
    costing: null,
    prototype_id: null,
    prototype_code: null,
    production_order_id: null,
    production_order_code: null,
    updated_at: "2026-09-06T12:00:00Z",
    ...overrides,
  } as PrototypeQuotation;
}

interface Backend {
  enviados: Array<{ url: string; method: string; body: unknown }>;
}

function setupBackend(
  opts: {
    ordenes?: ProductionOrder[];
    muestras?: Prototype[];
    cotizaciones?: PrototypeQuotation[];
    almacenes?: typeof ALMACENES;
    cobroFalla?: boolean;
    cobroDevuelve?: Partial<PrototypeQuotation>;
  } = {},
): Backend {
  const ordenes = opts.ordenes ?? [ordenCTZ()];
  const muestras = opts.muestras ?? [muestra()];
  const cotizaciones = opts.cotizaciones ?? [cpr()];
  const almacenes = opts.almacenes ?? ALMACENES;
  const backend: Backend = { enviados: [] };

  mockFetch((url, init) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (method !== "GET") backend.enviados.push({ url, method, body });

    if (url.includes("/auth/csrf")) return csrfResponse();
    if (url.includes("/auth/me")) return sessionResponse();
    if (url.includes("/inventory/locations")) return jsonResponse(200, almacenes);
    if (url.includes("/categories")) return jsonResponse(200, []);
    if (url.includes("/partners")) return jsonResponse(200, { items: [], total: 0 });
    if (url.includes("/products")) return jsonResponse(200, { items: [], total: 0 });
    if (url.includes("/quotations?") || url.endsWith("/quotations"))
      return jsonResponse(200, { items: [], total: 0, limit: 200, offset: 0 });

    // La hoja de taller viaja como PDF; en pruebas basta con que exista.
    if (url.includes("/document")) {
      return new Response(new Blob(["%PDF-1.4"]), {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      });
    }

    if (url.includes("/production-orders")) {
      const conId = url.match(/\/production-orders\/(\d+)/);
      if (conId) {
        const id = Number(conId[1]);
        const fila = ordenes.find((o) => o.id === id);
        if (!fila) return errorResponse(404, "PRODUCTION_ORDER_NOT_FOUND");
        if (url.includes("/start")) return jsonResponse(200, { ...fila, status: "STARTED" });
        return jsonResponse(200, fila);
      }
      if (method === "POST") {
        return jsonResponse(201, ordenes[ordenes.length - 1]!);
      }
      const resumen: ProductionOrderSummary[] = ordenes;
      return jsonResponse(200, {
        items: resumen,
        total: resumen.length,
        limit: 25,
        offset: 0,
      });
    }

    if (url.includes("/prototype-quotations")) {
      const conId = url.match(/\/prototype-quotations\/(\d+)/);
      const fila = conId
        ? (cotizaciones.find((c) => c.id === Number(conId[1])) ?? cotizaciones[0]!)
        : cotizaciones[0]!;
      if (url.includes("/mark-paid") && method === "POST") {
        if (opts.cobroFalla) return errorResponse(500, "PAYMENT_PROCESSING_ERROR");
        return jsonResponse(200, {
          ...fila,
          payment_status: "PAID",
          prototype_id: 101,
          prototype_code: "PRT-2026-000101",
          production_order_id: 501,
          production_order_code: "OP-2026-000501",
          ...(opts.cobroDevuelve ?? {}),
        });
      }
      if (conId) return jsonResponse(200, fila);
      return jsonResponse(200, {
        items: cotizaciones.map((c) => ({
          id: c.id,
          code: c.code,
          status: c.status,
          payment_status: c.payment_status,
          customer_name: c.customer_name,
          description: c.description,
          quantity: c.quantity,
          commercial_gross_total: "531.00",
          currency_code: c.currency_code,
          currency_symbol: c.currency_symbol,
          estimated_days: "6",
          confirmed_at: c.confirmed_at,
        })),
        total: cotizaciones.length,
      });
    }

    if (url.includes("/prototypes")) {
      const conId = url.match(/\/prototypes\/(\d+)/);
      if (conId) {
        const fila = muestras.find((m) => m.id === Number(conId[1])) ?? muestras[0]!;
        return jsonResponse(200, fila);
      }
      return jsonResponse(200, {
        items: muestras,
        total: muestras.length,
        limit: 25,
        offset: 0,
      });
    }

    return errorResponse(404, "NOT_FOUND");
  });

  return backend;
}

/** Elige un almacén en el diálogo de cobro y confirma. */
async function cobrarCon(user: ReturnType<typeof userEvent.setup>, almacen: RegExp) {
  const dialogo = await screen.findByRole("dialog", { name: /Registrar cobro/i });
  await user.click(await within(dialogo).findByRole("combobox", { name: /almacén de salida/i }));
  await user.click(await screen.findByRole("option", { name: almacen }));
  await user.click(within(dialogo).getByRole("button", { name: /Registrar cobro/i }));
}

beforeEach(() => resetClientState());

// ---------------------------------------------------------------------------
// F01 a F07 — una sola lista operativa
// ---------------------------------------------------------------------------
describe("009K.4 · /produccion es una sola lista de órdenes", () => {
  it("F01 + F02: hay una vista operativa y ninguna pestaña de prototipos", async () => {
    setupBackend({ ordenes: [ordenCTZ(), ordenPRT()] });
    renderApp(["/produccion"]);

    expect(await screen.findAllByRole("table")).toHaveLength(1);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Prototipos/i })).not.toBeInTheDocument();
  });

  it("F03 + F04: la misma tabla lleva las órdenes de cotización y las de muestra", async () => {
    setupBackend({ ordenes: [ordenCTZ(), ordenPRT()] });
    renderApp(["/produccion"]);

    expect(await screen.findByText("OP-2026-000002")).toBeInTheDocument();
    expect(screen.getByText("OP-2026-000501")).toBeInTheDocument();
  });

  it("F05 + F06: el origen se escribe con códigos, no con identificadores", async () => {
    // Un número de fila no le dice nada a quien está en el taller. CTZ-…,
    // CPR-… y PRT-… son lo que aparece impreso en los papeles que tiene
    // delante.
    setupBackend({ ordenes: [ordenCTZ(), ordenPRT()] });
    renderApp(["/produccion"]);

    expect(await screen.findByText("CTZ-2026-000349")).toBeInTheDocument();
    expect(screen.getByText("CPR-2026-000012")).toBeInTheDocument();
    expect(screen.getByText("PRT-2026-000101")).toBeInTheDocument();
  });

  it("F07: la orden de una muestra se abre en /produccion/:order_id", async () => {
    setupBackend({ ordenes: [ordenPRT()] });
    renderApp(["/produccion"]);

    expect(await screen.findByRole("link", { name: /Ver detalle/i })).toHaveAttribute(
      "href",
      "/produccion/501",
    );
  });
});

// ---------------------------------------------------------------------------
// F08 a F13 — la ficha canónica sirve a los dos orígenes
// ---------------------------------------------------------------------------
describe("009K.4 · la ficha canónica de una orden de muestra", () => {
  it("F08: es la MISMA ficha, y dice de dónde viene", async () => {
    setupBackend({ ordenes: [ordenPRT()] });
    renderApp(["/produccion/501"]);

    expect((await screen.findAllByText("OP-2026-000501")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("CPR-2026-000012").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PRT-2026-000101").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Maceta de muestra").length).toBeGreaterThan(0);
    expect(screen.getByText("A 15 · H 20 · L 15")).toBeInTheDocument();
    expect(screen.getAllByText("Almacén principal").length).toBeGreaterThan(0);
  });

  it("F09: los materiales salen de la muestra, con lo previsto y lo real", async () => {
    // PROTOTYPE_RECIPE_SYNTHESIZED: NO. El material de una muestra lo eligió
    // una persona línea por línea; deducirlo de una receta sería inventarlo.
    setupBackend({ ordenes: [ordenPRT()] });
    renderApp(["/produccion/501"]);

    expect(await screen.findByText(/Materiales de la muestra/i)).toBeInTheDocument();
    expect(screen.getByText("Pasta prototipo")).toBeInTheDocument();
    expect(screen.getAllByText("1.25").length).toBeGreaterThan(0);
    expect(screen.getByText("kg")).toBeInTheDocument();
    expect(screen.getByText("Cuerpo")).toBeInTheDocument();
  });

  it("F10: la hoja de taller se ofrece igual que en una orden de cotización", async () => {
    setupBackend({ ordenes: [ordenPRT()] });
    renderApp(["/produccion/501"]);

    expect(await screen.findByRole("button", { name: /Actualizar hoja/i })).toBeInTheDocument();
    expect(await screen.findByTitle(/Hoja de taller OP-2026-000501/i)).toBeInTheDocument();
  });

  it("F11: arrancar se hace desde aquí, y llama a la orden", async () => {
    const backend = setupBackend({ ordenes: [ordenPRT()] });
    const user = userEvent.setup();
    renderApp(["/produccion/501"]);

    await user.click(await screen.findByRole("button", { name: /Arrancar producción/i }));

    await waitFor(() =>
      expect(
        backend.enviados.filter((e) => e.url.includes("/production-orders/501/start")),
      ).toHaveLength(1),
    );
    // Y no por el camino antiguo de la muestra, que ya no se ofrece.
    expect(backend.enviados.filter((e) => e.url.includes("/prototypes/101/start"))).toHaveLength(0);
  });

  it("F12: la evaluación se decide desde la ficha y se guarda en la muestra", async () => {
    // PROTOTYPE_EVALUATION_ACCESSIBLE_FROM_ORDER. El dato sigue viviendo en el
    // prototipo, que es su autoridad; la orden sólo abre la puerta.
    const backend = setupBackend({ ordenes: [ordenPRT()] });
    const user = userEvent.setup();
    renderApp(["/produccion/501"]);

    await user.click(await screen.findByRole("button", { name: /^Aprobar$/i }));

    await waitFor(() =>
      expect(
        backend.enviados.filter((e) => e.url.includes("/prototypes/101/approve")),
      ).toHaveLength(1),
    );
  });

  it("F13: la cadena de iteraciones se ve entera desde la ficha", async () => {
    setupBackend({
      ordenes: [ordenPRT()],
      muestras: [muestra({ supersedes_prototype_id: 100 })],
    });
    renderApp(["/produccion/501"]);

    expect(await screen.findByText("Iteraciones")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /la iteración anterior/i }),
    ).toHaveAttribute("href", "/produccion/prototipos/100");
  });
});

// ---------------------------------------------------------------------------
// F14 a F18 y F27 a F32 — el cobro
// ---------------------------------------------------------------------------
describe("009K.4 · cobrar una cotización de prototipo", () => {
  it("F27: «Registrar cobro» abre el selector de almacén en vez de cobrar", async () => {
    const backend = setupBackend();
    const user = userEvent.setup();
    renderApp(["/prototipos/cotizador/12"]);

    await user.click(await screen.findByRole("button", { name: /Registrar cobro/i }));

    expect(await screen.findByRole("dialog", { name: /Registrar cobro/i })).toBeInTheDocument();
    // Abrir el diálogo no cobra nada todavía.
    expect(backend.enviados.filter((e) => e.url.includes("/mark-paid"))).toHaveLength(0);
  });

  it("F28 + F32: sin almacén elegido no se puede confirmar, ni con uno solo activo", async () => {
    // ONLY_ONE_ACTIVE_LOCATION_AUTO_SELECTED: NO. Es la comodidad evidente y
    // es justo la que hay que resistir: el día que haya dos, el valor por
    // defecto descontará del equivocado sin que nadie lo note.
    const backend = setupBackend({ almacenes: [ALMACENES[0]!] });
    const user = userEvent.setup();
    renderApp(["/prototipos/cotizador/12"]);

    await user.click(await screen.findByRole("button", { name: /Registrar cobro/i }));
    const dialogo = await screen.findByRole("dialog", { name: /Registrar cobro/i });

    const confirmar = within(dialogo).getByRole("button", { name: /Registrar cobro/i });
    expect(confirmar).toBeDisabled();
    await user.click(confirmar);
    expect(backend.enviados.filter((e) => e.url.includes("/mark-paid"))).toHaveLength(0);
  });

  it("F29: se manda el stock_location_id que se eligió, y no otro", async () => {
    const backend = setupBackend();
    const user = userEvent.setup();
    renderApp(["/prototipos/cotizador/12"]);

    await user.click(await screen.findByRole("button", { name: /Registrar cobro/i }));
    await cobrarCon(user, /Almacén secundario/i);

    await waitFor(() => {
      const pagos = backend.enviados.filter((e) => e.url.includes("/mark-paid"));
      expect(pagos).toHaveLength(1);
      expect(pagos[0]!.body).toEqual({ stock_location_id: 2 });
    });
  });

  it("F14 + F15 + F30: al cobrar se navega con el id de la ORDEN", async () => {
    // Los tres identificadores son distintos a propósito. Si la pantalla usara
    // el de la muestra, /produccion/101 existiría como ruta y llevaría a OTRA
    // orden sin dar ningún error.
    setupBackend({ ordenes: [ordenPRT(), ordenCTZ({ id: 101, code: "OP-2026-000101" })] });
    const user = userEvent.setup();
    renderApp(["/prototipos/cotizador/12"]);

    await user.click(await screen.findByRole("button", { name: /Registrar cobro/i }));
    await cobrarCon(user, /Almacén principal/i);

    expect((await screen.findAllByText("OP-2026-000501")).length).toBeGreaterThan(0);
    expect(screen.queryByText("OP-2026-000101")).not.toBeInTheDocument();
  });

  it("F17 + F31: si el cobro falla, no se navega y el error queda a la vista", async () => {
    setupBackend({ cobroFalla: true });
    const user = userEvent.setup();
    renderApp(["/prototipos/cotizador/12"]);

    await user.click(await screen.findByRole("button", { name: /Registrar cobro/i }));
    await cobrarCon(user, /Almacén principal/i);

    expect((await screen.findAllByRole("alert")).length).toBeGreaterThan(0);
    expect(screen.getByText("Pendiente de cobro")).toBeInTheDocument();
    expect(screen.queryByText("OP-2026-000501")).not.toBeInTheDocument();
  });

  it("F16 + F18: una cotización ya pagada enlaza a su orden y no vuelve a cobrar", async () => {
    const backend = setupBackend({
      cotizaciones: [
        cpr({
          payment_status: "PAID",
          prototype_id: 101,
          prototype_code: "PRT-2026-000101",
          production_order_id: 501,
          production_order_code: "OP-2026-000501",
        }),
      ],
      ordenes: [ordenPRT()],
    });
    renderApp(["/prototipos/cotizador/12"]);

    expect(screen.queryByRole("button", { name: /Registrar cobro/i })).not.toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Ir a producción/i })).toHaveAttribute(
      "href",
      "/produccion/501",
    );
    expect(backend.enviados.filter((e) => e.url.includes("/mark-paid"))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// F19 a F23 — lo histórico y lo comercial, cada uno en su sitio
// ---------------------------------------------------------------------------
describe("009K.4 · las muestras históricas y el tablero de cotizaciones", () => {
  it("F19: una muestra CON orden redirige a la ficha canónica", async () => {
    setupBackend({ ordenes: [ordenPRT()] });
    renderApp(["/produccion/prototipos/101"]);

    expect((await screen.findAllByText("OP-2026-000501")).length).toBeGreaterThan(0);
  });

  it("F20 + F21 + F22: una muestra SIN orden se lee, y nada más", async () => {
    const backend = setupBackend({
      muestras: [
        muestra({ id: 9, code: "PRT-2026-000009", production_order_id: null, production_order_code: null }),
      ],
    });
    renderApp(["/produccion/prototipos/9"]);

    expect(await screen.findByText(/Muestra histórica, en sólo lectura/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Iniciar fabricación/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Guardar materiales/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Guardar cambios/i })).not.toBeInTheDocument();
    // Y leerla no le crea la orden que no tiene.
    expect(backend.enviados).toHaveLength(0);
  });

  it("F23: /prototipos sigue siendo el tablero de cotizaciones de prototipo", async () => {
    setupBackend();
    renderApp(["/prototipos"]);

    expect(await screen.findByText("CPR-2026-000012")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Muestras/i })).not.toBeInTheDocument();
    expect(screen.queryByText("PRT-2026-000101")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// F24 a F26 — lo que esta fase NO toca
// ---------------------------------------------------------------------------
describe("009K.4 · regresiones de lo que no se toca", () => {
  it("F24: el factor comercial de 009K.3 sigue siendo opcional y apagado", () => {
    renderWithProviders(
      <ProductionFactorField
        enabled={false}
        configuredFactor="3"
        disabled={false}
        onChange={() => {}}
      />,
    );

    expect(screen.getByText("Factor comercial")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Desactivado" })).toBeChecked();
    // Y sigue sin prometer una regla automática por tramos, que no existe.
    expect(document.body.textContent).not.toMatch(/1\s*\/\s*2\s*\/\s*3/);
  });

  it("F25: el modo de horno de 009K.3 sigue naciendo en «todo junto»", () => {
    renderWithProviders(
      <KilnModeField
        mode="TOGETHER"
        commonKilnId=""
        kilnOptions={[{ value: "1", label: "Horno grande" }]}
        disabled={false}
        onModeChange={() => {}}
        onCommonKilnChange={() => {}}
      />,
    );

    expect(screen.getByText("Modo de horno")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Todo junto/i })).toBeChecked();
  });

  it("F26: la ficha de una orden de cotización no cambió", async () => {
    setupBackend({ ordenes: [ordenCTZ()] });
    renderApp(["/produccion/2"]);

    expect((await screen.findAllByText("OP-2026-000002")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("CTZ-2026-000349").length).toBeGreaterThan(0);
    // Sigue enseñando su material preparado y su requerimiento, que la rama de
    // muestra no tiene.
    expect(screen.getByText("BARNIZ BASE 57")).toBeInTheDocument();
    expect(screen.getByText("1200 g")).toBeInTheDocument();
    // Y no le aparecen las secciones que son de una muestra.
    expect(screen.queryByText(/Materiales de la muestra/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Iteraciones")).not.toBeInTheDocument();
  });
});
