/**
 * Fase 009D en el navegador: el plan de esmaltes va y vuelve entero.
 *
 * Lo que importa aquí es lo que el cliente **no** hace. El navegador manda
 * intención —qué esmalte, con qué reparto, en qué unidad— y nada más; los
 * gramos, los mililitros, la concentración y el costo llegan calculados. Estos
 * tests fallan si alguien vuelve a meter esa aritmética en el cliente o empieza
 * a mandar derivados como si fueran autoridad.
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GlazeEstimator } from "@/features/cotizador/GlazeEstimator";
import {
  cotizadorFromOutput,
  cotizadorToPayload,
  emptyCotizadorDraft,
  emptyCotizadorItem,
} from "@/features/cotizador/draft";
import {
  csrfResponse,
  errorResponse,
  jsonResponse,
  mockFetch,
  renderWithProviders,
  sessionResponse,
} from "@/test/utils";
import type {
  GlazePlanOut,
  QuotationBuilderItemOut,
  QuotationBuilderOut,
} from "@/types/quotationBuilder";
import type { RecipePreparationPage } from "@/types/recipes";

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
      total_dry_weight_g: "1000",
      water_amount_ml: "4200",
      final_yield_ml: "5000",
      solids_g_per_ml: "0.200000000000",
      batch_total_cost: "250",
      unit_cost_per_ml: "0.050000000000",
      status: "COMPLETED",
      prepared_at: "2026-08-29T10:00:00Z",
      lines: [],
    },
    {
      id: 8,
      code: "PREP-2026-000002",
      recipe_version_id: 11,
      prepared_product_id: 6,
      prepared_product_internal_reference: "PRE-2",
      prepared_product_name: "Esmalte tenmoku",
      location_id: 1,
      total_dry_weight_g: "1000",
      water_amount_ml: "9200",
      final_yield_ml: "10000",
      solids_g_per_ml: "0.100000000000",
      batch_total_cost: "250",
      unit_cost_per_ml: "0.025000000000",
      status: "COMPLETED",
      prepared_at: "2026-08-29T10:00:00Z",
      lines: [],
    },
  ],
  total: 2,
  limit: 50,
  offset: 0,
};

/** 500 g × 15 % × 100 piezas = 7500 g, repartidos 70/30. */
const PLAN: GlazePlanOut = {
  unit: "ml",
  default_applied: false,
  estimated_glaze_percent_snapshot: "15.000000",
  piece_weight_g_snapshot: "500.000000000000",
  grams_per_piece: "75.000000000000",
  total_estimated_solids_g: "7500.000000000000",
  total_estimated_cost: "318.750000",
  allocations: [
    {
      prepared_product_id: 5,
      prepared_product_internal_reference: "PRE-1",
      prepared_product_name: "Esmalte celadón",
      preparation_id: 7,
      preparation_code: "PREP-2026-000001",
      share: "70.000000",
      allocation_percent: "70.000000000000",
      grams: "5250.000000000000",
      millilitres: "26250.000000000000",
      solids_g_per_ml_snapshot: "0.200000000000",
      unit_cost_per_ml_snapshot: "0.050000000000",
      estimated_cost: "1312.500000",
    },
    {
      prepared_product_id: 6,
      prepared_product_internal_reference: "PRE-2",
      prepared_product_name: "Esmalte tenmoku",
      preparation_id: 8,
      preparation_code: "PREP-2026-000002",
      share: "30.000000",
      allocation_percent: "30.000000000000",
      grams: "2250.000000000000",
      millilitres: "22500.000000000000",
      solids_g_per_ml_snapshot: "0.100000000000",
      unit_cost_per_ml_snapshot: "0.025000000000",
      estimated_cost: "562.500000",
    },
  ],
};

function mockApi() {
  return mockFetch((url) => {
    if (url.includes("/auth/csrf")) return csrfResponse();
    if (url.includes("/auth/me")) return sessionResponse();
    if (url.includes("/recipe-preparations")) return jsonResponse(200, BATCHES);
    return errorResponse(404, "NOT_FOUND");
  });
}

function renderEstimator(overrides: Partial<Parameters<typeof GlazeEstimator>[0]> = {}) {
  const onChange = vi.fn();
  renderWithProviders(
    <GlazeEstimator
      glazes={[]}
      glazeUnit="g"
      plan={null}
      warnings={[]}
      disabled={false}
      onChange={onChange}
      {...overrides}
    />,
  );
  return onChange;
}

// ---------------------------------------------------------------------------
// El cliente no calcula
// ---------------------------------------------------------------------------
describe("Cotizador · plan de esmaltes", () => {
  it("muestra los valores derivados que envía el backend", () => {
    // BACKEND_DERIVED_VALUES_RENDER. Ninguno de estos números se calcula aquí.
    mockApi();
    renderEstimator({ plan: PLAN, glazeUnit: "ml" });

    expect(screen.getByText("15 %")).toBeInTheDocument();
    expect(screen.getByText("75 g")).toBeInTheDocument();
    expect(screen.getByText("7500 g")).toBeInTheDocument();

    // Los mismos gramos convierten distinto porque los lotes llevan distinta
    // agua: con densidad 1 ambos habrían dado su propio número de gramos.
    expect(screen.getByText("26250")).toBeInTheDocument();
    expect(screen.getByText("22500")).toBeInTheDocument();
    expect(screen.getByText("0.2")).toBeInTheDocument();
    expect(screen.getByText("0.1")).toBeInTheDocument();
  });

  it("muestra el porcentaje resuelto por el backend, no el share tecleado", () => {
    // NO_CLIENT_CALCULATION_AUTHORITY: `share` es peso relativo. El navegador
    // enseña `allocation_percent`, que es lo que el backend resolvió.
    mockApi();
    renderEstimator({ plan: PLAN, glazeUnit: "ml" });

    const tabla = screen.getByRole("table");
    expect(within(tabla).getByText("70 %")).toBeInTheDocument();
    expect(within(tabla).getByText("30 %")).toBeInTheDocument();
  });

  it("avisa en vez de inventar cuando faltan el gramaje o el lote", () => {
    mockApi();
    renderEstimator({ warnings: ["GLAZE_PIECE_WEIGHT_REQUIRED"] });

    expect(screen.getByRole("alert")).toHaveTextContent(/no tiene gramaje/i);
  });

  it("añadir un esmalte sólo comunica la intención", async () => {
    mockApi();
    const onChange = renderEstimator();

    const selector = await screen.findByRole("combobox", { name: /añadir esmalte/i });
    await userEvent.click(selector);
    await userEvent.click(await screen.findByRole("option", { name: /PREP-2026-000001/ }));

    // Ni gramos, ni mililitros, ni concentración, ni costo. Y la bandera,
    // para que el backend deje de proponer.
    expect(onChange).toHaveBeenCalledWith({
      glazes: [{ preparationId: "7", preparedProductId: "5", share: "1" }],
      glazeSelectionTouched: true,
    });
  });

  it("cambiar la unidad comunica sólo la unidad", async () => {
    mockApi();
    const onChange = renderEstimator();

    const selector = await screen.findByRole("combobox", { name: /expresar el plan en/i });
    await userEvent.click(selector);
    await userEvent.click(await screen.findByRole("option", { name: /Mililitros/ }));

    expect(onChange).toHaveBeenCalledWith({ glazeUnit: "ml" });
  });
});

// ---------------------------------------------------------------------------
// Ida y vuelta del borrador
// ---------------------------------------------------------------------------
describe("Cotizador · ida y vuelta del plan", () => {
  const itemOut = (plan: GlazePlanOut | null, unit: "g" | "ml") =>
    ({
      id: 1,
      product_id: 42,
      product_internal_reference: "LAB50042",
      product_name: "Plato",
      product_type: "FINISHED_PRODUCT",
      product_uom: "unit",
      product_material: null,
      product_grammage: "500",
      width: "20",
      height: "8",
      length: "20",
      depth: null,
      standard_width: "20",
      standard_height: "8",
      standard_length: "20",
      standard_depth: null,
      editable_dimensions: [],
      dimensions_overridden: false,
      quantity: 100,
      recipe_id: null,
      recipe_version_id: null,
      recipe_version_fingerprint_snapshot: null,
      recipe_auto_selected: false,
      material_grams_per_piece: null,
      firing_id: null,
      firing_line_id: null,
      firing_code_snapshot: null,
      kiln_id: 3,
      low_kiln_id: 3,
      high_kiln_id: 3,
      low_kiln_selected: true,
      high_kiln_selected: true,
      factor_kiln_id: null,
      production_snapshot: {},
      technical_cost: "0",
      production_factor: "3",
      factored_cost: "0",
      fixed_cost_allocation: "0",
      commercial_base_cost: "0",
      commercial_base_unit_cost: "0",
      currency_code_snapshot: "PEN",
      exchange_rate_snapshot: null,
      raw_net_unit_base: "0",
      raw_net_unit: "0",
      raw_tax_unit: "0",
      raw_gross_unit: "0",
      rounding_step: "0.50",
      rounding_adjustment_unit: "0",
      final_gross_unit: "0",
      final_net_unit: "0",
      final_tax_unit: "0",
      line_total_gross: "0",
      line_total_net: "0",
      line_total_tax: "0",
      glaze_plan: plan,
      glaze_unit: unit,
      glaze_selection_touched: plan !== null,
      techniques: [],
      additionals: [],
      other_costs: [],
      materials_calculated: "0",
      materials_applied: "0",
      firing_cost: "0",
      labor_cost: "0",
      calculated_days: 0,
      days_adjustment: 0,
      waiting_days: 0,
      total_days: 0,
      space_cost: "0",
      final_unit_cost: "0",
      final_total_cost: "0",
      markup_percent: "100",
      calculated_sale_unit_price: "0",
      suggested_commercial_unit_price: "0",
      commercial_sale_unit_price: "0",
      effective_profit_unit: "0",
      effective_profit_total: "0",
      effective_markup_percent: "0",
      commercial_subtotal: "0",
      commercial_unit_price_with_tax: "0",
      commercial_total: "0",
      tax_percentage_snapshot: "18",
      tax_rate_source_snapshot: "COMMERCIAL_SETTINGS",
      tax_amount: "0",
      source_fingerprint: "f".repeat(64),
      warnings: [],
      complete: true,
      sort_order: 0,
    }) as unknown as QuotationBuilderItemOut;

  /** Reabre por la vía pública: la misma que usa la página al cargar. */
  const reopen = (plan: GlazePlanOut | null, unit: "g" | "ml") =>
    cotizadorFromOutput({
      id: 1,
      code: "CTZ-2026-000001",
      workflow: "COTIZADOR",
      status: "DRAFT",
      name: "Pedido",
      customer_id: 7,
      customer_name_snapshot: "Cliente",
      kiln_id: 3,
      kiln_snapshot: {},
      production_summary: {},
      items: [itemOut(plan, unit)],
      item_count: 1,
      commercial_subtotal: "0",
      tax_percentage_snapshot: "18",
      tax_rate_source_snapshot: "COMMERCIAL_SETTINGS",
      tax_amount: "0",
      total_with_tax: "0",
      currency_code_snapshot: "PEN",
      currency_symbol_snapshot: "S/",
      exchange_rate_snapshot: null,
      exchange_rate_source_snapshot: null,
      warnings: [],
      complete: true,
      next_step: "SUMMARY",
      source_fingerprint: "f".repeat(64),
      created_at: "2026-08-29T10:00:00Z",
      updated_at: "2026-08-29T10:00:00Z",
      confirmed_at: null,
      cancelled_at: null,
    } as unknown as QuotationBuilderOut).items[0]!;

  it("reabrir restaura esmaltes, repartos y unidad", () => {
    // REOPEN_RESTORES_GLAZES + REOPEN_RESTORES_SHARES + REOPEN_RESTORES_UNIT
    const item = reopen(PLAN, "ml");

    expect(item.glazeUnit).toBe("ml");
    expect(item.glazes).toEqual([
      { preparationId: "7", preparedProductId: "5", share: "70.000000" },
      { preparationId: "8", preparedProductId: "6", share: "30.000000" },
    ]);
  });

  it("reabrir NO reinyecta los derivados como entrada", () => {
    // Los gramos guardados son el resultado de un cálculo, no una decisión.
    // Devolverlos como entrada congelaría un borrador que debe seguir la
    // configuración vigente.
    const item = reopen(PLAN, "ml");
    const claves = Object.keys(item.glazes[0] ?? {});

    expect(claves.sort()).toEqual(["preparationId", "preparedProductId", "share"]);
  });

  it("una línea sin plan reabre sin esmaltes y en gramos", () => {
    const item = reopen(null, "g");

    expect(item.glazes).toEqual([]);
    expect(item.glazeUnit).toBe("g");
  });

  it("el payload guardado lleva sólo intención", () => {
    // SAVE_PAYLOAD_CONTAINS_INTENT_ONLY
    const draft = {
      ...emptyCotizadorDraft(),
      name: "Pedido",
      customerId: "7",
      items: [
        {
          ...emptyCotizadorItem(),
          productId: "42",
          quantity: "100",
          glazeUnit: "ml" as const,
          glazes: [
            { preparationId: "7", preparedProductId: "5", share: "70" },
            { preparationId: "8", preparedProductId: "6", share: "30" },
          ],
        },
      ],
    };

    const payload = cotizadorToPayload(draft);
    const enviado = payload.items[0]!;

    expect(enviado.glaze_unit).toBe("ml");
    expect(enviado.glazes).toEqual([
      { preparation_id: 7, prepared_product_id: 5, share: "70" },
      { preparation_id: 8, prepared_product_id: 6, share: "30" },
    ]);
    // Nada derivado viaja al servidor.
    const serializado = JSON.stringify(enviado);
    for (const prohibido of [
      "grams",
      "millilitres",
      "solids_g_per_ml",
      "unit_cost_per_ml",
      "estimated_glaze_percent",
      "allocation_percent",
    ]) {
      expect(serializado).not.toContain(prohibido);
    }
  });

  it("un esmalte sin ninguna referencia no se envía", () => {
    // NO_FALSE_SUCCESS: una fila a medias no debe viajar como si fuera válida.
    const draft = {
      ...emptyCotizadorDraft(),
      items: [
        {
          ...emptyCotizadorItem(),
          productId: "42",
          quantity: "100",
          glazes: [{ preparationId: "", preparedProductId: "", share: "1" }],
        },
      ],
    };

    expect(cotizadorToPayload(draft).items[0]!.glazes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Sugerencia por defecto
// ---------------------------------------------------------------------------
describe("Cotizador · sugerencia del esmalte más caro", () => {
  const SUGERIDO: GlazePlanOut = {
    ...PLAN,
    unit: "g",
    default_applied: true,
    allocations: [{ ...PLAN.allocations[0]!, share: "1", allocation_percent: "100.000000" }],
  };

  it("se distingue una sugerencia de una elección del usuario", () => {
    mockApi();
    renderEstimator({ plan: SUGERIDO });

    expect(screen.getByText(/sugerido por el sistema/i)).toBeInTheDocument();
    expect(screen.getByText(/su elección manda desde ese momento/i)).toBeInTheDocument();
  });

  it("un plan elegido por el usuario no se anuncia como sugerencia", () => {
    mockApi();
    renderEstimator({ plan: PLAN });

    expect(screen.queryByText(/sugerido por el sistema/i)).not.toBeInTheDocument();
  });

  it("quitar el sugerido marca la selección como propia del usuario", async () => {
    // Sin la bandera, el backend volvería a proponerlo en el siguiente
    // recálculo y la línea no podría quedarse nunca sin esmalte.
    mockApi();
    const onChange = renderEstimator({ plan: SUGERIDO });

    await userEvent.click(screen.getByRole("button", { name: /quitar/i }));

    expect(onChange).toHaveBeenCalledWith({ glazes: [], glazeSelectionTouched: true });
  });

  it("añadir otro esmalte conserva el sugerido y marca la elección", async () => {
    mockApi();
    const onChange = renderEstimator({ plan: SUGERIDO });

    const selector = await screen.findByRole("combobox", { name: /añadir esmalte/i });
    await userEvent.click(selector);
    await userEvent.click(await screen.findByRole("option", { name: /PREP-2026-000002/ }));

    expect(onChange).toHaveBeenCalledWith({
      glazes: [
        { preparationId: "7", preparedProductId: "5", share: "1" },
        { preparationId: "8", preparedProductId: "6", share: "1" },
      ],
      glazeSelectionTouched: true,
    });
  });

  it("el payload lleva la bandera para que el backend deje de proponer", () => {
    const draft = {
      ...emptyCotizadorDraft(),
      items: [
        {
          ...emptyCotizadorItem(),
          productId: "42",
          quantity: "100",
          glazes: [],
          glazeSelectionTouched: true,
        },
      ],
    };

    const enviado = cotizadorToPayload(draft).items[0]!;
    expect(enviado.glaze_selection_touched).toBe(true);
    expect(enviado.glazes).toEqual([]);
  });
});
