/**
 * El estimador de esmalte del Cotizador.
 *
 * Lo que importa aquí es lo que el navegador NO hace: no conoce el porcentaje,
 * no convierte gramos a mililitros y no multiplica el total por cada esmalte.
 * Todo eso lo responde el backend, y estas pruebas fallan si alguien vuelve a
 * meter esa aritmética en el cliente.
 */

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GlazeEstimator } from "@/features/cotizador/GlazeEstimator";
import {
  csrfResponse,
  errorResponse,
  jsonResponse,
  mockFetch,
  renderWithProviders,
  sessionResponse,
} from "@/test/utils";
import type { GlazeEstimateOut, RecipePreparationPage } from "@/types/recipes";

const BATCHES: RecipePreparationPage = {
  items: [
    {
      id: 7,
      code: "PREP-2026-000001",
      recipe_version_id: 10,
      prepared_product_id: 5,
      prepared_product_internal_reference: "PRE-1",
      prepared_product_name: "Esmalte celadón",
      location_id: 1,
      total_dry_weight_g: "1000.000000000000",
      water_amount_ml: "4200.000000000000",
      final_yield_ml: "5000.000000000000",
      solids_g_per_ml: "0.200000000000",
      batch_total_cost: "250.000000",
      unit_cost_per_ml: "0.050000000000",
      status: "COMPLETED",
      prepared_at: "2026-08-29T10:00:00Z",
      lines: [],
    },
  ],
  total: 1,
  limit: 50,
  offset: 0,
};

/** 500 g x 15 % x 20 piezas = 1500 g, y a 0,2 g/ml son 7500 ml. */
const ESTIMATE: GlazeEstimateOut = {
  estimated_glaze_percent: "15.000000",
  piece_weight_g: "500",
  quantity: 20,
  grams_per_piece: "75.000000000000",
  total_estimated_grams: "1500.000000000000",
  allocations: [
    {
      preparation_id: 7,
      preparation_code: "PREP-2026-000001",
      prepared_product_id: 5,
      prepared_product_internal_reference: "PRE-1",
      prepared_product_name: "Esmalte celadón",
      share: "1",
      grams: "1500.000000000000",
      solids_g_per_ml: "0.200000000000",
      millilitres: "7500.000000000000",
      unit_cost_per_ml: "0.050000000000",
      estimated_cost: "375.000000",
    },
  ],
  total_estimated_cost: "375.000000",
};

function mockApi(onEstimate?: (body: Record<string, unknown>) => Response) {
  return mockFetch((url, init) => {
    if (url.includes("/auth/csrf")) return csrfResponse();
    if (url.includes("/auth/me")) return sessionResponse();
    if (url.includes("/recipe-preparations/glaze-estimate")) {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      return onEstimate ? onEstimate(body) : jsonResponse(200, ESTIMATE);
    }
    if (url.includes("/recipe-preparations")) return jsonResponse(200, BATCHES);
    return errorResponse(404, "NOT_FOUND");
  });
}

function render(props: Partial<Parameters<typeof GlazeEstimator>[0]> = {}) {
  return renderWithProviders(
    <GlazeEstimator
      quantity="20"
      disabled={false}
      currencySymbol="S/"
      onApplyGramsPerPiece={props.onApplyGramsPerPiece ?? (() => {})}
      {...props}
    />,
  );
}

async function abrir() {
  await userEvent.click(await screen.findByRole("button", { name: /estimar esmalte/i }));
}

describe("Cotizador · estimador de esmalte", () => {
  it("muestra el porcentaje que responde el backend, no uno propio", async () => {
    mockApi();
    render();
    await abrir();

    await userEvent.type(screen.getByLabelText(/peso de la pieza/i), "500");

    // Si el 15 estuviera escrito en el cliente, cambiarlo en Configuración no
    // cambiaría nada aquí.
    expect(await screen.findByText("15 %")).toBeInTheDocument();
    expect(screen.getByText("75 g")).toBeInTheDocument();
    expect(screen.getByText("1500 g")).toBeInTheDocument();
  });

  it("no envía ningún porcentaje en la petición", async () => {
    let enviado: Record<string, unknown> | null = null;
    mockApi((body) => {
      enviado = body;
      return jsonResponse(200, ESTIMATE);
    });
    render();
    await abrir();

    await userEvent.type(screen.getByLabelText(/peso de la pieza/i), "500");

    await waitFor(() => expect(enviado).not.toBeNull());
    const cuerpo = enviado as unknown as Record<string, unknown>;
    expect(cuerpo["piece_weight_g"]).toBe("500");
    expect(cuerpo["quantity"]).toBe(20);
    expect(cuerpo).not.toHaveProperty("estimated_glaze_percent");
  });

  it("muestra los mililitros del lote y no asume densidad 1", async () => {
    mockApi();
    render();
    await abrir();

    await userEvent.type(screen.getByLabelText(/peso de la pieza/i), "500");
    const selector = await screen.findByRole("combobox", { name: /esmaltes de la pieza/i });
    await userEvent.click(selector);
    await userEvent.click(await screen.findByRole("option", { name: /PREP-2026-000001/ }));

    // Con densidad 1, 1500 g serían 1500 ml. Con la concentración real del
    // lote son 7500.
    expect(await screen.findByText("7500")).toBeInTheDocument();
    expect(screen.getByText("0.2")).toBeInTheDocument();
  });

  it("aplica los gramos por pieza al campo que la cotización sí persiste", async () => {
    const onApply = vi.fn();
    mockApi();
    render({ onApplyGramsPerPiece: onApply });
    await abrir();

    await userEvent.type(screen.getByLabelText(/peso de la pieza/i), "500");
    await userEvent.click(await screen.findByRole("button", { name: /usar 75 g por pieza/i }));

    expect(onApply).toHaveBeenCalledWith("75.000000000000");
  });

  it("no estima sin cantidad a producir", async () => {
    const spy = mockApi();
    render({ quantity: "" });
    await abrir();

    await userEvent.type(screen.getByLabelText(/peso de la pieza/i), "500");

    expect(
      await screen.findByText(/indique primero la cantidad a producir/i),
    ).toBeInTheDocument();
    const llamadas = spy.mock.calls.map(([input]) => String(input));
    expect(llamadas.some((url) => url.includes("glaze-estimate"))).toBe(false);
  });
});
