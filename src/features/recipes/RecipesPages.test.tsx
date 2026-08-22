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
import type {
  RecipeCalculateOut,
  RecipeImportPreviewOut,
  RecipeOut,
  RecipePage,
  RecipeVersionOut,
} from "@/types/recipes";

const RECIPE_VERSION_1: RecipeVersionOut = {
  id: 10,
  recipe_id: 1,
  version_number: 1,
  status: "ACTIVE",
  yield_factor: "1.050000",
  base_total: "100.000000",
  additional_total: "5.000000",
  fingerprint: "abc123hash",
  notes: "Fórmula base estándar",
  created_at: "2026-08-22T10:00:00Z",
  updated_at: "2026-08-22T10:00:00Z",
  lines: [
    {
      id: 101,
      component_product_id: 1,
      component_name: "Feldespato Potásico",
      component_internal_reference: "INS-1",
      component_type: "BASE",
      percentage: "60.000000",
      sort_order: 1,
      component_cost: "25.000000",
      component_uom: "kg",
    },
    {
      id: 102,
      component_product_id: 2,
      component_name: "Cuarzo Malla 200",
      component_internal_reference: "INS-2",
      component_type: "BASE",
      percentage: "40.000000",
      sort_order: 2,
      component_cost: "15.000000",
      component_uom: "kg",
    },
    {
      id: 103,
      component_product_id: 3,
      component_name: "Óxido de Cobalto",
      component_internal_reference: "INS-3",
      component_type: "COLORANT",
      percentage: "5.000000",
      sort_order: 3,
      component_cost: "150.000000",
      component_uom: "kg",
    },
  ],
};

const RECIPE_1: RecipeOut = {
  id: 1,
  product_id: 100,
  product_name: "Esmalte Azul Cobalto",
  product_internal_reference: "LAB70001",
  name: "Esmalte Azul Cobalto v1",
  active: true,
  current_version_id: 10,
  current_version: RECIPE_VERSION_1,
  versions_count: 1,
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
  target_base_quantity: "1000.000000",
  target_uom: "g",
  yield_factor: "1.050000",
  real_output_quantity: "1050.000000",
  base_cost: "21.000000",
  colorant_cost: "7.500000",
  additive_cost: "0.000000",
  total_material_cost: "28.500000",
  cost_per_real_unit: "0.027143",
  components: [
    {
      component_product_id: 1,
      component_internal_reference: "INS-1",
      component_name: "Feldespato Potásico",
      component_type: "BASE",
      percentage: "60.000000",
      required_quantity: "600.000000",
      uom: "g",
      unit_cost_in_grams: "0.025000",
      component_cost: "15.000000",
    },
    {
      component_product_id: 2,
      component_internal_reference: "INS-2",
      component_name: "Cuarzo Malla 200",
      component_type: "BASE",
      percentage: "40.000000",
      required_quantity: "400.000000",
      uom: "g",
      unit_cost_in_grams: "0.015000",
      component_cost: "6.000000",
    },
    {
      component_product_id: 3,
      component_internal_reference: "INS-3",
      component_name: "Óxido de Cobalto",
      component_type: "COLORANT",
      percentage: "5.000000",
      required_quantity: "50.000000",
      uom: "g",
      unit_cost_in_grams: "0.150000",
      component_cost: "7.500000",
    },
  ],
};

const STAGING_PREVIEW_INITIAL: RecipeImportPreviewOut = {
  batch_id: 1,
  recipes_detected: 1,
  lines_detected: 3,
  ready_count: 0,
  review_required_count: 1,
  error_count: 0,
  recipes: [
    {
      target_product_id: 100,
      target_internal_reference: "LAB70001",
      target_product_name: "Esmalte Azul Cobalto",
      recipe_name: "Esmalte Azul Cobalto",
      target_quantity: "1.000000",
      target_uom: "gr",
      base_total: "100.000000",
      additional_total: "5.000000",
      yield_factor: "1.050000",
      estimated_cost_per_gram: "0.000000",
      is_valid: false,
      has_structural_base_boundary: true,
      status: "REVIEW_REQUIRED",
      warnings: ["La receta contiene componentes adicionales pendientes de clasificación"],
      errors: [],
      lines: [
        {
          row_id: 10,
          source_row: 2,
          component_name_raw: "Feldespato Potasico",
          component_product_id: 1,
          component_reference: "INS-1",
          component_product_name: "Feldespato Potásico",
          component_type: "BASE",
          suggested_component_type: null,
          classification_role: "BASE",
          classification_source: "SOURCE_STRUCTURE",
          cumulative_percentage: "60.000000",
          source_percentage: "60.000000",
          final_percentage: "60.000000",
          percentage: "60.000000",
          resolution_source: "SOURCE",
          status: "READY",
          action: "CREATE",
          requires_review: false,
          quantity_raw: "0.600000",
          uom_raw: "gr",
          warnings: [],
          errors: [],
        },
        {
          row_id: 11,
          source_row: 3,
          component_name_raw: "Cuarzo",
          component_product_id: 2,
          component_reference: "INS-2",
          component_product_name: "Cuarzo Malla 200",
          component_type: "BASE",
          suggested_component_type: null,
          classification_role: "BASE",
          classification_source: "SOURCE_STRUCTURE",
          cumulative_percentage: "100.000000",
          source_percentage: "40.000000",
          final_percentage: "40.000000",
          percentage: "40.000000",
          resolution_source: "SOURCE",
          status: "READY",
          action: "CREATE",
          requires_review: false,
          quantity_raw: "0.400000",
          uom_raw: "gr",
          warnings: [],
          errors: [],
        },
        {
          row_id: 12,
          source_row: 4,
          component_name_raw: "Óxido de Cobalto",
          component_product_id: 3,
          component_reference: "INS-3",
          component_product_name: "Óxido de Cobalto",
          component_type: null,
          suggested_component_type: "COLORANT",
          classification_role: "ADDITIONAL",
          classification_source: "UNRESOLVED",
          cumulative_percentage: "105.000000",
          source_percentage: "5.000000",
          final_percentage: "5.000000",
          percentage: "5.000000",
          resolution_source: "UNRESOLVED",
          status: "REVIEW_REQUIRED",
          action: "CREATE",
          requires_review: true,
          quantity_raw: "0.050000",
          uom_raw: "gr",
          warnings: [],
          errors: [],
        },
      ],
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
    if (url.includes("/recipe-imports/latest-batch")) return jsonResponse(200, { batch_id: 1 });
    if (url.includes("/recipe-imports/1/preview")) return jsonResponse(200, STAGING_PREVIEW_INITIAL);
    if (url.includes("/recipe-imports/1/resolve")) return jsonResponse(200, {
      ...STAGING_PREVIEW_INITIAL,
      ready_count: 1,
      review_required_count: 0,
      recipes: [{ ...STAGING_PREVIEW_INITIAL.recipes[0], status: "READY", is_valid: true }],
    });
    if (url.includes("/recipe-imports/1/commit")) return jsonResponse(200, {
      batch_id: 1,
      recipes_detected: 1,
      created: 1,
      updated: 0,
      skipped: 0,
    });
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
    expect(screen.getByText("×1.05")).toBeInTheDocument();
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
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("Cuarzo Malla 200")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("Óxido de Cobalto")).toBeInTheDocument();
    expect(screen.getByText("5%")).toBeInTheDocument();
  });

  it("abre el simulador de batch y muestra la salida real y costo en formato string exacto", async () => {
    const user = userEvent.setup();
    mockRecipesApi();
    renderApp(["/recetas"]);

    const detailBtn = await screen.findByRole("button", { name: /ver detalle/i });
    await user.click(detailBtn);

    const calcBtn = await screen.findByRole("button", { name: /calculador/i });
    await user.click(calcBtn);

    expect(await screen.findByText("Simulador de batch")).toBeInTheDocument();
    expect(await screen.findByText("1050 g")).toBeInTheDocument();
    expect(screen.getByText("S/ 28.5")).toBeInTheDocument();
  });

  it("garantiza cero selects nativos en el formulario de creación de recetas", async () => {
    const user = userEvent.setup();
    mockRecipesApi();
    renderApp(["/recetas"]);

    const createBtn = await screen.findByRole("button", { name: /nueva receta/i });
    await user.click(createBtn);

    expect(await screen.findByRole("heading", { name: /nueva receta/i })).toBeInTheDocument();
    // No debe existir ningun elemento select nativo en el DOM
    expect(document.querySelectorAll("select").length).toBe(0);
  });

  it("muestra el modal de importador de recetas con clasificacion estructural y origen amigable", async () => {
    const user = userEvent.setup();
    mockRecipesApi();
    renderApp(["/recetas"]);

    const importBtn = await screen.findByRole("button", { name: /importar desde maestro/i });
    await user.click(importBtn);

    expect(await screen.findByText(/importación de recetas desde staging/i)).toBeInTheDocument();
    expect(screen.getByText("Revisión")).toBeInTheDocument();

    // Expandir grupo de receta para verificar origen estructural y boton aceptar sugerencia
    const groupBtn = screen.getByRole("button", { name: /esmalte azul cobalto/i });
    await user.click(groupBtn);

    expect(await screen.findAllByText("Estructura del maestro")).not.toHaveLength(0);
    expect(screen.getByText("Aceptar sugerencia")).toBeInTheDocument();

    // Boton confirmar importacion debe estar deshabilitado porque review_required > 0
    const commitBtn = screen.getByRole("button", { name: /confirmar importación/i });
    expect(commitBtn).toBeDisabled();

    // No debe existir ningun elemento select nativo en el modal
    expect(document.querySelectorAll("select").length).toBe(0);
  });
});
