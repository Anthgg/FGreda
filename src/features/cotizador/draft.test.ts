import { describe, expect, it } from "vitest";

import {
  cotizadorFromOutput,
  cotizadorToPayload,
  emptyCotizadorDraft,
  itemFromProduct,
} from "@/features/cotizador/draft";
import type { Product } from "@/types/masters";
import type { QuotationBuilderOut } from "@/types/quotationBuilder";

const product: Product = {
  id: 42,
  internal_reference: "LAB50042",
  name: "Plato palta",
  product_type: "FINISHED_PRODUCT",
  product_category_id: 1,
  product_category_path: "Piezas",
  pos_category_id: null,
  pos_category_name: null,
  base_uom_code: "unit",
  purchase_uom_code: null,
  cost: null,
  sale_price: null,
  sale_tax_rate: null,
  purchase_tax_rate: null,
  material: "Gres",
  grammage: "420",
  width: "20",
  height: null,
  length: "20",
  depth: null,
  sellable: true,
  purchasable: false,
  available_in_pos: true,
  active: true,
  notes: null,
};

describe("borrador del Cotizador", () => {
  it("sólo envía completaciones para dimensiones ausentes y conserva decimales como texto", () => {
    const item = itemFromProduct(product);
    const payload = cotizadorToPayload({
      ...emptyCotizadorDraft(),
      name: "Pedido QA",
      customerId: "7",
      kilnId: "3",
      items: [{
        ...item,
        quantity: "24",
        dimensions: { ...item.dimensions, height: "8.5", depth: "2.25" },
        materialsApplied: "11.58",
        materialGramsPerPiece: "450.125",
        lowKilnId: "3",
        highKilnId: "4",
        factorKilnId: "3",
        techniqueIds: ["9"],
        techniqueQuantities: { "9": "10" },
        additionalIds: ["11"],
        additionalQuantities: { "11": "0.5" },
        otherCostIds: ["13"],
        markupPercent: "125.5",
      }],
    });

    expect(payload.items[0]?.dimensions).toEqual({ height: "8.5", depth: "2.25" });
    expect(payload.items[0]).toMatchObject({
      product_id: 42,
      quantity: 24,
      materials_applied: "11.58",
      material_grams_per_piece: "450.125",
      low_kiln_id: 3,
      high_kiln_id: 4,
      factor_kiln_id: 3,
      markup_percent: "125.5",
      techniques: [{ technique_id: 9, quantity: 10, sort_order: 0 }],
      additionals: [{ additional_id: 11, additional_quantity: "0.5", sort_order: 0 }],
      other_costs: [{ other_cost_id: 13, sort_order: 0 }],
    });
  });

  it("reabre un DRAFT multiítem sin convertir importes a number", () => {
    const output = {
      id: 81,
      code: "CTZ-2026-000081",
      workflow: "COTIZADOR",
      status: "DRAFT",
      name: "Pedido QA",
      customer_id: 7,
      customer_name_snapshot: "Cliente QA",
      kiln_id: 3,
      kiln_snapshot: {},
      production_summary: {},
      items: [{
        id: 91,
        product_id: 42,
        product_internal_reference: "LAB50042",
        product_name: "Plato palta",
        product_type: "FINISHED_PRODUCT",
        product_uom: "unit",
        product_material: "Gres",
        product_grammage: "420",
        width: "20",
        height: "8.5",
        length: "20",
        depth: "2.25",
        editable_dimensions: [],
        quantity: 24,
        recipe_id: 5,
        recipe_version_id: 6,
        recipe_version_fingerprint_snapshot: "r".repeat(64),
        recipe_auto_selected: true,
        materials_applied_input: "11.58",
        material_grams_per_piece: "450.125",
        firing_id: 10,
        firing_line_id: 15,
        firing_code_snapshot: "HR-2026-000001",
        kiln_id: 3,
        low_kiln_id: 3,
        high_kiln_id: 4,
        factor_kiln_id: 3,
        production_snapshot: {},
        techniques: [{ technique_id: 9, quantity: 10 }],
        additionals: [{ additional_id: 11, additional_quantity: "0.5" }],
        other_costs: [],
        materials_calculated: "1",
        materials_applied: "1",
        firing_cost: "2",
        labor_cost: "3",
        calculated_days: 2,
        days_adjustment: 0,
        waiting_days: 1,
        total_days: 3,
        space_cost: "4",
        final_unit_cost: "10.123456789",
        final_total_cost: "242.962962936",
        markup_percent: "125.5",
        calculated_sale_unit_price: "22",
        suggested_commercial_unit_price: "22",
        commercial_sale_unit_price_input: "22",
        commercial_sale_unit_price: "22",
        effective_profit_unit: "11.876543211",
        effective_profit_total: "285.037037064",
        effective_markup_percent: "117.32",
        commercial_subtotal: "528",
        commercial_unit_price_with_tax: "25.96",
        commercial_total: "622.08",
        tax_percentage_snapshot: "18",
        tax_rate_source_snapshot: "COMMERCIAL_SETTINGS",
        tax_amount: "95.04",
        source_fingerprint: "i".repeat(64),
        warnings: [],
        complete: true,
        sort_order: 0,
      }],
      item_count: 1,
      commercial_subtotal: "528",
      tax_percentage_snapshot: "18",
      tax_rate_source_snapshot: "COMMERCIAL_SETTINGS",
      tax_amount: "95.04",
      total_with_tax: "623.04",
      currency_code_snapshot: "PEN",
      currency_symbol_snapshot: "S/",
      warnings: [],
      complete: true,
      next_step: "SUMMARY",
      source_fingerprint: "q".repeat(64),
      created_at: "2026-08-24T12:00:00Z",
      updated_at: "2026-08-24T12:00:00Z",
      confirmed_at: null,
      cancelled_at: null,
    } satisfies QuotationBuilderOut;

    const draft = cotizadorFromOutput(output);
    expect(draft.items[0]?.commercialSaleUnitPrice).toBe("22");
    expect(draft.items[0]?.materialsApplied).toBe("11.58");
    expect(draft.items[0]?.materialGramsPerPiece).toBe("450.125");
    expect(draft.items[0]?.techniqueQuantities).toEqual({ "9": "10" });
    expect(draft.items[0]?.additionalQuantities).toEqual({ "11": "0.5" });
    expect(draft.items[0]?.firingLineId).toBe("15");
    expect(draft.items[0]).toMatchObject({ lowKilnId: "3", highKilnId: "4", factorKilnId: "3" });
    expect(cotizadorToPayload(draft).items[0]?.commercial_sale_unit_price).toBe("22");
    expect(cotizadorToPayload(draft).items[0]?.materials_applied).toBe("11.58");
    expect(cotizadorToPayload(draft).items[0]?.firing_line_id).toBe(15);
  });
});
