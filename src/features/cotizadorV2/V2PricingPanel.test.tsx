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

/**
 * Margen y precio del Cotizador V2 en pantalla (Fase 010F).
 *
 * Lo que estas pruebas protegen son las cuatro confusiones que un resumen
 * económico invita a cometer:
 *
 * 1. **fundir el costo real con el de producción.** Son dos bases distintas y
 *    su diferencia es la de la quema: enseñarlas como un solo total la borra;
 * 2. **esconder el suelo.** «¿Está por encima del mínimo?» es la pregunta que
 *    el taller hace siempre, y necesita las tres cifras a la vez;
 * 3. **pedir el factor como porcentaje.** «×2,5» y «+150 %» son el mismo
 *    número dicho de dos formas, y una se confunde con «+250 %»;
 * 4. **calcular en la pantalla.** Todo llega del backend; si se rehiciera aquí
 *    habría dos aritméticas y la de aquí sería de coma flotante.
 */

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

function mockV2(overrides: { pricing?: Response; update?: Response } = {}) {
  return mockFetch((url, init) => {
    if (url.includes("/auth/csrf")) return csrfResponse();
    if (url.includes("/auth/me")) return jsonResponse(200, { authenticated: true, user: USER });
    if (url.includes("/quoter-v2/workers")) return jsonResponse(200, V2_WORKERS);
    if (url.includes("/quoter-v2/techniques")) return jsonResponse(200, V2_TECHNIQUES);
    if (url.includes("/quoter-v2/materials")) return jsonResponse(200, { items: [] });
    if (url.includes("/labor")) return jsonResponse(200, V2_LABOR_PAGE);
    if (url.includes("/illustration")) return jsonResponse(200, V2_ILLUSTRATION);
    if (url.includes("/planning")) return jsonResponse(200, V2_LABOR_PAGE);
    if (url.includes("/firing")) return jsonResponse(200, V2_FIRING);
    if (url.includes("/pricing")) {
      if (init?.method === "PUT") return overrides.update ?? jsonResponse(200, V2_PRICING);
      return overrides.pricing ?? jsonResponse(200, V2_PRICING);
    }
    if (url.includes("/quotations-v2/7/products")) {
      return jsonResponse(200, { items: [], materials_cost: "0.000000000000000000" });
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

/** El panel de precio, ya cargado. La ficha monta varios paneles a la vez. */
async function panelDePrecio(): Promise<HTMLElement> {
  return await screen.findByTestId("panel-precio");
}

describe("Margen y precio de una cotización V2 (Fase 010F)", () => {
  it("enseña las dos bases de costo por separado", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7"]);

    const panel = await panelDePrecio();
    expect(within(panel).getByText("Costo real")).toBeInTheDocument();
    expect(within(panel).getByText("Costo de producción")).toBeInTheDocument();
    expect(within(panel).getByText(V2_PRICING.real_cost)).toBeInTheDocument();
    expect(within(panel).getByText(V2_PRICING.production_cost)).toBeInTheDocument();
  });

  it("dice cuál lleva el gas y cuál la tarifa de quema", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7"]);

    const panel = await panelDePrecio();
    expect(within(panel).getByText(/lleva el gas que se quema/i)).toBeInTheDocument();
    expect(within(panel).getByText(/la tarifa que el taller cobra/i)).toBeInTheDocument();
  });

  it("enseña el suelo, el objetivo y el negociado a la vez", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7"]);

    const panel = await panelDePrecio();
    expect(within(panel).getByText("Precio mínimo ×2")).toBeInTheDocument();
    expect(within(panel).getByText("Precio objetivo ×3")).toBeInTheDocument();
    expect(within(panel).getByText("Precio negociado")).toBeInTheDocument();
    expect(within(panel).getByText(V2_PRICING.price_min)).toBeInTheDocument();
  });

  it("ofrece el factor como multiplicador y no como porcentaje", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7"]);

    const panel = await panelDePrecio();
    const selector = within(panel).getByRole("combobox", { name: "Factor comercial" });
    expect(selector).toHaveTextContent("×3.00");
    // Y no hay ningún campo que pida un porcentaje: «+150 %» y «×2,5» son el
    // mismo número, y uno de los dos se confunde con «+250 %».
    expect(within(panel).queryByLabelText(/porcentaje/i)).toBeNull();
  });

  it("manda solo el factor al cambiarlo", async () => {
    const fetchMock = mockV2();

    renderApp(["/cotizador-v2/7"]);
    const panel = await panelDePrecio();
    const user = userEvent.setup();
    await user.click(within(panel).getByRole("combobox", { name: "Factor comercial" }));
    await user.click(await screen.findByRole("option", { name: "×2.50" }));

    await waitFor(() => {
      const put = fetchMock.mock.calls.find(
        ([url, init]) =>
          String(url).includes("/pricing") && (init as RequestInit | undefined)?.method === "PUT",
      );
      expect(put).toBeDefined();
      const cuerpo = JSON.parse(String((put?.[1] as RequestInit).body));
      expect(cuerpo).toEqual({ commercial_factor: "2.5" });
    });
  });

  it("dice que el IGV va al final y no es ingreso del taller", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7"]);

    const panel = await panelDePrecio();
    expect(within(panel).getByText(/el igv se aplica al final/i)).toBeInTheDocument();
    expect(within(panel).getByText(/no es ingreso del taller/i)).toBeInTheDocument();
    expect(within(panel).getByText("IGV 18.000000 %")).toBeInTheDocument();
  });

  it("explica que el subtotal se reconstruye desde los unitarios", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7"]);

    const panel = await panelDePrecio();
    expect(within(panel).getByText(/sumando las líneas ya redondeadas/i)).toBeInTheDocument();
    expect(within(panel).getByText(V2_PRICING.subtotal)).toBeInTheDocument();
    // El total sale dos veces a proposito: en la cabecera del panel y en el
    // bloque del documento. Se comprueba que estan los dos.
    expect(within(panel).getAllByText(V2_PRICING.total)).toHaveLength(2);
  });

  it("enseña el ajuste por redondeo en vez de esconderlo", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7"]);

    const panel = await panelDePrecio();
    expect(within(panel).getByText("Ajuste por redondeo")).toBeInTheDocument();
    expect(within(panel).getByText(V2_PRICING.rounding_adjustment)).toBeInTheDocument();
  });

  it("reparte el costo por producto y lo deja auditar", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7"]);

    const panel = await panelDePrecio();
    const linea = V2_PRICING.lines[0]!;
    expect(within(panel).getByText("Plato palta")).toBeInTheDocument();
    expect(within(panel).getByText(linea.direct_cost)).toBeInTheDocument();
    expect(within(panel).getByText(linea.production_cost)).toBeInTheDocument();
    expect(within(panel).getByText(linea.unit_price)).toBeInTheDocument();
  });

  it("avisa cuando la cotización se vendería a pérdida", async () => {
    mockV2({
      pricing: jsonResponse(200, {
        ...V2_PRICING,
        estimated_profit: "-500.000000000000000000",
        effective_margin_percent: "-25.000000",
        warnings: ["V2_PRICING_SELLING_BELOW_REAL_COST"],
      }),
    });

    renderApp(["/cotizador-v2/7"]);

    const panel = await panelDePrecio();
    const avisos = within(panel).getByTestId("avisos-precio");
    expect(within(avisos).getByText(/se vendería a pérdida/i)).toBeInTheDocument();
  });

  it("avisa cuando faltan los días efectivos", async () => {
    mockV2({
      pricing: jsonResponse(200, {
        ...V2_PRICING,
        space_cost: "0.000000000000000000",
        warnings: ["V2_PRICING_WORK_DAYS_NOT_SET"],
      }),
    });

    renderApp(["/cotizador-v2/7"]);

    const panel = await panelDePrecio();
    const avisos = within(panel).getByTestId("avisos-precio");
    expect(within(avisos).getByText(/faltan los días efectivos/i)).toBeInTheDocument();
  });

  it("una cotización emitida se lee pero no se toca", async () => {
    mockFetch((url) => {
      if (url.includes("/auth/csrf")) return csrfResponse();
      if (url.includes("/auth/me")) return jsonResponse(200, { authenticated: true, user: USER });
      if (url.includes("/quoter-v2/")) return jsonResponse(200, { items: [] });
      if (url.includes("/labor")) return jsonResponse(200, V2_LABOR_PAGE);
      if (url.includes("/illustration")) return jsonResponse(200, V2_ILLUSTRATION);
      if (url.includes("/firing")) return jsonResponse(200, V2_FIRING);
      if (url.includes("/pricing")) return jsonResponse(200, V2_PRICING);
      if (url.includes("/quotations-v2/7/products")) {
        return jsonResponse(200, { items: [], materials_cost: "0.000000000000000000" });
      }
      if (url.includes("/quotations-v2/7")) {
        return jsonResponse(200, { ...COTIZACION, status: "CONFIRMED" });
      }
      return jsonResponse(200, { items: [], total: 0 });
    });

    renderApp(["/cotizador-v2/7"]);

    const panel = await panelDePrecio();
    expect(within(panel).getByRole("combobox", { name: "Factor comercial" })).toBeDisabled();
  });

  it("un fallo al guardar se explica en vez de perderse", async () => {
    mockV2({
      update: errorResponse(
        422,
        "V2_PRICING_FACTOR_OUT_OF_RANGE",
        "El factor comercial tiene que estar entre x2 y x3",
      ),
    });

    renderApp(["/cotizador-v2/7"]);
    const panel = await panelDePrecio();
    const user = userEvent.setup();
    await user.click(within(panel).getByRole("combobox", { name: "Factor comercial" }));
    await user.click(await screen.findByRole("option", { name: "×2.00" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
