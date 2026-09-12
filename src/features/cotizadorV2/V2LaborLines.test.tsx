import { screen, waitFor } from "@testing-library/react";
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

function mockV2(overrides: { labor?: Response; update?: Response } = {}) {
  return mockFetch((url, init) => {
    const metodo = init.method ?? "GET";
    if (url.includes("/auth/csrf")) return csrfResponse();
    if (url.includes("/auth/me")) return jsonResponse(200, { authenticated: true, user: USER });
    if (url.includes("/quoter-v2/workers")) return jsonResponse(200, V2_WORKERS);
    if (url.includes("/quoter-v2/techniques")) return jsonResponse(200, V2_TECHNIQUES);
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
  it("muestra las horas y el costo que calculó el backend", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7"]);

    // 75 piezas a 50 por jornada de 8 h son 12 horas; a S/15 la hora, S/180.
    await screen.findByText("Celso · Vidriado");
    expect(screen.getAllByText("12.000000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("180.000000000000000000").length).toBeGreaterThan(0);
  });

  it("dice de dónde sale la tarifa por hora", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7"]);

    // No hay un precio por técnica: la tarifa es el jornal entre la jornada.
    expect(await screen.findByText(/120.000000 por jornada de 8.000000 h/)).toBeInTheDocument();
  });

  it("avisa cuando el trabajo no cabe en la jornada, sin bloquear", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7"]);

    expect(await screen.findByText(/superan la jornada configurada/i)).toBeInTheDocument();
    // Y el costo sigue siendo el de las horas: ningún recargo automático.
    expect(screen.getAllByText("180.000000000000000000").length).toBeGreaterThan(0);
  });

  it("el aviso no propone una solución: la decide una persona", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7"]);

    expect(await screen.findByText(/decida si se hace en un día largo/i)).toBeInTheDocument();
    // Los días efectivos siguen sin decidir: el sistema sugiere, no elige.
    expect(await screen.findByLabelText(/días efectivos/i)).toHaveValue("");
    // Y el minimo se muestra como lo que es: una sugerencia.
    expect(screen.getByText(/es una sugerencia/i)).toBeInTheDocument();
  });

  it("suma las horas por persona en toda la cotización", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7"]);

    // Quien hace tres técnicas para el mismo pedido trabaja UNA jornada.
    expect(await screen.findByText(/jornada por persona/i)).toBeInTheDocument();
    expect(screen.getByText(/una jornada repartida, no tres/i)).toBeInTheDocument();
  });

  it("el rendimiento se presenta como estándar del catálogo", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7"]);

    expect(
      await screen.findByText(/no cambia por lo que se produzca/i),
    ).toBeInTheDocument();
  });

  it("no guarda mientras se teclea: espera a que el campo se abandone", async () => {
    const fetchSpy = mockV2();
    renderApp(["/cotizador-v2/7"]);
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
    renderApp(["/cotizador-v2/7"]);
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
    renderApp(["/cotizador-v2/7"]);
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

    renderApp(["/cotizador-v2/7"]);

    expect(await screen.findByText(/ilustrar no es tornear/i)).toBeInTheDocument();
    // 75 piezas son 12 horas y S/165, no dos jornadas de S/110.
    expect(screen.getByText("165.000000000000000000")).toBeInTheDocument();
    expect(screen.getByText("13.750000000000")).toBeInTheDocument();
  });

  it("dice que añadir personal no reduce el plazo", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7"]);

    expect(await screen.findByText(/no reduce el plazo/i)).toBeInTheDocument();
  });

  it("un fallo al guardar se explica en vez de perderse", async () => {
    mockV2({ update: errorResponse(422, "V2_LABOR_INPUT_INVALID", "Dato invalido") });
    renderApp(["/cotizador-v2/7"]);
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
    renderApp(["/cotizador-v2/7"]);
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
    renderApp(["/cotizador-v2/7"]);
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
