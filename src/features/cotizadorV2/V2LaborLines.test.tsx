import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  V2_FIRING,
  V2_ILLUSTRATION,
  V2_LABOR_PAGE,
  V2_MATERIAL_PRODUCTS,
  V2_PRICING,
  V2_TECHNIQUES,
  V2_WORKERS,
} from "@/test/quoterV2Fixtures";
import { csrfResponse, errorResponse, jsonResponse, mockFetch, renderApp } from "@/test/utils";

const USER = {
  id: "11111111-2222-3333-4444-555555555555",
  email: "admin@empresa.com",
  display_name: "Administrador",
  role: "ADMIN" as const,
};

const COTIZACION = {
  id: 7,
  code: "CTZ-V2-2026-000001",
  pricing_engine_version: "V2",
  status: "DRAFT",
  effective_status: "DRAFT" as const,
  client_notes: null,
  issued_at: null,
  valid_until: null,
  expires_at: null,
  issued_by_name: null,
  cancelled_at: null,
  cancelled_by_name: null,
  cancel_reason: null,
  duplicated_from_id: null,
  open_duplicate_id: null,
  production_handoff: null,
  production_type: "RETAIL",
  customer_id: null,
  customer_name: null,
  name: "Pedido demo",
  notes: null,
  customer_kind: "EXTERNAL",
  tax_percent: "18.000000",
  currency_code: "PEN",
  currency_symbol: "S/",
  exchange_rate: null,
  validity_days: 20,
  workday_hours: "8.000000",
  space_service_cost_per_day: "140.000000",
  administrative_cost: "200.000000",
  commercial_factor: "3.000000",
  commercial_factor_min: "2.000000",
  commercial_factor_max: "3.000000",
  low_fire_enabled: true,
  high_fire_enabled: true,
  settings_version: 1,
  created_at: "2026-09-11T10:00:00Z",
  updated_at: "2026-09-11T10:00:00Z",
};

function mockV2(
  overrides: {
    labor?: Response;
    update?: Response;
    workers?: Response;
    techniques?: Response;
    load?: Response;
  } = {},
) {
  return mockFetch((url, init) => {
    const metodo = init.method ?? "GET";
    if (url.includes("/auth/csrf")) return csrfResponse();
    if (url.includes("/auth/me")) return jsonResponse(200, { authenticated: true, user: USER });
    if (url.includes("/quoter-v2/workers")) return overrides.workers ?? jsonResponse(200, V2_WORKERS);
    if (url.includes("/quoter-v2/techniques")) {
      return overrides.techniques ?? jsonResponse(200, V2_TECHNIQUES);
    }
    if (url.includes("/labor/load-worker")) {
      return (
        overrides.load ??
        jsonResponse(201, { created: [], already_loaded_technique_ids: [], warnings: [] })
      );
    }
    if (url.includes("/quoter-v2/materials")) return jsonResponse(200, { items: [] });
    if (url.includes("/labor")) {
      if (metodo !== "GET") {
        return overrides.update ?? jsonResponse(200, V2_LABOR_PAGE.items[0]);
      }
      return overrides.labor ?? jsonResponse(200, V2_LABOR_PAGE);
    }
    if (url.includes("/illustration")) return jsonResponse(200, V2_ILLUSTRATION);
    if (url.includes("/pricing")) return jsonResponse(200, V2_PRICING);
    if (url.includes("/firing")) return jsonResponse(200, V2_FIRING);
    if (url.includes("/planning")) return jsonResponse(200, V2_LABOR_PAGE);
    if (url.includes("/quotations-v2/7/products")) {
      // Una linea COMPLETA: la pantalla de materiales se monta en la misma
      // pagina, y una respuesta a medias la reventaria —`warnings.map` sobre
      // `undefined`— llevandose por delante la seccion que se quiere probar.
      return jsonResponse(200, {
        items: [
          {
            id: 4,
            sort_order: 0,
            product_id: null,
            product_name: "Plato palta",
            quantity: 20,
            body_material_id: null,
            body_material_name: null,
            body_unit_weight: null,
            body_uom: null,
            body_cost_per_unit: null,
            body_cost_is_override: false,
            body_total_weight: "0.000000",
            body_cost: "0.000000000000000000",
            requires_glaze: false,
            glaze_material_id: null,
            glaze_material_name: null,
            glaze_is_reference: false,
            glaze_cost_per_unit: null,
            glaze_cost_is_override: false,
            glaze_percent: null,
            glaze_ml_per_gram: null,
            glaze_conversion_is_fallback: false,
            glaze_total_weight: "0.000000",
            glaze_volume_ml: "0.000000",
            glaze_cost: "0.000000000000000000",
            materials_cost: "0.000000000000000000",
            warnings: [],
          },
        ],
        materials_cost: "0.000000000000000000",
      });
    }
    if (url.includes("/products")) {
      const tipo = new URL(url, "http://x").searchParams.get("product_type");
      const items = V2_MATERIAL_PRODUCTS.filter((p) => p.product_type === tipo);
      return jsonResponse(200, { items, total: items.length, limit: 200, offset: 0 });
    }
    if (url.includes("/quotations-v2/7")) return jsonResponse(200, COTIZACION);
    if (url.includes("/quotations-v2")) return jsonResponse(200, { items: [], total: 0 });
    return jsonResponse(200, {});
  });
}

describe("Mano de obra de una cotización V2 (Fase 010D)", () => {
  it("sin trabajadores lo dice ARRIBA, junto al estado vacío, y dónde darlos de alta", async () => {
    mockV2({ workers: jsonResponse(200, { items: [], total: 0 }) });
    renderApp(["/cotizador-v2/7/mano-de-obra"]);

    const aviso = await screen.findByTestId("mano-de-obra-sin-maestros");
    expect(aviso).toHaveTextContent(/no hay trabajadores activos/i);
    expect(aviso).toHaveTextContent(/Configuración → Cotizador V2/);
    // Va antes que la ilustración, no escondido al final del panel.
    const ilustracion = await screen.findByText(/va aparte de las técnicas productivas/i);
    expect(
      aviso.compareDocumentPosition(ilustracion) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /añadir trabajo/i })).not.toBeInTheDocument();
  });

  it("muestra las horas y el costo que calculó el backend", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7/mano-de-obra"]);

    // 75 piezas a 50 por jornada de 8 h son 12 horas; a S/15 la hora, S/180.
    await screen.findByText("Celso · Vidriado");
    expect(screen.getAllByText("12.000000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("180.000000000000000000").length).toBeGreaterThan(0);
  });

  it("dice de dónde sale la tarifa por hora", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7/mano-de-obra"]);

    // No hay un precio por técnica: la tarifa es el jornal entre la jornada.
    expect(await screen.findByText(/120.000000 por jornada de 8.000000 h/)).toBeInTheDocument();
  });

  it("avisa cuando el trabajo no cabe en la jornada, sin bloquear", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7/mano-de-obra"]);

    expect(await screen.findByText(/superan la jornada configurada/i)).toBeInTheDocument();
    // Y el costo sigue siendo el de las horas: ningún recargo automático.
    expect(screen.getAllByText("180.000000000000000000").length).toBeGreaterThan(0);
  });

  it("el aviso no propone una solución: la decide una persona", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7/mano-de-obra"]);

    expect(await screen.findByText(/decida si se hace en un día largo/i)).toBeInTheDocument();
    // Los días efectivos siguen sin decidir: el sistema sugiere, no elige.
    expect(await screen.findByLabelText(/días efectivos/i)).toHaveValue("");
    // Y el minimo se muestra como lo que es: una sugerencia.
    expect(screen.getByText(/es una sugerencia/i)).toBeInTheDocument();
  });

  it("suma las horas por persona en toda la cotización", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7/mano-de-obra"]);

    // Quien hace tres técnicas para el mismo pedido trabaja UNA jornada.
    expect(await screen.findByText(/jornada por persona/i)).toBeInTheDocument();
    expect(screen.getByText(/una jornada repartida, no tres/i)).toBeInTheDocument();
  });

  it("el rendimiento se presenta como estándar del catálogo", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7/mano-de-obra"]);

    expect(
      await screen.findByText(/no cambia por lo que se produzca/i),
    ).toBeInTheDocument();
  });

  it("no guarda mientras se teclea: espera a que el campo se abandone", async () => {
    const fetchSpy = mockV2();
    renderApp(["/cotizador-v2/7/mano-de-obra"]);
    const user = userEvent.setup();

    await screen.findByText("Celso · Vidriado");
    const cantidad = screen.getByLabelText(/piezas por trabajar/i);
    await user.clear(cantidad);
    await user.type(cantidad, "100");

    const enVuelo = fetchSpy.mock.calls.filter(
      ([url, init]) =>
        String(url).includes("/labor/11") && (init as RequestInit | undefined)?.method === "PUT",
    );
    expect(enVuelo).toHaveLength(0);

    await user.tab();

    await waitFor(() => {
      const guardado = fetchSpy.mock.calls.find(
        ([url, init]) =>
          String(url).includes("/labor/11") && (init as RequestInit | undefined)?.method === "PUT",
      );
      expect(JSON.parse(String((guardado?.[1] as RequestInit).body))).toEqual({ quantity: "100" });
    });
  });

  it("una cantidad vacía se explica en vez de mandarse como cero", async () => {
    const fetchSpy = mockV2();
    renderApp(["/cotizador-v2/7/mano-de-obra"]);
    const user = userEvent.setup();

    await screen.findByText("Celso · Vidriado");
    await user.clear(screen.getByLabelText(/piezas por trabajar/i));
    await user.tab();

    expect(await screen.findByText(/vacío no es cero/i)).toBeInTheDocument();
    const enviados = fetchSpy.mock.calls.filter(
      ([url, init]) =>
        String(url).includes("/labor/11") && (init as RequestInit | undefined)?.method === "PUT",
    );
    expect(enviados).toHaveLength(0);
  });

  it("retirar la tarifa acordada viaja como nulo, no como cadena vacía", async () => {
    const fetchSpy = mockV2();
    renderApp(["/cotizador-v2/7/mano-de-obra"]);
    const user = userEvent.setup();

    await screen.findByText("Celso · Vidriado");
    const tarifa = screen.getByLabelText(/tarifa acordada por hora/i);
    await user.type(tarifa, "18");
    await user.tab();

    await waitFor(() => {
      const guardado = fetchSpy.mock.calls.find(
        ([url, init]) =>
          String(url).includes("/labor/11") && (init as RequestInit | undefined)?.method === "PUT",
      );
      expect(JSON.parse(String((guardado?.[1] as RequestInit).body))).toEqual({
        hourly_rate_override: "18",
      });
    });
  });

  it("la ilustración va aparte de las técnicas y se cobra por horas", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7/mano-de-obra"]);

    expect(await screen.findByText(/ilustrar no es tornear/i)).toBeInTheDocument();
    // 75 piezas son 12 horas y S/165, no dos jornadas de S/110.
    expect(screen.getByText("165.000000000000000000")).toBeInTheDocument();
    expect(screen.getByText("13.750000000000")).toBeInTheDocument();
  });

  it("dice que añadir personal no reduce el plazo", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7/mano-de-obra"]);

    expect(await screen.findByText(/no reduce el plazo/i)).toBeInTheDocument();
  });

  it("un fallo al guardar se explica en vez de perderse", async () => {
    mockV2({ update: errorResponse(422, "V2_LABOR_INPUT_INVALID", "Dato invalido") });
    renderApp(["/cotizador-v2/7/mano-de-obra"]);
    const user = userEvent.setup();

    await screen.findByText("Celso · Vidriado");
    const horas = screen.getByLabelText(/horas finales/i);
    await user.clear(horas);
    await user.type(horas, "20");
    await user.tab();

    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);
  });

  it("se puede volver al rendimiento estándar tras acordar horas", async () => {
    // Sin esto, acordar unas horas sería irreversible: el campo no admite
    // quedarse vacío —vacío no es cero— y no habría forma de deshacerlo.
    const acordada = {
      ...V2_LABOR_PAGE,
      items: [{ ...V2_LABOR_PAGE.items[0]!, hours_overridden: true, final_hours: "20.000000" }],
    };
    const fetchSpy = mockV2({ labor: jsonResponse(200, acordada) });
    renderApp(["/cotizador-v2/7/mano-de-obra"]);
    const user = userEvent.setup();

    await screen.findByText("Celso · Vidriado");
    await user.click(screen.getByRole("button", { name: /volver al estándar/i }));

    await waitFor(() => {
      const guardado = fetchSpy.mock.calls.find(
        ([url, init]) =>
          String(url).includes("/labor/11") && (init as RequestInit | undefined)?.method === "PUT",
      );
      expect(JSON.parse(String((guardado?.[1] as RequestInit).body))).toEqual({
        final_hours_override: null,
      });
    });
  });

  it("el trabajo se puede vincular a un producto de la cotización", async () => {
    const fetchSpy = mockV2();
    renderApp(["/cotizador-v2/7/mano-de-obra"]);
    const user = userEvent.setup();

    await screen.findByText("Celso · Vidriado");
    const selectores = screen.getAllByRole("combobox", { name: "Producto" });
    await user.click(selectores[0]!);
    await user.click(await screen.findByRole("option", { name: "Plato palta" }));

    await waitFor(() => {
      const guardado = fetchSpy.mock.calls.find(
        ([url, init]) =>
          String(url).includes("/labor/11") && (init as RequestInit | undefined)?.method === "PUT",
      );
      expect(JSON.parse(String((guardado?.[1] as RequestInit).body))).toEqual({
        v2_quotation_product_id: 4,
      });
    });
  });
});

describe("Cargar a un trabajador con sus técnicas (corrección 010H)", () => {
  const TORNO = {
    ...V2_TECHNIQUES.items[0]!,
    id: 5,
    code: "torno",
    name: "Torno fácil",
    requires_glaze: false,
  };
  const ASAS = { ...TORNO, id: 6, code: "asas", name: "Armado de asa" };
  const CON_TRES = () => jsonResponse(200, { items: [V2_TECHNIQUES.items[0], TORNO, ASAS] });
  const CELSO_SABE_TRES = () =>
    jsonResponse(200, {
      items: [{ ...V2_WORKERS.items[0]!, technique_ids: [3, 5, 6] }, V2_WORKERS.items[1]],
    });

  async function elegir(
    user: ReturnType<typeof userEvent.setup>,
    campo: string,
    opcion: string,
  ) {
    const selectores = await screen.findAllByRole("combobox", { name: campo });
    await user.click(selectores[selectores.length - 1]!);
    await user.click(await screen.findByRole("option", { name: new RegExp(opcion) }));
  }

  it("elegir al trabajador trae sus técnicas marcadas, sin añadirlas una a una", async () => {
    mockV2({ techniques: CON_TRES(), workers: CELSO_SABE_TRES() });
    renderApp(["/cotizador-v2/7/mano-de-obra"]);
    const user = userEvent.setup();
    await screen.findByText("Celso · Vidriado");

    await elegir(user, "Trabajador", "Celso");

    const grupo = await screen.findByTestId("tecnicas-del-trabajador");
    expect(within(grupo).getByRole("checkbox", { name: /Torno fácil/ })).toBeChecked();
    expect(within(grupo).getByRole("checkbox", { name: /Armado de asa/ })).toBeChecked();
    // Vidriado ya está cargada para Celso en todo el pedido: marcada y bloqueada.
    const vidriado = within(grupo).getByRole("checkbox", { name: /Vidriado/ });
    expect(vidriado).toBeChecked();
    expect(vidriado).toBeDisabled();
    expect(within(grupo).getByText("(ya cargada)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Añadir 2 técnicas" })).toBeEnabled();
  });

  it("desmarcar una la deja fuera del envío, con el producto y sus piezas", async () => {
    const fetchSpy = mockV2({ techniques: CON_TRES(), workers: CELSO_SABE_TRES() });
    renderApp(["/cotizador-v2/7/mano-de-obra"]);
    const user = userEvent.setup();
    await screen.findByText("Celso · Vidriado");

    await elegir(user, "Trabajador", "Celso");
    await elegir(user, "Producto", "Plato palta");
    expect(await screen.findByText(/las piezas nacen en 20/i)).toBeInTheDocument();

    const grupo = await screen.findByTestId("tecnicas-del-trabajador");
    // Para Plato palta no hay nada cargado: las tres salen marcadas.
    await user.click(within(grupo).getByRole("checkbox", { name: /Armado de asa/ }));
    await user.click(screen.getByRole("button", { name: "Añadir 2 técnicas" }));

    await waitFor(() => {
      const carga = fetchSpy.mock.calls.find(
        ([url, init]) =>
          String(url).includes("/quotations-v2/7/labor/load-worker") &&
          (init as RequestInit | undefined)?.method === "POST",
      );
      expect(carga).toBeDefined();
      expect(JSON.parse(String((carga?.[1] as RequestInit).body))).toEqual({
        worker_id: 1,
        v2_quotation_product_id: 4,
        technique_ids: [3, 5],
      });
    });
  });

  it("cambiar de producto vuelve a marcar lo que se desmarcó para el anterior", async () => {
    mockV2({ techniques: CON_TRES(), workers: CELSO_SABE_TRES() });
    renderApp(["/cotizador-v2/7/mano-de-obra"]);
    const user = userEvent.setup();
    await screen.findByText("Celso · Vidriado");

    await elegir(user, "Trabajador", "Celso");
    const grupo = await screen.findByTestId("tecnicas-del-trabajador");
    await user.click(within(grupo).getByRole("checkbox", { name: /Armado de asa/ }));
    expect(within(grupo).getByRole("checkbox", { name: /Armado de asa/ })).not.toBeChecked();

    await elegir(user, "Producto", "Plato palta");
    expect(
      within(await screen.findByTestId("tecnicas-del-trabajador")).getByRole("checkbox", {
        name: /Armado de asa/,
      }),
    ).toBeChecked();
  });

  it("un trabajador sin técnicas lo dice y no ofrece añadir", async () => {
    mockV2();
    renderApp(["/cotizador-v2/7/mano-de-obra"]);
    const user = userEvent.setup();
    await screen.findByText("Celso · Vidriado");

    await elegir(user, "Trabajador", "Refuerzo externo");

    expect(await screen.findByTestId("trabajador-sin-tecnicas")).toHaveTextContent(
      /no tiene técnicas activas habilitadas/i,
    );
    expect(screen.queryByRole("button", { name: /Añadir \d+ técnica/ })).not.toBeInTheDocument();
  });

  it("en la tarea, trabajador y técnica no se cambian; quitar es solo de aquí", async () => {
    const fetchSpy = mockV2();
    renderApp(["/cotizador-v2/7/mano-de-obra"]);
    const user = userEvent.setup();
    await screen.findByText("Celso · Vidriado");

    // Solo el formulario de carga ofrece elegir trabajador; la tarea no.
    expect(screen.getAllByRole("combobox", { name: "Trabajador" })).toHaveLength(1);
    expect(screen.queryByRole("combobox", { name: "Técnica" })).not.toBeInTheDocument();

    const quitar = screen.getByRole("button", { name: "Quitar de esta cotización" });
    expect(quitar.getAttribute("title")).toMatch(/ficha del trabajador no cambia/i);
    await user.click(quitar);

    await waitFor(() => {
      const borrado = fetchSpy.mock.calls.find(
        ([url, init]) =>
          String(url).includes("/labor/11") &&
          (init as RequestInit | undefined)?.method === "DELETE",
      );
      expect(borrado).toBeDefined();
    });
    expect(
      fetchSpy.mock.calls.some(
        ([url, init]) =>
          String(url).includes("/quoter-v2/workers") &&
          ((init as RequestInit | undefined)?.method ?? "GET") !== "GET",
      ),
    ).toBe(false);
  });

  it("una técnica no habilitada se explica sin mostrar el código", async () => {
    mockV2({
      techniques: CON_TRES(),
      workers: CELSO_SABE_TRES(),
      load: errorResponse(422, "V2_LABOR_TECHNIQUE_NOT_ALLOWED", "no"),
    });
    renderApp(["/cotizador-v2/7/mano-de-obra"]);
    const user = userEvent.setup();
    await screen.findByText("Celso · Vidriado");

    await elegir(user, "Trabajador", "Celso");
    await user.click(await screen.findByRole("button", { name: "Añadir 2 técnicas" }));

    const carga = within(screen.getByTestId("cargar-trabajador"));
    const alerta = await carga.findByRole("alert");
    expect(alerta.textContent).not.toContain("V2_LABOR_TECHNIQUE_NOT_ALLOWED");
    expect(alerta).toHaveTextContent(/técnica/i);
  });
});
