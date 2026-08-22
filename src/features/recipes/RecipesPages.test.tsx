import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  CATEGORIES,
  PRODUCTS_PAGE,
  UNITS,
} from "@/test/mastersFixtures";
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
import type { RecipeCalculateOut, RecipeOut, RecipePage, RecipeVersionOut } from "@/types/recipes";

const RECIPE_VERSION_1: RecipeVersionOut = {
  id: 10,
  recipe_id: 1,
  version_number: 1,
  status: "ACTIVE",
  yield_factor: "1.0500",
  base_total: "100.0000",
  additional_total: "5.0000",
  fingerprint: "abc123hash",
  notes: "Fórmula base estándar",
  created_at: "2026-08-22T10:00:00Z",
  updated_at: "2026-08-22T10:00:00Z",
  lines: [
    {
      id: 101,
      component_product_id: 1,
      component_product_name: "Feldespato Potásico",
      component_product_ref: "INS-1",
      component_type: "BASE",
      percentage: "60.0000",
      sort_order: 1,
    },
    {
      id: 102,
      component_product_id: 2,
      component_product_name: "Cuarzo Malla 200",
      component_product_ref: "INS-2",
      component_type: "BASE",
      percentage: "40.0000",
      sort_order: 2,
    },
    {
      id: 103,
      component_product_id: 3,
      component_product_name: "Óxido de Cobalto",
      component_product_ref: "INS-3",
      component_type: "COLORANT",
      percentage: "5.0000",
      sort_order: 3,
    },
  ],
};

const RECIPE_1: RecipeOut = {
  id: 1,
  product_id: 100,
  product_name: "Esmalte Azul Cobalto",
  product_ref: "LAB70001",
  name: "Esmalte Azul Cobalto v1",
  active: true,
  current_version_id: 10,
  current_version: RECIPE_VERSION_1,
  created_at: "2026-08-22T10:00:00Z",
  updated_at: "2026-08-22T10:00:00Z",
};

const RECIPES_PAGE: RecipePage = {
  items: [RECIPE_1],
  total: 1,
  limit: 25,
  offset: 0,
};

const CALC_RESULT: RecipeCalculateOut = {
  version_id: 10,
  target_base_grams: "1000.0000",
  real_output_grams: "1050.0000",
  yield_factor: "1.0500",
  total_material_cost: "25.5000",
  cost_per_gram: "0.024286",
  lines: [
    {
      component_product_id: 1,
      component_product_name: "Feldespato Potásico",
      component_type: "BASE",
      percentage: "60.0000",
      grams: "600.0000",
      unit_cost_per_gram: "0.020000",
      line_cost: "12.0000",
    },
    {
      component_product_id: 2,
      component_product_name: "Cuarzo Malla 200",
      component_type: "BASE",
      percentage: "40.0000",
      grams: "400.0000",
      unit_cost_per_gram: "0.015000",
      line_cost: "6.0000",
    },
    {
      component_product_id: 3,
      component_product_name: "Óxido de Cobalto",
      component_type: "COLORANT",
      percentage: "5.0000",
      grams: "50.0000",
      unit_cost_per_gram: "0.150000",
      line_cost: "7.5000",
    },
  ],
};

function mockRecipesApi(overrides: {
  user?: SessionUser;
  onRequest?: (url: string, init: RequestInit) => Response | undefined;
} = {}) {
  return mockFetch((url, init) => {
    const custom = overrides.onRequest?.(url, init);
    if (custom) return custom;

    if (url.includes("/auth/csrf")) return csrfResponse();
    if (url.includes("/auth/me")) return sessionResponse(overrides.user ?? TEST_USER);
    if (url.includes("/recipes/calculate")) return jsonResponse(200, CALC_RESULT);
    if (url.includes("/recipes/1/versions")) return jsonResponse(201, RECIPE_VERSION_1);
    if (url.includes("/recipes/1")) return jsonResponse(200, RECIPE_1);
    if (url.includes("/recipes")) return jsonResponse(200, RECIPES_PAGE);
    if (url.includes("/recipe-versions/10/activate")) return jsonResponse(200, RECIPE_VERSION_1);
    if (url.includes("/recipe-versions/10")) return jsonResponse(200, RECIPE_VERSION_1);
    if (url.includes("/products")) return jsonResponse(200, PRODUCTS_PAGE);
    if (url.includes("/categories")) return jsonResponse(200, CATEGORIES);
    if (url.includes("/units")) return jsonResponse(200, UNITS);
    return errorResponse(404, "NOT_FOUND");
  });
}

describe("Modulo de recetas (Fase 003.5)", () => {
  it("lista las recetas activas con producto, versión y factor de rendimiento", async () => {
    mockRecipesApi();
    renderApp(["/recetas"]);

    expect(await screen.findByText("Esmalte Azul Cobalto v1")).toBeInTheDocument();
    expect(screen.getByText("LAB70001")).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText("×1.050")).toBeInTheDocument();
    expect(screen.getByText("Activa")).toBeInTheDocument();
  });

  it("abre el detalle de receta y muestra componentes, porcentajes y rendimiento", async () => {
    const user = userEvent.setup();
    mockRecipesApi();
    renderApp(["/recetas"]);

    const detailBtn = await screen.findByRole("button", { name: /ver detalle/i });
    await user.click(detailBtn);

    expect(await screen.findByText("Versión 1 — activa")).toBeInTheDocument();
    expect(screen.getByText("Feldespato Potásico")).toBeInTheDocument();
    expect(screen.getByText("60.00%")).toBeInTheDocument();
    expect(screen.getByText("Cuarzo Malla 200")).toBeInTheDocument();
    expect(screen.getByText("40.00%")).toBeInTheDocument();
    expect(screen.getByText("Óxido de Cobalto")).toBeInTheDocument();
    expect(screen.getByText("5.00%")).toBeInTheDocument();
  });

  it("abre el simulador de batch y muestra la salida real y costo", async () => {
    const user = userEvent.setup();
    mockRecipesApi();
    renderApp(["/recetas"]);

    const detailBtn = await screen.findByRole("button", { name: /ver detalle/i });
    await user.click(detailBtn);

    const calcBtn = await screen.findByRole("button", { name: /calculador/i });
    await user.click(calcBtn);

    expect(await screen.findByText("Simulador de batch")).toBeInTheDocument();
    expect(await screen.findByText("1050 g")).toBeInTheDocument();
    expect(screen.getByText("S/ 25.5000")).toBeInTheDocument();
  });
});
