/**
 * Fase 009D en el navegador: preparar un lote y estimar esmalte.
 *
 * Lo que se comprueba aquí no es la aritmética —esa vive en el backend y tiene
 * sus propias pruebas— sino que el navegador no la duplique: que muestre lo que
 * el servidor responde, que no invente el porcentaje ni la concentración, y que
 * cada envío de una preparación lleve su clave de idempotencia.
 */

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CATEGORIES, PRODUCTS_PAGE, STOCK_PAGE, UNITS } from "@/test/mastersFixtures";
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
  RecipeCalculateOut,
  RecipeOut,
  RecipePage,
  RecipePreparationOut,
  RecipePreparationPage,
} from "@/types/recipes";

const VERSION_ID = 10;

const RECIPE: RecipeOut = {
  id: 1,
  product_id: 5,
  product_internal_reference: "PRE-1",
  product_name: "Esmalte celadón",
  name: "Celadón base",
  active: true,
  current_version_id: VERSION_ID,
  current_version: {
    id: VERSION_ID,
    recipe_id: 1,
    version_number: 1,
    status: "ACTIVE",
    yield_factor: "1.000000",
    base_total: "100.000000",
    additional_total: "0.000000",
    fingerprint: "hash-celadon",
    notes: null,
    created_at: "2026-08-22T10:00:00Z",
    updated_at: "2026-08-22T10:00:00Z",
    lines: [],
  },
  versions: [],
  versions_count: 1,
  created_at: "2026-08-22T10:00:00Z",
  updated_at: "2026-08-22T10:00:00Z",
};

const RECIPES_PAGE: RecipePage = { items: [RECIPE], total: 1, limit: 8, offset: 0 };

const CALC: RecipeCalculateOut = {
  target_base_quantity: "1000.000000",
  target_uom: "g",
  real_output_quantity: "1000.000000",
  yield_factor: "1.000000",
  base_cost: "250.000000",
  colorant_cost: "0.000000",
  additive_cost: "0.000000",
  total_material_cost: "250.000000",
  cost_per_real_unit: "0.250000",
  components: [
    {
      component_product_id: 1,
      component_name: "Arcilla blanca",
      component_internal_reference: "INS-1",
      component_type: "BASE",
      percentage: "100.000000",
      required_quantity: "1000.000000",
      uom: "g",
      unit_cost_in_grams: "0.250000",
      component_cost: "250.000000",
    },
  ],
};

/**
 * 1000 g secos en 5000 ml: 0,2 g/ml. Los números los emite el backend; aquí
 * sólo se comprueba que la pantalla los muestre sin recalcularlos.
 */
const BATCH: RecipePreparationOut = {
  id: 7,
  code: "PREP-2026-000001",
  recipe_version_id: VERSION_ID,
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
  lines: [
    {
      id: 1,
      component_product_id: 1,
      component_internal_reference: "INS-1",
      component_name: "Arcilla blanca",
      quantity_g: "1000.000000000000",
      unit_cost_snapshot: "0.250000",
      line_cost: "250.000000",
    },
  ],
};

const BATCHES: RecipePreparationPage = { items: [BATCH], total: 1, limit: 50, offset: 0 };

const LOCATIONS = [{ id: 1, name: "Mariano Pastor", description: null, active: true }];

function mockApi(
  overrides: {
    user?: SessionUser;
    onRequest?: (url: string, init: RequestInit) => Response | undefined;
  } = {},
) {
  return mockFetch((url, init) => {
    const custom = overrides.onRequest?.(url, init);
    if (custom) return custom;

    if (url.includes("/auth/csrf")) return csrfResponse();
    if (url.includes("/auth/me")) return sessionResponse(overrides.user ?? TEST_USER);
    if (url.includes("/recipe-preparations")) return jsonResponse(200, BATCHES);
    if (url.includes("/recipe-imports/latest-batch")) return jsonResponse(200, { batch_id: null });
    if (url.includes("/recipes/calculate")) return jsonResponse(200, CALC);
    if (url.includes("/recipes")) return jsonResponse(200, RECIPES_PAGE);
    if (url.includes("/inventory/locations")) return jsonResponse(200, LOCATIONS);
    if (url.includes("/inventory")) return jsonResponse(200, STOCK_PAGE);
    if (url.includes("/products")) return jsonResponse(200, PRODUCTS_PAGE);
    if (url.includes("/categories")) return jsonResponse(200, CATEGORIES);
    if (url.includes("/units")) return jsonResponse(200, UNITS);
    return errorResponse(404, "NOT_FOUND");
  });
}

async function abrirPreparaciones() {
  const tab = await screen.findByRole("tab", { name: "Preparaciones" });
  await userEvent.click(tab);
}

describe("Recetas · preparaciones", () => {
  it("muestra la concentración y el costo por mililitro que emite el backend", async () => {
    mockApi();
    renderApp(["/recetas"]);
    await abrirPreparaciones();

    // 0,2 g/ml y 0,05 por ml salen del lote. El navegador no divide peso seco
    // entre rendimiento: ese número es el puente g <-> ml de todo el sistema.
    const historial = await screen.findByText(/PREP-2026-000001/);
    const fila = historial.closest("tr");
    expect(fila).not.toBeNull();
    expect(within(fila!).getByText("0.2")).toBeInTheDocument();
    expect(within(fila!).getByText("0.05")).toBeInTheDocument();
  });

  it("envía la preparación con clave de idempotencia y sin código inventado", async () => {
    let enviado: Record<string, unknown> | null = null;
    const spy = mockApi({
      onRequest: (url, init) => {
        if (url.includes("/recipe-preparations") && init.method === "POST") {
          enviado = JSON.parse(String(init.body)) as Record<string, unknown>;
          return jsonResponse(201, BATCH);
        }
        return undefined;
      },
    });
    renderApp(["/recetas"]);
    await abrirPreparaciones();

    await userEvent.click(await screen.findByRole("button", { name: /Celadón base/ }));

    const ubicacion = await screen.findByRole("combobox", { name: /ubicación/i });
    await userEvent.click(ubicacion);
    await userEvent.click(await screen.findByRole("option", { name: "Mariano Pastor" }));

    await userEvent.clear(screen.getByLabelText(/agua \(ml\)/i));
    await userEvent.type(screen.getByLabelText(/agua \(ml\)/i), "4200");
    await userEvent.type(screen.getByLabelText(/rendimiento final/i), "5000");

    await userEvent.click(screen.getByRole("button", { name: /confirmar preparación/i }));

    await waitFor(() => expect(enviado).not.toBeNull());
    const cuerpo = enviado as unknown as Record<string, unknown>;
    expect(cuerpo["recipe_version_id"]).toBe(VERSION_ID);
    expect(cuerpo["total_dry_weight_g"]).toBe("1000");
    expect(cuerpo["final_yield_ml"]).toBe("5000");
    // Sin esta clave, un reintento del navegador descontaría dos veces la
    // misma mezcla.
    expect(String(cuerpo["idempotency_key"]).length).toBeGreaterThan(8);
    // El código es autoridad del backend: no se envía ninguno.
    expect(cuerpo).not.toHaveProperty("code");
    expect(cuerpo).not.toHaveProperty("solids_g_per_ml");
    expect(spy).toHaveBeenCalled();
  });

  it("no permite confirmar sin el rendimiento medido", async () => {
    mockApi();
    renderApp(["/recetas"]);
    await abrirPreparaciones();

    await userEvent.click(await screen.findByRole("button", { name: /Celadón base/ }));

    // El rendimiento no se deduce de peso seco + agua: los sólidos ocupan
    // volumen y parte del agua se absorbe. Sin la medida real no hay lote.
    expect(await screen.findByRole("button", { name: /confirmar preparación/i })).toBeDisabled();
  });

  it("un operador no puede registrar preparaciones", async () => {
    mockApi({ user: { ...TEST_USER, role: "OPERATOR" } });
    renderApp(["/recetas"]);
    await abrirPreparaciones();

    await userEvent.click(await screen.findByRole("button", { name: /Celadón base/ }));
    await userEvent.type(await screen.findByLabelText(/rendimiento final/i), "5000");

    expect(screen.getByRole("button", { name: /confirmar preparación/i })).toBeDisabled();
    expect(
      screen.getByText(/solo un administrador puede registrar preparaciones/i),
    ).toBeInTheDocument();
  });
});
