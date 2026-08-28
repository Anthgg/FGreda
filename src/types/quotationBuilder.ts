import type {
  AdditionalSelectionIn,
  OtherCostSelectionIn,
  QuotationStatus,
  TechniqueSelectionIn,
} from "@/types/quotations";

export type QuotationWorkflow = "LEGACY" | "COTIZADOR";
export type ProductDimension = "width" | "height" | "length" | "depth";

export interface ProductDimensionCompletionIn {
  width?: string;
  height?: string;
  length?: string;
  depth?: string;
}

export interface QuotationBuilderItemIn {
  id?: number;
  product_id: number;
  quantity?: number;
  dimensions: ProductDimensionCompletionIn;
  /**
   * Fase 009B: el usuario eligio "Personalizar medidas" para esta linea.
   * Cuando es true, `dimensions` viaja completa y el backend la usa como
   * medida efectiva sin tocar el maestro del producto.
   */
  dimensions_overridden?: boolean;
  recipe_id?: number;
  recipe_version_id?: number;
  firing_line_id?: number;
  materials_applied?: string;
  material_grams_per_piece?: string;
  low_kiln_id?: number;
  high_kiln_id?: number;
  factor_kiln_id?: number;
  techniques: TechniqueSelectionIn[];
  additionals: AdditionalSelectionIn[];
  days_adjustment: number;
  waiting_days: number;
  other_costs?: OtherCostSelectionIn[];
  markup_percent: string;
  commercial_sale_unit_price?: string;
  sort_order: number;
}

export interface QuotationBuilderDraftIn {
  name?: string;
  customer_id?: number;
  kiln_id?: number;
  items: QuotationBuilderItemIn[];
}

export interface QuotationBuilderItemOut {
  id: number | null;
  product_id: number;
  product_internal_reference: string;
  product_name: string;
  product_type: string;
  product_uom: string | null;
  product_material: string | null;
  product_grammage: string | null;
  width: string | null;
  height: string | null;
  length: string | null;
  depth: string | null;
  /** Medidas del maestro vigente, para contrastar y restaurar el estandar. */
  standard_width: string | null;
  standard_height: string | null;
  standard_length: string | null;
  standard_depth: string | null;
  editable_dimensions: ProductDimension[];
  /** Fase 009B: la linea usa medidas propias, distintas del maestro. */
  dimensions_overridden: boolean;
  quantity: number | null;
  recipe_id: number | null;
  recipe_version_id: number | null;
  recipe_version_fingerprint_snapshot: string | null;
  recipe_auto_selected: boolean;
  materials_applied_input?: string | null;
  material_grams_per_piece: string | null;
  firing_id: number | null;
  firing_line_id: number | null;
  firing_code_snapshot: string | null;
  kiln_id: number | null;
  low_kiln_id: number | null;
  high_kiln_id: number | null;
  factor_kiln_id: number | null;
  production_snapshot: Record<string, unknown>;
  techniques: Array<Record<string, unknown>>;
  additionals: Array<Record<string, unknown>>;
  other_costs: Array<Record<string, unknown>>;
  materials_calculated: string;
  materials_applied: string;
  firing_cost: string;
  labor_cost: string;
  calculated_days: number;
  days_adjustment: number;
  waiting_days: number;
  total_days: number;
  space_cost: string;
  final_unit_cost: string;
  final_total_cost: string;
  markup_percent: string;
  calculated_sale_unit_price: string;
  suggested_commercial_unit_price: string;
  commercial_sale_unit_price_input?: string | null;
  commercial_sale_unit_price: string;
  effective_profit_unit: string;
  effective_profit_total: string;
  effective_markup_percent: string;
  commercial_subtotal: string;
  commercial_unit_price_with_tax: string;
  commercial_total: string;
  tax_percentage_snapshot: string;
  tax_rate_source_snapshot: string;
  tax_amount: string;
  source_fingerprint: string;
  warnings: string[];
  complete: boolean;
  sort_order: number;
}

export interface QuotationBuilderOut {
  id: number | null;
  code: string | null;
  workflow: "COTIZADOR";
  status: QuotationStatus;
  name: string | null;
  customer_id: number | null;
  customer_name_snapshot: string | null;
  kiln_id: number | null;
  kiln_snapshot: Record<string, unknown>;
  production_summary: Record<string, unknown>;
  items: QuotationBuilderItemOut[];
  item_count: number;
  commercial_subtotal: string;
  tax_percentage_snapshot: string;
  tax_rate_source_snapshot: string;
  tax_amount: string;
  total_with_tax: string;
  currency_code_snapshot: string;
  currency_symbol_snapshot: string;
  warnings: string[];
  complete: boolean;
  next_step: "GENERAL_DATA" | "ITEMS" | "PRODUCTION" | "SUMMARY";
  source_fingerprint: string;
  created_at: string | null;
  updated_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
}
