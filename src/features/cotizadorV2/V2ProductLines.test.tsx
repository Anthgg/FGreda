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

/** Una línea con el ejemplo aprobado: 20 piezas de 500 g con esmalte. */
const LINEA = {
  id: 11,
  sort_order: 0,
  product_id: null,
  product_name: "Plato palta",
  quantity: 20,
  length_cm: "18.000000",
  width_cm: "12.000000",
  height_cm: "3.000000",
  unit_volume_cm3: "648.000000",
  total_volume_cm3: "12960.000000",
  firing_occupancy_percent: "76.235294",
  firing_volume_share_percent: "100.000000",
  firing_commercial_cost: "450.000000000000000000",
  firing_gas_cost: "105.000000000000000000",
  body_material_id: 3,
  body_material_name: "Arcilla Terranova",
  body_unit_weight: "500.000000",
  body_uom: "g",
  body_cost_per_unit: "0.001300000000",
  body_cost_is_override: false,
  body_total_weight: "10000.000000",
  body_cost: "13.000000000000000000",
  requires_glaze: true,
  glaze_material_id: 9,
  glaze_material_name: "Esmalte B",
  glaze_is_reference: true,
  glaze_cost_per_unit: "0.200000000000",
  glaze_cost_is_override: false,
  glaze_percent: "15.000000",
  glaze_ml_per_gram: null,
  glaze_conversion_is_fallback: true,
  glaze_total_weight: "1500.000000",
  glaze_volume_ml: "1500.000000",
  glaze_cost: "300.000000000000000000",
  materials_cost: "313.000000000000000000",
  warnings: ["V2_GLAZE_REFERENCE_WITHOUT_STOCK"],
};

const PASTAS = {
  items: [
    {
      product_id: 3,
      product_name: "Arcilla Terranova",
      product_type: "RAW_MATERIAL",
      uom_code: "g",
      active: true,
      material_kind: "BODY",
      origin: "PURCHASE",
      purchase_quantity: "100000.000000",
      purchase_cost: "100.000000",
      transport_cost: "30.000000",
      acquisition_total_cost: "130.000000",
      costing_override_per_unit: null,
      effective_cost_per_unit: "0.001300000000",
      ml_per_gram: null,
      notes: null,
      version: 1,
      stock: "50000.000000",
    },
  ],
};

function mockV2(overrides: { lines?: Response; update?: Response } = {}) {
  return mockFetch((url, init) => {
    if (url.includes("/auth/csrf")) return csrfResponse();
    if (url.includes("/auth/me")) return jsonResponse(200, { authenticated: true, user: USER });
    if (url.includes("/quoter-v2/materials")) return jsonResponse(200, PASTAS);
    // La pantalla monta tambien la mano de obra (010D): sin estas respuestas
    // la vista se queda cargando y no se llega a las lineas de material.
    if (url.includes("/quoter-v2/workers")) return jsonResponse(200, V2_WORKERS);
    if (url.includes("/quoter-v2/techniques")) return jsonResponse(200, V2_TECHNIQUES);
    if (url.includes("/labor")) return jsonResponse(200, V2_LABOR_PAGE);
    if (url.includes("/illustration")) return jsonResponse(200, V2_ILLUSTRATION);
    if (url.includes("/pricing")) return jsonResponse(200, V2_PRICING);
    if (url.includes("/firing")) return jsonResponse(200, V2_FIRING);
    // Antes que `/products` a secas: la URL de una línea TAMBIÉN lo contiene,
    // y confundirlas devolvería la página de líneas al catálogo de piezas.
    if (url.includes("/quotations-v2/7/products")) {
      if ((init.method ?? "GET") !== "GET") {
        return overrides.update ?? jsonResponse(200, LINEA);
      }
      return (
        overrides.lines ??
        jsonResponse(200, { items: [LINEA], materials_cost: "313.000000000000000000" })
      );
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

describe("Materiales de una cotización V2 (Fase 010C)", () => {
  it("muestra el costo de pasta ya calculado por el backend", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7"]);

    await screen.findByText("Arcilla Terranova");
    expect(screen.getByText("10000.000000")).toBeInTheDocument();
    expect(screen.getByText("13.000000000000000000")).toBeInTheDocument();
  });

  it("el total de la línea lo trae el backend, no lo suma la pantalla", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7"]);

    // Sumar 13 + 300 aquí sería coma flotante, y con otros importes daría una
    // cola de decimales que no cuadra con el total del documento.
    // Aparece dos veces: en el total del documento y en el de la línea. Que
    // coincidan es justo lo que se está comprobando.
    expect((await screen.findAllByText("313.000000000000000000")).length).toBe(2);
  });

  it("muestra el esmalte al 15 % con su peso y su costo", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7"]);

    await screen.findByText("Esmalte B");
    expect(screen.getByText("15.000000 %")).toBeInTheDocument();
    expect(screen.getByText("1500.000000")).toBeInTheDocument();
    expect(screen.getByText("300.000000000000000000")).toBeInTheDocument();
  });

  it("deja claro que el esmalte propuesto es una referencia de costeo", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7"]);

    // La distinción importa: producción usará otro esmalte y el precio no
    // cambiará por eso.
    // Aparece dos veces a proposito: como procedencia del dato y como aviso
    // destacado. Lo que importa es que la distincion se diga.
    expect((await screen.findAllByText(/referencia de costeo/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/producción elegirá el esmalte real/i)).toBeInTheDocument();
  });

  it("avisa cuando el esmalte de referencia no tiene stock, sin bloquear", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7"]);

    expect(await screen.findByText(/no tiene stock/i)).toBeInTheDocument();
    // Y el costo sigue ahí: sin stock se cotiza igual.
    expect(screen.getByText("300.000000000000000000")).toBeInTheDocument();
  });

  it("dice cuándo la conversión g/ml es la de reserva", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7"]);

    expect(await screen.findByText(/1 g = 1 ml/i)).toBeInTheDocument();
  });

  it("recuerda que cotizar no descuenta inventario", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7"]);

    expect(await screen.findByText(/no descuenta inventario/i)).toBeInTheDocument();
  });

  it("apagar el esmalte se manda al backend, no se calcula en pantalla", async () => {
    const fetchSpy = mockV2();
    renderApp(["/cotizador-v2/7"]);
    const user = userEvent.setup();

    await screen.findByText("Esmalte B");
    // `SelectField` expone su disparador como `combobox` con `aria-label`.
    await user.click(screen.getByRole("combobox", { name: "Esmalte" }));
    await user.click(await screen.findByRole("option", { name: "Sin esmalte" }));

    await waitFor(() => {
      const guardado = fetchSpy.mock.calls.find(
        ([url, init]) =>
          String(url).includes("/products/11") &&
          (init as RequestInit | undefined)?.method === "PUT",
      );
      expect(guardado).toBeDefined();
      const cuerpo = JSON.parse(String((guardado?.[1] as RequestInit).body));
      expect(cuerpo).toEqual({ requires_glaze: false });
    });
  });

  it("no guarda mientras se teclea: espera a que el campo se abandone", async () => {
    const fetchSpy = mockV2();
    renderApp(["/cotizador-v2/7"]);
    const user = userEvent.setup();

    await screen.findByText("Esmalte B");
    const cantidad = screen.getByLabelText(/^cantidad/i);
    await user.clear(cantidad);
    await user.type(cantidad, "50");

    // Vaciar el campo para escribir otra cifra pasa por la cadena vacía, y
    // `Number("")` es 0: guardando al vuelo, la cotización se pondría en cero
    // a mitad de una pulsación.
    const enVuelo = fetchSpy.mock.calls.filter(
      ([url, init]) =>
        String(url).includes("/products/11") &&
        (init as RequestInit | undefined)?.method === "PUT",
    );
    expect(enVuelo).toHaveLength(0);

    await user.tab();

    await waitFor(() => {
      const guardado = fetchSpy.mock.calls.find(
        ([url, init]) =>
          String(url).includes("/products/11") &&
          (init as RequestInit | undefined)?.method === "PUT",
      );
      expect(JSON.parse(String((guardado?.[1] as RequestInit).body))).toEqual({ quantity: 50 });
    });
  });

  it("una cantidad vacía se explica en vez de mandarse como cero", async () => {
    const fetchSpy = mockV2();
    renderApp(["/cotizador-v2/7"]);
    const user = userEvent.setup();

    await screen.findByText("Esmalte B");
    await user.clear(screen.getByLabelText(/^cantidad/i));
    await user.tab();

    expect(await screen.findByText(/vacío no es cero/i)).toBeInTheDocument();
    const enviados = fetchSpy.mock.calls.filter(
      ([url, init]) =>
        String(url).includes("/products/11") &&
        (init as RequestInit | undefined)?.method === "PUT",
    );
    expect(enviados).toHaveLength(0);
  });

  it("una pieza de encargo se puede nombrar al crear la línea", async () => {
    const fetchSpy = mockV2();
    renderApp(["/cotizador-v2/7"]);
    const user = userEvent.setup();

    await screen.findByText("Esmalte B");
    await user.type(screen.getByLabelText(/nueva línea/i), "Jarra de encargo");
    await user.click(screen.getByRole("button", { name: /añadir línea/i }));

    await waitFor(() => {
      const creado = fetchSpy.mock.calls.find(
        ([url, init]) =>
          String(url).endsWith("/quotations-v2/7/products") &&
          (init as RequestInit | undefined)?.method === "POST",
      );
      expect(creado).toBeDefined();
      const cuerpo = JSON.parse(String((creado?.[1] as RequestInit).body));
      expect(cuerpo.product_name).toBe("Jarra de encargo");
    });
  });

  it("un fallo al guardar se explica en vez de perderse", async () => {
    mockV2({ update: errorResponse(422, "V2_MATERIAL_INPUT_INVALID", "Dato invalido") });
    renderApp(["/cotizador-v2/7"]);
    const user = userEvent.setup();

    await screen.findByText("Esmalte B");
    const campo = screen.getByLabelText(/pasta por pieza/i);
    await user.clear(campo);
    await user.type(campo, "600");
    await user.tab();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
