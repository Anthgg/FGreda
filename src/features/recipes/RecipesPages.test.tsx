import { screen, waitFor } from "@testing-library/react";
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

const RECIPE_VERSION_2_DRAFT: RecipeVersionOut = {
  id: 11,
  recipe_id: 1,
  version_number: 2,
  status: "DRAFT",
  yield_factor: "1.060000",
  base_total: "100.000000",
  additional_total: "6.000000",
  fingerprint: "def456hash",
  notes: "Ajuste de colorante al 6%",
  created_at: "2026-08-22T11:00:00Z",
  updated_at: "2026-08-22T11:00:00Z",
  lines: [
    ...RECIPE_VERSION_1.lines,
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
  versions: [RECIPE_VERSION_2_DRAFT, RECIPE_VERSION_1],
  versions_count: 2,
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

describe("Recetas · estructura general", () => {
  it("muestra las cuatro vistas y «Nueva receta» como acción, no como pestaña", async () => {
    mockRecipesApi();
    renderApp(["/recetas"]);

    // «Preparaciones» es una pestaña aparte de «Simulador» a propósito: se
    // parecen en pantalla y hacen cosas opuestas — una calcula sin tocar nada,
    // la otra consume materia prima de verdad.
    const tabs = await screen.findAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual([
      "Listado",
      "Importador",
      "Simulador",
      "Preparaciones",
    ]);
    expect(screen.getByRole("button", { name: /nueva receta/i })).toBeInTheDocument();
  });

  it("no ofrece acciones decorativas sin función", async () => {
    mockRecipesApi();
    renderApp(["/recetas"]);

    await screen.findAllByRole("tab");
    expect(screen.queryByRole("button", { name: /documentaci[oó]n/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /exportar/i })).not.toBeInTheDocument();
  });

  it("conserva el AppShell oficial sin reconstruir la navegación", async () => {
    mockRecipesApi();
    renderApp(["/recetas"]);

    await screen.findAllByRole("tab");
    expect(screen.getByRole("link", { name: /inicio/i })).toBeInTheDocument();
  });
});

describe("Recetas · listado y detalle", () => {
  it("lista las recetas con referencia, versión, rendimiento y estado", async () => {
    mockRecipesApi();
    renderApp(["/recetas"]);

    expect(await screen.findByText("Esmalte Azul Cobalto v1")).toBeInTheDocument();
    expect(screen.getAllByText("LAB70001").length).toBeGreaterThan(0);
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getAllByText("Activa").length).toBeGreaterThan(0);
  });

  it("no muestra el tipo interno en cada fila del catálogo productivo", async () => {
    mockRecipesApi();
    renderApp(["/recetas"]);

    await screen.findByText("Esmalte Azul Cobalto v1");
    expect(screen.queryByText("PREPARED_MATERIAL")).not.toBeInTheDocument();
  });

  it("selecciona la primera receta y muestra su detalle sin abrir un modal", async () => {
    mockRecipesApi();
    renderApp(["/recetas"]);

    expect(
      await screen.findByRole("heading", { name: "Esmalte Azul Cobalto v1" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Estructura" })).toBeInTheDocument();
  });

  it("muestra las cuatro métricas de la receta", async () => {
    mockRecipesApi();
    renderApp(["/recetas"]);

    await screen.findByRole("heading", { name: "Esmalte Azul Cobalto v1" });
    for (const etiqueta of ["Adicionales", "Total fórmula", "Rendimiento"]) {
      expect(screen.getByText(etiqueta)).toBeInTheDocument();
    }
    expect(screen.getAllByText("Base").length).toBeGreaterThan(0);
  });

  it("muestra los componentes con tipo legible", async () => {
    mockRecipesApi();
    renderApp(["/recetas"]);

    await screen.findByRole("heading", { name: "Esmalte Azul Cobalto v1" });
    expect(screen.getByText("Feldespato Potásico")).toBeInTheDocument();
    expect(screen.getByText("Óxido de Cobalto")).toBeInTheDocument();
    expect(screen.getByText("Colorante")).toBeInTheDocument();
    expect(screen.queryByText("COLORANT")).not.toBeInTheDocument();
  });

  it("no muestra vocabulario del importador en el catálogo productivo", async () => {
    mockRecipesApi();
    renderApp(["/recetas"]);

    await screen.findByRole("heading", { name: "Esmalte Azul Cobalto v1" });
    expect(screen.queryByText("SOURCE_STRUCTURE")).not.toBeInTheDocument();
    expect(screen.queryByText("REVIEW_REQUIRED")).not.toBeInTheDocument();
  });

  it("busca en el servidor, no solo en la página cargada", async () => {
    const fetchSpy = mockRecipesApi();
    renderApp(["/recetas"]);
    await screen.findByText("Esmalte Azul Cobalto v1");

    await userEvent.setup().type(screen.getByLabelText(/buscar recetas/i), "cobalto");

    await waitFor(() => {
      expect(fetchSpy.mock.calls.some(([url]) => String(url).includes("search=cobalto"))).toBe(
        true,
      );
    });
  });

  it("ofrece el filtro de estado sin usar un select nativo", async () => {
    mockRecipesApi();
    renderApp(["/recetas"]);

    await screen.findByText("Esmalte Azul Cobalto v1");
    expect(screen.getByLabelText(/estado/i)).toBeInTheDocument();
    expect(document.querySelectorAll("select")).toHaveLength(0);
  });

  it("informa cuando el backend falla", async () => {
    mockRecipesApi({
      onRequest: (url) =>
        url.includes("/recipes") && !url.includes("calculate")
          ? errorResponse(500, "INTERNAL_ERROR")
          : undefined,
    });
    renderApp(["/recetas"]);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});

describe("Recetas · versiones y costos", () => {
  it("la pestaña Versiones muestra todas las versiones registradas y permite activar un borrador", async () => {
    const user = userEvent.setup();
    let activatedVersionId: number | null = null;

    mockRecipesApi({
      onRequest: (url, init) => {
        if (url.includes("/recipe-versions/11/activate") && init?.method === "POST") {
          activatedVersionId = 11;
          return jsonResponse(200, { ...RECIPE_VERSION_2_DRAFT, status: "ACTIVE" });
        }
        return undefined;
      },
    });
    renderApp(["/recetas"]);

    await screen.findByRole("heading", { name: "Esmalte Azul Cobalto v1" });
    await user.click(screen.getByRole("tab", { name: "Versiones" }));

    // Ambas versiones deben estar visibles en el listado
    expect(await screen.findByText("V2")).toBeInTheDocument();
    expect(screen.getByText("Borrador")).toBeInTheDocument();
    expect(screen.getAllByText("V1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Activa").length).toBeGreaterThanOrEqual(1);

    // V2 debe tener botón Activar, V1 no debe tenerlo porque ya está activa
    const activateBtn = screen.getByRole("button", { name: "Activar" });
    expect(activateBtn).toBeInTheDocument();

    await user.click(activateBtn);
    await waitFor(() => {
      expect(activatedVersionId).toBe(11);
    });
  });

  it("permite simular una versión específica desde el historial de versiones", async () => {
    const user = userEvent.setup();
    mockRecipesApi();
    renderApp(["/recetas"]);

    await screen.findByRole("heading", { name: "Esmalte Azul Cobalto v1" });
    await user.click(screen.getByRole("tab", { name: "Versiones" }));

    const simularBtns = await screen.findAllByRole("button", { name: "Simular" });
    expect(simularBtns.length).toBeGreaterThanOrEqual(2);

    // Simular V2
    await user.click(simularBtns[0]!);

    expect(await screen.findByText("Base objetivo")).toBeInTheDocument();
    expect(screen.getByText("Salida real")).toBeInTheDocument();
  });

  it("la pestaña Costos usa el cálculo del servidor", async () => {
    const fetchSpy = mockRecipesApi();
    renderApp(["/recetas"]);

    await screen.findByRole("heading", { name: "Esmalte Azul Cobalto v1" });
    await userEvent.setup().click(screen.getByRole("tab", { name: "Costos" }));

    await waitFor(() => {
      expect(fetchSpy.mock.calls.some(([url]) => String(url).includes("/recipes/calculate"))).toBe(
        true,
      );
    });
    expect(await screen.findByText(/costo por unidad real/i)).toBeInTheDocument();
  });
});

describe("Recetas · simulador", () => {
  it("calcula el batch en el servidor y muestra salida real", async () => {
    const fetchSpy = mockRecipesApi();
    renderApp(["/recetas"]);

    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Esmalte Azul Cobalto v1" });
    await user.click(screen.getByRole("button", { name: /simular/i }));

    expect(await screen.findByText("Base objetivo")).toBeInTheDocument();
    expect(screen.getByText("Salida real")).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchSpy.mock.calls.some(([url]) => String(url).includes("/recipes/calculate"))).toBe(
        true,
      );
    });
  });

  it("permite abrir el simulador desde su propia pestaña", async () => {
    mockRecipesApi();
    renderApp(["/recetas"]);

    await screen.findAllByRole("tab");
    await userEvent.setup().click(screen.getByRole("tab", { name: "Simulador" }));

    expect(await screen.findByLabelText(/base objetivo/i)).toBeInTheDocument();
  });
});

describe("Recetas · importador", () => {
  it("muestra las métricas reales del lote, no valores fijos", async () => {
    mockRecipesApi();
    renderApp(["/recetas"]);

    await screen.findAllByRole("tab");
    await userEvent.setup().click(screen.getByRole("tab", { name: "Importador" }));

    expect(await screen.findByText(/lote #1/i)).toBeInTheDocument();
    expect(screen.getByText("Recetas detectadas")).toBeInTheDocument();
    expect(screen.getByText("Requieren revisión")).toBeInTheDocument();
  });

  it("traduce los estados del staging a lenguaje del taller", async () => {
    mockRecipesApi();
    renderApp(["/recetas"]);

    await screen.findAllByRole("tab");
    await userEvent.setup().click(screen.getByRole("tab", { name: "Importador" }));

    await screen.findByText(/lote #1/i);
    expect(screen.queryByText("REVIEW_REQUIRED")).not.toBeInTheDocument();
  });
});

describe("Recetas · formularios y selector remoto", () => {
  it("cero selects nativos en toda la pantalla", async () => {
    mockRecipesApi();
    renderApp(["/recetas"]);

    await screen.findByRole("heading", { name: "Esmalte Azul Cobalto v1" });
    expect(document.querySelectorAll("select")).toHaveLength(0);
  });

  it("cero selects nativos al crear una receta", async () => {
    mockRecipesApi();
    renderApp(["/recetas"]);

    await userEvent.setup().click(await screen.findByRole("button", { name: /nueva receta/i }));

    expect(await screen.findByRole("heading", { name: /nueva receta/i })).toBeInTheDocument();
    expect(document.querySelectorAll("select")).toHaveLength(0);
  });

  it("el selector de componentes pide los productos al servidor sin exceder el límite", async () => {
    const fetchSpy = mockRecipesApi();
    renderApp(["/recetas"]);

    await userEvent.setup().click(await screen.findByRole("button", { name: /nueva receta/i }));
    await screen.findByRole("heading", { name: /nueva receta/i });

    await waitFor(() => {
      const llamada = fetchSpy.mock.calls.find(([url]) => String(url).includes("/products"));
      expect(llamada).toBeDefined();
      const limite = new URL(String(llamada![0]), "http://x").searchParams.get("limit");
      expect(Number(limite)).toBeLessThanOrEqual(200);
    });
  });
});

describe("Recetas · permisos", () => {
  it("OPERATOR no ve acciones de escritura", async () => {
    mockRecipesApi({ user: { ...TEST_USER, role: "OPERATOR", display_name: "Operario" } });
    renderApp(["/recetas"]);

    await screen.findByText("Esmalte Azul Cobalto v1");
    expect(screen.queryByRole("button", { name: /nueva receta/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /nueva versi[oó]n/i })).not.toBeInTheDocument();
  });

  it("OPERATOR sí puede consultar y simular", async () => {
    mockRecipesApi({ user: { ...TEST_USER, role: "OPERATOR", display_name: "Operario" } });
    renderApp(["/recetas"]);

    await screen.findByRole("heading", { name: "Esmalte Azul Cobalto v1" });
    expect(screen.getByRole("button", { name: /simular/i })).toBeInTheDocument();
  });
});
