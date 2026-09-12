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
 * Quema del Cotizador V2 en pantalla (Fase 010E).
 *
 * Lo que estas pruebas protegen no es el maquetado: son las tres confusiones
 * que un panel de quema invita a cometer.
 *
 * 1. **mezclar el gas con la tarifa.** Son COSTO y PRECIO. Si aparecieran en la
 *    misma columna, o sumados, la diferencia de la quema —lo único que el
 *    taller quiere mirar aquí— dejaría de poder verse;
 * 2. **prorratear la hornada incompleta.** La barra dice que la segunda va al
 *    60 %, y aun así cuesta una tarifa entera. La pantalla no divide nada;
 * 3. **convertir una recomendación en una acción.** «Cabe en un horno más
 *    chico» es una frase. El horno sigue siendo el que alguien eligió.
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

function mockV2(overrides: { firing?: Response; update?: Response } = {}) {
  return mockFetch((url, init) => {
    if (url.includes("/auth/csrf")) return csrfResponse();
    if (url.includes("/auth/me")) return jsonResponse(200, { authenticated: true, user: USER });
    if (url.includes("/quoter-v2/workers")) return jsonResponse(200, V2_WORKERS);
    if (url.includes("/quoter-v2/techniques")) return jsonResponse(200, V2_TECHNIQUES);
    if (url.includes("/quoter-v2/materials")) return jsonResponse(200, { items: [] });
    if (url.includes("/labor")) return jsonResponse(200, V2_LABOR_PAGE);
    if (url.includes("/illustration")) return jsonResponse(200, V2_ILLUSTRATION);
    if (url.includes("/planning")) return jsonResponse(200, V2_LABOR_PAGE);
    if (url.includes("/pricing")) return jsonResponse(200, V2_PRICING);
    if (url.includes("/firing")) {
      if (init?.method === "PUT") {
        return overrides.update ?? jsonResponse(200, V2_FIRING);
      }
      return overrides.firing ?? jsonResponse(200, V2_FIRING);
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

/**
 * El panel de quema, ya cargado.
 *
 * Se acota a ESTE bloque porque la ficha monta varios paneles a la vez, y
 * varios tienen campos e importes con la misma pinta: una consulta global
 * encontraría el de materiales y la prueba pasaría mirando otra cosa.
 */
async function panelDeQuema(): Promise<HTMLElement> {
  return await screen.findByTestId("panel-quema");
}

describe("Quema de una cotización V2 (Fase 010E)", () => {
  it("muestra las hornadas y los dos totales que calculó el backend", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7"]);

    const panel = await panelDeQuema();
    // 160 % de ocupación son dos hornadas: 2 x 200 + 2 x 250 = 900.
    expect(within(panel).getByText("160.000000 %")).toBeInTheDocument();
    expect(within(panel).getAllByText("900.000000000000000000").length).toBeGreaterThan(0);
    expect(within(panel).getAllByText("210.000000000000000000").length).toBeGreaterThan(0);
  });

  it("no mezcla el costo del gas con la tarifa de quema", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7"]);

    const panel = await panelDeQuema();
    expect(within(panel).getByText(/tarifa de quema \(lo que se cobra\)/i)).toBeInTheDocument();
    expect(within(panel).getByText(/costo real del gas \(lo que cuesta\)/i)).toBeInTheDocument();
  });

  it("enseña la diferencia y dice que no es el margen de la cotización", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7"]);

    const panel = await panelDeQuema();
    expect(within(panel).getByText("690.000000000000000000")).toBeInTheDocument();
    expect(within(panel).getByText(/no es el margen de la cotización/i)).toBeInTheDocument();
  });

  it("dice que cada hornada se cobra entera y que no hay factor por ocupación", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7"]);

    const panel = await panelDeQuema();
    expect(within(panel).getByText(/cada hornada necesaria se cobra entera/i)).toBeInTheDocument();
    expect(within(panel).getByText(/no hay multiplicador por ocupación/i)).toBeInTheDocument();
  });

  it("enseña la carga de cada hornada sin usarla para repartir el costo", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7"]);

    const panel = await panelDeQuema();
    expect(within(panel).getByText("Hornada 1")).toBeInTheDocument();
    expect(within(panel).getByText("Hornada 2")).toBeInTheDocument();
    expect(within(panel).getByText("60.0 %")).toBeInTheDocument();
    // Y el total sigue siendo el de dos hornadas completas, no el prorrateado.
    expect(within(panel).getAllByText("900.000000000000000000").length).toBeGreaterThan(0);
  });

  it("muestra las recomendaciones sin aplicarlas", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7"]);

    const panel = await panelDeQuema();
    const avisos = within(panel).getByTestId("avisos-quema");
    expect(within(avisos).getByText(/se necesita más de una hornada/i)).toBeInTheDocument();
    expect(within(avisos).getByText(/decida usted/i)).toBeInTheDocument();
    // Recomienda el grande y el elegido sigue siendo el chico: una
    // recomendacion es una frase, no un cambio de horno.
    expect(within(panel).getByText("Horno grande")).toBeInTheDocument();
    const selector = within(panel).getByRole("combobox", {
      name: "Horno de esta cotización",
    });
    expect(selector).toHaveTextContent("Horno chico");
  });

  it("manda solo el campo que cambió al elegir otro horno", async () => {
    const fetchMock = mockV2();

    renderApp(["/cotizador-v2/7"]);
    const panel = await panelDeQuema();
    const user = userEvent.setup();
    // `SelectField` expone su disparador como `combobox` con `aria-label`.
    await user.click(within(panel).getByRole("combobox", { name: "Horno de esta cotización" }));
    await user.click(await screen.findByRole("option", { name: /Horno grande/ }));

    await waitFor(() => {
      const put = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === "PUT",
      );
      expect(put).toBeDefined();
      const cuerpo = JSON.parse(String((put?.[1] as RequestInit).body));
      // Solo `kiln_id`: mandar el formulario entero haría que cada guardado
      // pareciera «reelegí el horno» y retiraría las tarifas pactadas.
      expect(Object.keys(cuerpo)).toEqual(["kiln_id"]);
      expect(cuerpo.kiln_id).toBe(2);
    });
  });

  it("vaciar una tarifa retira el acuerdo en vez de mandar un cero", async () => {
    const fetchMock = mockV2({
      firing: jsonResponse(200, {
        ...V2_FIRING,
        gas_cost_low: "40.000000",
        gas_low_is_override: true,
      }),
    });

    renderApp(["/cotizador-v2/7"]);
    const panel = await panelDeQuema();
    const campo = within(panel).getByLabelText(/gas baja/i);
    await userEvent.clear(campo);
    await userEvent.tab();

    await waitFor(() => {
      const put = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === "PUT",
      );
      expect(put).toBeDefined();
      const cuerpo = JSON.parse(String((put?.[1] as RequestInit).body));
      // `null`, no `0`. Un cero sería un acuerdo de gas gratis; el nulo
      // devuelve la tarifa al maestro.
      expect(cuerpo).toEqual({ gas_cost_low_override: null });
    });
  });

  it("no manda nada mientras se escribe una tarifa", async () => {
    const fetchMock = mockV2();

    renderApp(["/cotizador-v2/7"]);
    const panel = await panelDeQuema();
    await userEvent.type(within(panel).getByLabelText(/gas baja/i), "5");

    const puts = fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === "PUT",
    );
    expect(puts).toHaveLength(0);
  });

  it("marca la tarifa acordada dentro de la cotización", async () => {
    mockV2({
      firing: jsonResponse(200, {
        ...V2_FIRING,
        commercial_rate_low: "300.000000",
        commercial_low_is_override: true,
      }),
    });

    renderApp(["/cotizador-v2/7"]);

    const panel = await panelDeQuema();
    expect(within(panel).getByText(/acordada en esta cotización/i)).toBeInTheDocument();
  });

  it("reparte la quema entre los productos y lo deja auditar", async () => {
    mockV2({
      firing: jsonResponse(200, {
        ...V2_FIRING,
        commercial_total: "450.000000000000000000",
        lines: [
          {
            line_id: 11,
            product_name: "A",
            quantity: 10,
            total_volume_cm3: "3400.000000",
            occupancy_percent: "20.000000",
            volume_share_percent: "40.000000",
            commercial_cost: "180.000000000000000000",
            gas_cost: "42.000000000000000000",
          },
          {
            line_id: 12,
            product_name: "B",
            quantity: 10,
            total_volume_cm3: "5100.000000",
            occupancy_percent: "30.000000",
            volume_share_percent: "60.000000",
            commercial_cost: "270.000000000000000000",
            gas_cost: "63.000000000000000000",
          },
        ],
      }),
    });

    renderApp(["/cotizador-v2/7"]);

    const panel = await panelDeQuema();
    expect(within(panel).getByText("40.000000")).toBeInTheDocument();
    expect(within(panel).getByText("60.000000")).toBeInTheDocument();
    expect(within(panel).getByText("180.000000000000000000")).toBeInTheDocument();
    expect(within(panel).getByText("270.000000000000000000")).toBeInTheDocument();
  });

  it("una cotización emitida se lee pero no se toca", async () => {
    mockV2();
    // El detalle de la cotización manda CONFIRMED: la página deja de permitir
    // editar y el panel llega con `canEdit` en falso.
    mockFetch((url) => {
      if (url.includes("/auth/csrf")) return csrfResponse();
      if (url.includes("/auth/me")) return jsonResponse(200, { authenticated: true, user: USER });
      if (url.includes("/quoter-v2/")) return jsonResponse(200, { items: [] });
      if (url.includes("/labor")) return jsonResponse(200, V2_LABOR_PAGE);
      if (url.includes("/illustration")) return jsonResponse(200, V2_ILLUSTRATION);
      if (url.includes("/firing")) return jsonResponse(200, V2_FIRING);
      if (url.includes("/quotations-v2/7/products")) {
        return jsonResponse(200, { items: [], materials_cost: "0.000000000000000000" });
      }
      if (url.includes("/quotations-v2/7")) {
        return jsonResponse(200, { ...COTIZACION, status: "CONFIRMED" });
      }
      return jsonResponse(200, { items: [], total: 0 });
    });

    renderApp(["/cotizador-v2/7"]);

    const panel = await panelDeQuema();
    expect(
      within(panel).getByRole("combobox", { name: "Horno de esta cotización" }),
    ).toBeDisabled();
    expect(within(panel).getByLabelText(/gas baja/i)).toBeDisabled();
  });

  it("un fallo al guardar se explica en vez de perderse", async () => {
    mockV2({ update: errorResponse(409, "V2_FIRING_QUOTATION_NOT_EDITABLE", "Ya no es borrador") });

    renderApp(["/cotizador-v2/7"]);
    const panel = await panelDeQuema();
    const user = userEvent.setup();
    await user.click(within(panel).getByRole("combobox", { name: "Quema alta" }));
    await user.click(await screen.findByRole("option", { name: "No" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
