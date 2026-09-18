/**
 * Fase 010I, bloque E — la ejecución real de una orden V2 en pantalla.
 *
 * El backend decide; estas pruebas fijan que la pantalla presenta, captura,
 * confirma y traduce sin inventar reglas: estados con los nombres del taller,
 * lo que falta para finalizar tal como lo dice el backend, consumo en dos
 * pasos y sin autoguardado, idempotencia por intención, comunicaciones que se
 * REGISTRAN y no se envían, y ni un importe.
 */

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { canStart, describeStatus } from "@/features/production/readiness";
import { restar } from "@/features/production/decimales";
import {
  csrfResponse,
  errorResponse,
  jsonResponse,
  mockFetch,
  renderApp,
  sessionResponse,
  TEST_USER,
} from "@/test/utils";
import type { SessionUser } from "@/types/auth";
import type {
  ProductionConsumption,
  ProductionOrder,
  ProductionOrderSummary,
  ProductionTimelineEvent,
} from "@/types/production";

const OPERARIO: SessionUser = {
  ...TEST_USER,
  id: "99999999-2222-3333-4444-555555555555",
  email: "operador@empresa.com",
  display_name: "Operario",
  role: "OPERATOR",
};

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------
function ordenV2(cambios: Partial<ProductionOrder> = {}): ProductionOrder {
  return {
    id: 5,
    code: "OP-2026-000005",
    status: "STARTED",
    origin_type: "V2_QUOTATION",
    quotation_id: null,
    quotation_code: null,
    prototype_id: null,
    prototype_code: null,
    prototype_quotation_id: null,
    prototype_quotation_code: null,
    v2_quotation_id: 41,
    v2_quotation_code: "CTZV2-2026-000041",
    customer_name: "Café La Esquina SAC",
    pieces_summary: "20 × Taza de café, 5 × Plato hondo",
    stock_location_id: 1,
    stock_location_name: "Taller principal",
    line_count: 0,
    created_at: "2026-09-18T14:00:00Z",
    started_at: "2026-09-18T14:10:00Z",
    completed_at: null,
    cancelled_at: null,
    qr_token: "t".repeat(43),
    quotation_customer_name: "Café La Esquina SAC",
    // Una V2 no pasa por el cobro Legacy: esto llega nulo y NO es «impagada».
    quotation_payment_status: null,
    lines: [],
    readiness: { ready: true, issues: [] },
    pending_consumption_kinds: ["BODY"],
    v2_pieces: [
      {
        id: 301,
        sort_order: 0,
        product_name: "Taza de café",
        quantity: 20,
        length_cm: "9.000000000000",
        width_cm: "9.000000000000",
        height_cm: "10.000000000000",
        body_material_id: 88,
        body_material_name: "Pasta gres blanco",
        body_unit_weight: "300.000000000000",
        body_total_weight: "6000.000000000000",
        body_uom: "g",
        requires_glaze: false,
        glaze_material_id: null,
        glaze_material_name: null,
        glaze_is_reference: false,
        glaze_total_weight: "0",
      },
      {
        id: 302,
        sort_order: 1,
        product_name: "Plato hondo",
        quantity: 5,
        length_cm: "20.000000000000",
        width_cm: "20.000000000000",
        height_cm: "4.000000000000",
        body_material_id: 88,
        body_material_name: "Pasta gres blanco",
        body_unit_weight: "450.000000000000",
        body_total_weight: "2250.000000000000",
        body_uom: "g",
        requires_glaze: true,
        glaze_material_id: 90,
        glaze_material_name: "Esmalte blanco",
        glaze_is_reference: true,
        glaze_total_weight: "125.000000000000",
      },
    ],
    ...cambios,
  };
}

function consumo(cambios: Partial<ProductionConsumption> = {}): ProductionConsumption {
  return {
    id: 70,
    production_order_id: 5,
    v2_quotation_product_id: 301,
    product_id: 88,
    product_name: "Pasta gres blanco",
    product_internal_reference: "MP-0088",
    stock_location_id: 1,
    stock_location_name: "Taller principal",
    kind: "BODY",
    quantity: "200.000000000000",
    uom_code: "g",
    balance_after: "800.000000000000",
    stock_movement_id: 900,
    note: null,
    created_by_name: "Operario",
    created_at: "2026-09-18T14:20:00Z",
    ...cambios,
  };
}

const LINEA_DE_TIEMPO: ProductionTimelineEvent[] = [
  {
    type: "STATUS",
    occurred_at: "2026-09-18T14:00:00Z",
    actor_name: "Administrador",
    status: "CREATED",
    consumption: null,
    note: null,
    communication: null,
  },
  {
    type: "STATUS",
    occurred_at: "2026-09-18T14:10:00Z",
    actor_name: "Operario",
    status: "STARTED",
    consumption: null,
    note: null,
    communication: null,
  },
  {
    type: "CONSUMPTION",
    occurred_at: "2026-09-18T14:20:00Z",
    actor_name: "Operario",
    status: null,
    consumption: consumo(),
    note: null,
    communication: null,
  },
  {
    type: "FIRING_NOTE",
    occurred_at: "2026-09-18T15:00:00Z",
    actor_name: "Operario",
    status: null,
    consumption: null,
    note: {
      id: 11,
      production_order_id: 5,
      kind: "FIRING_NOTE",
      body: "Hornada compartida",
      kiln_id: 3,
      kiln_name: "Horno grande",
      firing_type: "HIGH",
      occurred_at: "2026-09-18T15:00:00Z",
      created_by_name: "Operario",
      created_at: "2026-09-18T15:05:00Z",
    },
    communication: null,
  },
  {
    type: "NOTE",
    occurred_at: "2026-09-18T15:30:00Z",
    actor_name: "Operario",
    status: null,
    consumption: null,
    note: {
      id: 12,
      production_order_id: 5,
      kind: "NOTE",
      body: "Revisar asas",
      kiln_id: null,
      kiln_name: null,
      firing_type: null,
      occurred_at: "2026-09-18T15:30:00Z",
      created_by_name: "Operario",
      created_at: "2026-09-18T15:30:00Z",
    },
    communication: null,
  },
  {
    type: "COMMUNICATION",
    occurred_at: "2026-09-18T16:00:00Z",
    actor_name: "Administrador",
    status: null,
    consumption: null,
    note: null,
    communication: {
      id: 21,
      production_order_id: 5,
      channel: "WHATSAPP",
      message: "Hola Ana:\nsus tazas ya están en quema.",
      sent_at: "2026-09-18T16:00:00Z",
      sent_by_name: "Administrador",
      created_at: "2026-09-18T16:01:00Z",
    },
  },
];

type Manejador = (url: string, init: RequestInit) => Response | undefined;

/** El backend de la ficha V2, con lo que cada prueba quiera cambiar encima. */
function backend({
  orden = ordenV2(),
  usuario = TEST_USER,
  consumos = [] as ProductionConsumption[],
  eventos = LINEA_DE_TIEMPO,
  saldo = "1000.000000000000",
  extra = (() => undefined) as Manejador,
} = {}) {
  return mockFetch((url, init) => {
    const propia = extra(url, init);
    if (propia) return propia;
    if (url.includes("/auth/me")) return sessionResponse(usuario);
    if (url.includes("/auth/csrf")) return csrfResponse();
    if (url.includes("/production-orders/5/timeline")) {
      return jsonResponse(200, { items: eventos });
    }
    if (url.includes("/production-orders/5/consumptions")) {
      return jsonResponse(200, { items: consumos, total: consumos.length });
    }
    if (url.includes("/production-orders/5")) return jsonResponse(200, orden);
    if (url.includes("/inventory/locations")) {
      return jsonResponse(200, [{ id: 1, name: "Taller principal", active: true }]);
    }
    if (url.includes("/inventory")) {
      return jsonResponse(200, {
        items: [
          {
            product_id: 88,
            internal_reference: "MP-0088",
            product_name: "Pasta gres blanco",
            location_id: 1,
            location_name: "Taller principal",
            uom_code: "g",
            quantity: saldo,
          },
        ],
        total: 1,
        limit: 200,
        offset: 0,
      });
    }
    if (url.includes("/kilns")) {
      return jsonResponse(200, {
        items: [{ id: 3, code: "KILN-003", name: "Horno grande", active: true }],
        total: 1,
        limit: 100,
        offset: 0,
      });
    }
    return jsonResponse(200, { items: [], total: 0 });
  });
}

function posts(spy: ReturnType<typeof mockFetch>, fragmento: string) {
  return spy.mock.calls.filter(
    ([url, init]) =>
      String(url).includes(fragmento) && (init as RequestInit | undefined)?.method === "POST",
  );
}

function cuerpo(llamada: unknown[]): Record<string, unknown> {
  return JSON.parse(String((llamada[1] as RequestInit).body)) as Record<string, unknown>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Estados y reglas de presentación
// ---------------------------------------------------------------------------
describe("estados con los nombres del taller", () => {
  it("INICIO, EN PROCESO, FINALIZADO y ANULADA, sin estados nuevos", () => {
    expect(describeStatus("CREATED")).toBe("Inicio");
    expect(describeStatus("STARTED")).toBe("En proceso");
    expect(describeStatus("COMPLETED")).toBe("Finalizado");
    expect(describeStatus("CANCELLED")).toBe("Anulada");
  });

  it("una orden V2 se puede iniciar sin cobro Legacy", () => {
    expect(canStart("CREATED", true, null, "V2_QUOTATION")).toBe(true);
    // La Legacy sigue exigiéndolo.
    expect(canStart("CREATED", true, null, "QUOTATION")).toBe(false);
  });

  it("el saldo después se calcula exacto, sin pasar por number", () => {
    expect(restar("1000.000000000000", "200.5")).toBe("799.5");
    expect(restar("0.1", "0.3")).toBe("-0.2");
  });
});

// ---------------------------------------------------------------------------
// Listado
// ---------------------------------------------------------------------------
describe("listado de producción", () => {
  it("muestra cliente, resumen de piezas y origen V2, sin importes", async () => {
    const fila: ProductionOrderSummary = { ...ordenV2() };
    mockFetch((url) => {
      if (url.includes("/auth/me")) return sessionResponse(OPERARIO);
      if (url.includes("/production-orders")) {
        return jsonResponse(200, { items: [fila], total: 1, limit: 25, offset: 0 });
      }
      return jsonResponse(200, {});
    });

    renderApp(["/produccion"]);

    expect(await screen.findByText("Café La Esquina SAC")).toBeInTheDocument();
    expect(screen.getByText("20 × Taza de café, 5 × Plato hondo")).toBeInTheDocument();
    expect(screen.getByText("CTZV2-2026-000041")).toBeInTheDocument();
    expect(screen.getByText("En proceso")).toBeInTheDocument();
    // El operario no abre la cotización V2 (lleva precios): código sin enlace.
    expect(screen.queryByRole("link", { name: "CTZV2-2026-000041" })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/S\/|precio|factor|margen/i);
  });

  it("para ADMIN el código de la V2 enlaza a la cotización", async () => {
    mockFetch((url) => {
      if (url.includes("/auth/me")) return sessionResponse(TEST_USER);
      if (url.includes("/production-orders")) {
        return jsonResponse(200, { items: [ordenV2()], total: 1, limit: 25, offset: 0 });
      }
      return jsonResponse(200, {});
    });

    renderApp(["/produccion"]);

    expect(await screen.findByRole("link", { name: "CTZV2-2026-000041" })).toHaveAttribute(
      "href",
      "/cotizador-v2/41",
    );
  });
});

// ---------------------------------------------------------------------------
// Ficha V2
// ---------------------------------------------------------------------------
describe("ficha de una orden V2", () => {
  it("el operario ve cliente, piezas, medidas y material planificado, sin precios", async () => {
    backend({ usuario: OPERARIO });

    renderApp(["/produccion/5"]);

    expect(await screen.findByTestId("orden-cliente")).toHaveTextContent("Café La Esquina SAC");
    const piezas = screen.getByTestId("orden-piezas");
    expect(within(piezas).getByText("Taza de café")).toBeInTheDocument();
    expect(within(piezas).getByText("Plato hondo")).toBeInTheDocument();
    expect(within(piezas).getByText("9 × 9 × 10 cm")).toBeInTheDocument();
    expect(within(piezas).getAllByText("Pasta gres blanco").length).toBe(2);
    expect(within(piezas).getByText(/300 g por pieza · 6000 g en total/)).toBeInTheDocument();
    expect(within(piezas).getByText("Esmalte blanco")).toBeInTheDocument();
    expect(within(piezas).getByText(/Referencia de costeo/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/S\/|precio|factor|margen|costo total/i);
    // No se pide la cotización V2 ni la hoja Legacy.
    await waitFor(() => expect(screen.getByTestId("seguimiento")).toBeInTheDocument());
  });

  it("una orden V2 NO aparece como pendiente de pago", async () => {
    backend({ orden: ordenV2({ status: "CREATED", started_at: null }) });

    renderApp(["/produccion/5"]);

    expect(await screen.findByRole("button", { name: "Iniciar producción" })).toBeInTheDocument();
    expect(screen.queryByText(/pendiente de pago|impaga/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Iniciar la producción no descuenta material/)).toBeInTheDocument();
  });

  it("caso A: dice qué falta y no deja finalizar", async () => {
    backend({ orden: ordenV2({ pending_consumption_kinds: ["BODY", "GLAZE"] }) });

    renderApp(["/produccion/5"]);

    expect(await screen.findByTestId("orden-faltantes")).toHaveTextContent(
      "Falta registrar consumo real de: pasta y esmalte",
    );
    expect(screen.getByRole("button", { name: "Finalizar producción" })).toBeDisabled();
  });

  it("caso B: sin nada pendiente no hay bloqueo falso", async () => {
    const spy = backend({ orden: ordenV2({ pending_consumption_kinds: [] }) });
    const user = userEvent.setup();

    renderApp(["/produccion/5"]);

    const finalizar = await screen.findByRole("button", { name: "Finalizar producción" });
    expect(finalizar).toBeEnabled();
    expect(screen.queryByTestId("orden-faltantes")).not.toBeInTheDocument();
    await user.click(finalizar);
    await waitFor(() => expect(posts(spy, "/production-orders/5/complete")).toHaveLength(1));
  });

  it("si el backend rechaza finalizar, se traduce lo que falta", async () => {
    backend({
      orden: ordenV2({ pending_consumption_kinds: [] }),
      extra: (url, init) =>
        url.includes("/complete") && init.method === "POST"
          ? jsonResponse(409, {
              error: {
                code: "PRODUCTION_ORDER_CONSUMPTION_MISSING",
                message: "x",
                details: [{ kind: "GLAZE" }],
              },
            })
          : undefined,
    });
    const user = userEvent.setup();
    renderApp(["/produccion/5"]);

    await user.click(await screen.findByRole("button", { name: "Finalizar producción" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Falta registrar consumo real de: esmalte",
    );
  });

  it("el seguimiento pinta cada tipo con su propio detalle, en el orden del backend", async () => {
    backend();

    renderApp(["/produccion/5"]);

    const seguimiento = await screen.findByTestId("seguimiento");
    const tipos = within(seguimiento)
      .getAllByRole("listitem")
      .map((item) => item.getAttribute("data-tipo"));
    expect(tipos).toEqual([
      "STATUS",
      "STATUS",
      "CONSUMPTION",
      "FIRING_NOTE",
      "NOTE",
      "COMMUNICATION",
    ]);
    expect(within(seguimiento).getByText("INICIO")).toBeInTheDocument();
    expect(within(seguimiento).getByText("EN PROCESO")).toBeInTheDocument();
    expect(within(seguimiento).getByText("200 g")).toBeInTheDocument();
    expect(within(seguimiento).getByText("Quema alta")).toBeInTheDocument();
    expect(within(seguimiento).getByText(/en Horno grande/)).toBeInTheDocument();
    expect(within(seguimiento).getByText("Revisar asas")).toBeInTheDocument();
    expect(within(seguimiento).getByText(/Aviso por WhatsApp registrado a mano/)).toBeInTheDocument();
  });

  it("con consumos, anular se explica en vez de ofrecerse (D1)", async () => {
    backend({
      orden: ordenV2({ status: "CREATED", started_at: null }),
      consumos: [consumo()],
    });

    renderApp(["/produccion/5"]);

    expect(await screen.findByTestId("orden-no-anulable")).toHaveTextContent(
      /no puede anularse.*ajuste de inventario/,
    );
    expect(screen.queryByRole("button", { name: "Anular orden" })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/devolver.*autom/i);
  });

  it("finalizada o anulada no ofrece registrar consumo", async () => {
    backend({ orden: ordenV2({ status: "COMPLETED", pending_consumption_kinds: [] }) });

    renderApp(["/produccion/5"]);

    await screen.findByTestId("orden-cliente");
    expect(screen.queryByRole("button", { name: "Registrar consumo" })).not.toBeInTheDocument();
  });

  it("404: pantalla clara, sin romper", async () => {
    mockFetch((url) => {
      if (url.includes("/auth/me")) return sessionResponse();
      if (url.includes("/production-orders/5")) {
        return errorResponse(404, "PRODUCTION_ORDER_NOT_FOUND");
      }
      return jsonResponse(200, { items: [], total: 0 });
    });

    renderApp(["/produccion/5"]);

    expect(await screen.findByRole("alert")).toHaveTextContent(/ya no existe/i);
  });
});

// ---------------------------------------------------------------------------
// Consumo
// ---------------------------------------------------------------------------
async function abrirConsumo(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Registrar consumo" }));
  return screen.findByRole("dialog", { name: /Registrar consumo real/i });
}

describe("registrar consumo", () => {
  it("rellenar no envía nada; confirmar muestra saldo antes y después", async () => {
    const spy = backend({ usuario: OPERARIO });
    const user = userEvent.setup();
    renderApp(["/produccion/5"]);

    const dialogo = await abrirConsumo(user);
    // El material planificado se propone solo.
    await waitFor(() =>
      expect(
        within(dialogo).getByRole("combobox", { name: /^Material/ }),
      ).toHaveTextContent(/Pasta gres blanco/),
    );
    await user.type(within(dialogo).getByLabelText(/Cantidad/i), "200,5");

    // NO_AUTOSAVE: escribir no manda ni un consumo.
    expect(posts(spy, "/consumptions")).toHaveLength(0);

    await user.click(within(dialogo).getByRole("button", { name: "Revisar consumo" }));
    expect(within(dialogo).getByTestId("consumo-saldo-actual")).toHaveTextContent("1000 g");
    expect(within(dialogo).getByTestId("consumo-saldo-despues")).toHaveTextContent("799.5 g");
    expect(
      within(dialogo).getByText("Este consumo generará un movimiento de inventario."),
    ).toBeInTheDocument();
    expect(posts(spy, "/consumptions")).toHaveLength(0);
  });

  it("confirmar manda UNA petición con su clave, aunque se haga doble clic", async () => {
    let responder: (() => void) | null = null;
    const spy = backend({
      extra: (url, init) => {
        if (url.includes("/consumptions") && init.method === "POST") {
          // Se queda colgada hasta que la prueba la suelta: el segundo clic
          // llega mientras la primera está en vuelo.
          return undefined;
        }
        return undefined;
      },
    });
    spy.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/consumptions") && init?.method === "POST") {
        await new Promise<void>((resolve) => {
          responder = resolve;
        });
        return jsonResponse(201, consumo());
      }
      if (url.includes("/auth/me")) return sessionResponse(TEST_USER);
      if (url.includes("/auth/csrf")) return csrfResponse();
      if (url.includes("/production-orders/5/timeline")) {
        return jsonResponse(200, { items: LINEA_DE_TIEMPO });
      }
      if (url.includes("/production-orders/5/consumptions")) {
        return jsonResponse(200, { items: [], total: 0 });
      }
      if (url.includes("/production-orders/5")) return jsonResponse(200, ordenV2());
      if (url.includes("/inventory/locations")) {
        return jsonResponse(200, [{ id: 1, name: "Taller principal", active: true }]);
      }
      if (url.includes("/inventory")) {
        return jsonResponse(200, {
          items: [
            {
              product_id: 88,
              internal_reference: "MP-0088",
              product_name: "Pasta gres blanco",
              location_id: 1,
              location_name: "Taller principal",
              uom_code: "g",
              quantity: "1000",
            },
          ],
          total: 1,
          limit: 200,
          offset: 0,
        });
      }
      return jsonResponse(200, { items: [], total: 0 });
    });
    const user = userEvent.setup();
    renderApp(["/produccion/5"]);

    const dialogo = await abrirConsumo(user);
    await waitFor(() =>
      expect(within(dialogo).getByRole("combobox", { name: /^Material/ })).toHaveTextContent(
        /Pasta gres blanco/,
      ),
    );
    await user.type(within(dialogo).getByLabelText(/Cantidad/i), "200");
    await user.click(within(dialogo).getByRole("button", { name: "Revisar consumo" }));
    const confirmar = within(dialogo).getByRole("button", { name: "Confirmar consumo" });
    await user.click(confirmar);
    await user.click(within(dialogo).getByRole("button", { name: /Procesando|Confirmar/ }));

    await waitFor(() => expect(posts(spy, "/consumptions")).toHaveLength(1));
    const [llamada] = posts(spy, "/consumptions");
    const enviado = cuerpo(llamada!);
    expect(enviado).toMatchObject({
      product_id: 88,
      stock_location_id: 1,
      quantity: "200",
      kind: "BODY",
    });
    expect(String(enviado.idempotency_key)).toMatch(/^[0-9a-f-]{36}$/);
    responder!();
    expect(await screen.findByText(/Consumo registrado: 200 g de Pasta gres blanco/)).toBeInTheDocument();
  });

  it("stock insuficiente: se traduce y el reintento usa la MISMA clave", async () => {
    let intentos = 0;
    const spy = backend({
      extra: (url, init) => {
        if (url.includes("/consumptions") && init.method === "POST") {
          intentos += 1;
          return intentos === 1
            ? errorResponse(503, "SERVICE_UNAVAILABLE")
            : errorResponse(422, "NEGATIVE_STOCK_NOT_ALLOWED");
        }
        return undefined;
      },
    });
    const user = userEvent.setup();
    renderApp(["/produccion/5"]);

    const dialogo = await abrirConsumo(user);
    await waitFor(() =>
      expect(within(dialogo).getByRole("combobox", { name: /^Material/ })).toHaveTextContent(
        /Pasta gres blanco/,
      ),
    );
    await user.type(within(dialogo).getByLabelText(/Cantidad/i), "300");
    await user.click(within(dialogo).getByRole("button", { name: "Revisar consumo" }));
    await user.click(within(dialogo).getByRole("button", { name: "Confirmar consumo" }));
    await within(dialogo).findByRole("alert");
    // Reintento de la MISMA operación.
    await user.click(within(dialogo).getByRole("button", { name: "Confirmar consumo" }));

    expect(
      await within(dialogo).findByText(/No hay stock suficiente para registrar este consumo/),
    ).toBeInTheDocument();
    const enviados = posts(spy, "/consumptions").map(cuerpo);
    expect(enviados).toHaveLength(2);
    expect(enviados[1]!.idempotency_key).toBe(enviados[0]!.idempotency_key);
    expect(document.body.textContent).not.toMatch(/\b422\b|\b409\b/);
  });

  it("volver a editar es otra operación: otra clave", async () => {
    const spy = backend({
      extra: (url, init) =>
        url.includes("/consumptions") && init.method === "POST"
          ? errorResponse(422, "NEGATIVE_STOCK_NOT_ALLOWED")
          : undefined,
    });
    const user = userEvent.setup();
    renderApp(["/produccion/5"]);

    const dialogo = await abrirConsumo(user);
    await waitFor(() =>
      expect(within(dialogo).getByRole("combobox", { name: /^Material/ })).toHaveTextContent(
        /Pasta gres blanco/,
      ),
    );
    const cantidad = within(dialogo).getByLabelText(/Cantidad/i);
    await user.type(cantidad, "300");
    await user.click(within(dialogo).getByRole("button", { name: "Revisar consumo" }));
    await user.click(within(dialogo).getByRole("button", { name: "Confirmar consumo" }));
    await within(dialogo).findByRole("alert");
    await user.click(within(dialogo).getByRole("button", { name: "Volver a editar" }));
    await user.clear(within(dialogo).getByLabelText(/Cantidad/i));
    await user.type(within(dialogo).getByLabelText(/Cantidad/i), "100");
    await user.click(within(dialogo).getByRole("button", { name: "Revisar consumo" }));
    await user.click(within(dialogo).getByRole("button", { name: "Confirmar consumo" }));

    await waitFor(() => expect(posts(spy, "/consumptions")).toHaveLength(2));
    const [primero, segundo] = posts(spy, "/consumptions").map(cuerpo);
    expect(segundo!.idempotency_key).not.toBe(primero!.idempotency_key);
  });

  it("si no alcanza el saldo leído, lo dice y no deja confirmar", async () => {
    backend({ saldo: "50" });
    const user = userEvent.setup();
    renderApp(["/produccion/5"]);

    const dialogo = await abrirConsumo(user);
    await waitFor(() =>
      expect(within(dialogo).getByRole("combobox", { name: /^Material/ })).toHaveTextContent(
        /Pasta gres blanco/,
      ),
    );
    await user.type(within(dialogo).getByLabelText(/Cantidad/i), "80");
    await user.click(within(dialogo).getByRole("button", { name: "Revisar consumo" }));

    expect(within(dialogo).getByRole("alert")).toHaveTextContent(
      "No hay stock suficiente para registrar este consumo",
    );
    expect(within(dialogo).getByRole("button", { name: "Confirmar consumo" })).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Comunicaciones
// ---------------------------------------------------------------------------
async function abrirComunicacion(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Registrar comunicación" }));
  return screen.findByRole("dialog", { name: "Registrar comunicación" });
}

describe("registrar comunicación", () => {
  it("dice REGISTRAR, nunca enviar, y aclara que no sale nada del sistema", async () => {
    backend();
    const user = userEvent.setup();
    renderApp(["/produccion/5"]);

    const dialogo = await abrirComunicacion(user);

    expect(within(dialogo).getByText(/El sistema no envía ningún mensaje/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Enviar WhatsApp|Mensaje enviado|Enviar al cliente/);
  });

  it("la sugerencia rellena el texto, se puede editar y se manda el FINAL con sus saltos", async () => {
    const spy = backend({
      extra: (url, init) =>
        url.includes("/communications") && init.method === "POST"
          ? jsonResponse(201, {
              id: 22,
              production_order_id: 5,
              channel: "WHATSAPP",
              message: "x",
              sent_at: "2026-09-18T16:00:00Z",
              sent_by_name: "Administrador",
              created_at: "2026-09-18T16:00:00Z",
            })
          : undefined,
    });
    const user = userEvent.setup();
    renderApp(["/produccion/5"]);

    const dialogo = await abrirComunicacion(user);
    await user.click(within(dialogo).getByRole("button", { name: "Listo" }));
    const texto = within(dialogo).getByLabelText(/Mensaje que enviaste/i);
    expect(texto).toHaveValue("Hola, tu pedido está listo. Puedes pasar a recogerlo.");
    await user.type(texto, "{Enter}Gracias, Ana");
    await user.click(within(dialogo).getByRole("button", { name: "Registrar comunicación" }));

    await waitFor(() => expect(posts(spy, "/communications")).toHaveLength(1));
    const enviado = cuerpo(posts(spy, "/communications")[0]!);
    expect(enviado.message).toBe(
      "Hola, tu pedido está listo. Puedes pasar a recogerlo.\nGracias, Ana",
    );
    expect(enviado.channel).toBe("WHATSAPP");
    // Sin plantilla ficticia ni autor elegido en pantalla.
    expect(Object.keys(enviado).sort()).toEqual(
      ["channel", "idempotency_key", "message", "sent_at"].sort(),
    );
    expect(String(enviado.sent_at)).toMatch(/-05:00$/);
    expect(await screen.findByText("Comunicación registrada en el seguimiento.")).toBeInTheDocument();
  });

  it("la comunicación registrada aparece en el seguimiento y en su sección", async () => {
    backend();

    renderApp(["/produccion/5"]);

    const seccion = await screen.findByTestId("orden-comunicaciones");
    expect(within(seccion).getByText(/sus tazas ya están en quema/)).toBeInTheDocument();
    expect(within(seccion).getByText(/registrado por Administrador/)).toBeInTheDocument();
  });

  it.each([
    ["FINALIZADO", "COMPLETED"],
    ["ANULADA", "CANCELLED"],
  ] as const)("con la orden %s se sigue pudiendo registrar", async (_nombre, status) => {
    backend({ orden: ordenV2({ status, pending_consumption_kinds: [] }) });

    renderApp(["/produccion/5"]);

    expect(
      await screen.findByRole("button", { name: "Registrar comunicación" }),
    ).toBeInTheDocument();
  });

  it("el operario también registra comunicaciones", async () => {
    backend({ usuario: OPERARIO });

    renderApp(["/produccion/5"]);

    expect(
      await screen.findByRole("button", { name: "Registrar comunicación" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar consumo" })).toBeInTheDocument();
    // Anular sigue siendo de ADMIN.
    expect(screen.queryByRole("button", { name: "Anular orden" })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Quema (D4)
// ---------------------------------------------------------------------------
describe("registrar quema", () => {
  it("manda sólo los campos del backend: horno, tipo y cuándo", async () => {
    const spy = backend({
      extra: (url, init) =>
        url.includes("/notes") && init.method === "POST"
          ? jsonResponse(201, LINEA_DE_TIEMPO[3]!.note)
          : undefined,
    });
    const user = userEvent.setup();
    renderApp(["/produccion/5"]);

    await user.click(await screen.findByRole("button", { name: "Registrar quema" }));
    const dialogo = await screen.findByRole("dialog", { name: "Registrar quema" });
    await user.click(within(dialogo).getByRole("combobox", { name: /Horno/i }));
    await user.click(await screen.findByRole("option", { name: "Horno grande" }));
    await user.click(within(dialogo).getByRole("combobox", { name: /Tipo de quema/i }));
    await user.click(await screen.findByRole("option", { name: "Quema alta" }));
    await user.click(within(dialogo).getByRole("button", { name: "Registrar quema" }));

    await waitFor(() => expect(posts(spy, "/notes")).toHaveLength(1));
    const enviado = cuerpo(posts(spy, "/notes")[0]!);
    expect(enviado).toMatchObject({ kind: "FIRING_NOTE", kiln_id: 3, firing_type: "HIGH" });
    expect(Object.keys(enviado).sort()).toEqual(
      ["firing_type", "idempotency_key", "kiln_id", "kind", "occurred_at"].sort(),
    );
  });

  it("en INICIO no se ofrece registrar quema", async () => {
    backend({ orden: ordenV2({ status: "CREATED", started_at: null }) });

    renderApp(["/produccion/5"]);

    expect(await screen.findByRole("button", { name: "Añadir nota" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar quema" })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Hallazgos del smoke local
// ---------------------------------------------------------------------------
describe("hallazgos del smoke local", () => {
  it("sin tocar la fecha se manda el instante EXACTO y el reintento repite fecha y clave", async () => {
    let intentos = 0;
    const spy = backend({
      extra: (url, init) => {
        if (url.includes("/communications") && init.method === "POST") {
          intentos += 1;
          return intentos === 1
            ? errorResponse(503, "SERVICE_UNAVAILABLE")
            : jsonResponse(201, {
                id: 23,
                production_order_id: 5,
                channel: "WHATSAPP",
                message: "Hola",
                sent_at: "2026-09-18T16:00:00Z",
                sent_by_name: "Administrador",
                created_at: "2026-09-18T16:00:00Z",
              });
        }
        return undefined;
      },
    });
    const user = userEvent.setup();
    renderApp(["/produccion/5"]);

    const dialogo = await abrirComunicacion(user);
    await user.type(within(dialogo).getByLabelText(/Mensaje que enviaste/i), "Hola");
    await user.click(within(dialogo).getByRole("button", { name: "Registrar comunicación" }));
    await within(dialogo).findByRole("alert");
    // Reintento sin cambiar nada: la MISMA operación.
    await user.click(within(dialogo).getByRole("button", { name: "Registrar comunicación" }));

    await waitFor(() => expect(posts(spy, "/communications")).toHaveLength(2));
    const [primero, segundo] = posts(spy, "/communications").map(cuerpo);
    // Con segundos: «ahora» truncado al minuto quedaría antes de lo que acaba de pasar.
    expect(String(primero!.sent_at)).toMatch(/T\d{2}:\d{2}:\d{2}\.\d{3}-05:00$/);
    expect(segundo!.sent_at).toBe(primero!.sent_at);
    expect(segundo!.idempotency_key).toBe(primero!.idempotency_key);
  });

  it("cambiar el mensaje tras un fallo es otra comunicación: otra clave", async () => {
    const spy = backend({
      extra: (url, init) =>
        url.includes("/communications") && init.method === "POST"
          ? errorResponse(503, "SERVICE_UNAVAILABLE")
          : undefined,
    });
    const user = userEvent.setup();
    renderApp(["/produccion/5"]);

    const dialogo = await abrirComunicacion(user);
    const texto = within(dialogo).getByLabelText(/Mensaje que enviaste/i);
    await user.type(texto, "Hola");
    await user.click(within(dialogo).getByRole("button", { name: "Registrar comunicación" }));
    await within(dialogo).findByRole("alert");
    await user.type(texto, " de nuevo");
    await user.click(within(dialogo).getByRole("button", { name: "Registrar comunicación" }));

    await waitFor(() => expect(posts(spy, "/communications")).toHaveLength(2));
    const [primero, segundo] = posts(spy, "/communications").map(cuerpo);
    expect(segundo!.idempotency_key).not.toBe(primero!.idempotency_key);
  });

  it("el aviso de éxito no sobrevive a la acción siguiente", async () => {
    backend({
      orden: ordenV2({ pending_consumption_kinds: [] }),
      extra: (url, init) => {
        if (url.includes("/notes") && init.method === "POST") {
          return jsonResponse(201, LINEA_DE_TIEMPO[4]!.note);
        }
        if (url.includes("/complete") && init.method === "POST") {
          return jsonResponse(200, ordenV2({ status: "COMPLETED", pending_consumption_kinds: [] }));
        }
        return undefined;
      },
    });
    const user = userEvent.setup();
    renderApp(["/produccion/5"]);

    await user.click(await screen.findByRole("button", { name: "Añadir nota" }));
    const dialogo = await screen.findByRole("dialog", { name: "Añadir nota" });
    await user.type(within(dialogo).getByLabelText(/^Nota/), "Revisar asas");
    await user.click(within(dialogo).getByRole("button", { name: "Guardar nota" }));
    expect(await screen.findByText("Nota añadida al seguimiento.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Finalizar producción" }));

    await waitFor(() =>
      expect(screen.queryByText("Nota añadida al seguimiento.")).not.toBeInTheDocument(),
    );
  });
});
