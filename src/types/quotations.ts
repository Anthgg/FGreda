/** Contratos del Cotizador integral. Todos los decimales viajan como texto. */

export type QuotationStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";
export type TechniqueFormulaType = "ONE_FACTOR" | "TWO_FACTORS";
export type AdditionalFormulaType =
  | "PIECE_QUANTITY"
  | "SIMPLE_QUANTITY"
  | "PIECE_X_ADDITIONAL";
export type OtherCostCalculationType = "PER_DAY" | "FIXED" | "PER_PIECE";

export interface TechniqueOut {
  id: number;
  code: string;
  name: string;
  unit_price: string;
  formula_type: TechniqueFormulaType;
  factor_1: string;
  factor_2: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdditionalOut {
  id: number;
  code: string;
  name: string;
  unit_price: string;
  formula_type: AdditionalFormulaType;
  factor_1: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OtherCostOut {
  id: number;
  code: string;
  name: string;
  unit_price: string;
  calculation_type: OtherCostCalculationType;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MasterPage<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export type TechniqueInput = Omit<TechniqueOut, "id" | "created_at" | "updated_at">;
export type AdditionalInput = Omit<AdditionalOut, "id" | "created_at" | "updated_at">;
export type OtherCostInput = Omit<OtherCostOut, "id" | "created_at" | "updated_at">;

export interface TechniqueSelectionIn {
  technique_id: number;
  quantity: number;
  unit_price?: string;
  factor_1?: string;
  factor_2?: string;
  applied_cost?: string;
  applied_days?: number;
  sort_order?: number;
}

export interface AdditionalSelectionIn {
  additional_id: number;
  additional_quantity?: string;
  unit_price?: string;
  factor_1?: string;
  applied_cost?: string;
  sort_order?: number;
}

export interface OtherCostSelectionIn {
  other_cost_id: number;
  unit_price?: string;
  sort_order?: number;
}

export interface QuotationCalculateIn {
  product_id: number;
  quantity: number;
  recipe_id?: number;
  recipe_version_id?: number;
  firing_line_id?: number;
  materials_applied?: string;
  /** Gramos de receta por pieza. Por omisión, uno. */
  material_grams_per_piece?: string;
  techniques: TechniqueSelectionIn[];
  additionals: AdditionalSelectionIn[];
  days_adjustment: number;
  waiting_days: number;
  other_costs?: OtherCostSelectionIn[];
  commercial_factor?: string;
}

export interface TechniqueCalculationOut {
  id: number | null;
  technique_id: number;
  name_snapshot: string;
  unit_price_snapshot: string;
  formula_type_snapshot: TechniqueFormulaType;
  factor_1_snapshot: string;
  factor_2_snapshot: string | null;
  quantity: number;
  proposed_cost: string;
  applied_cost: string;
  proposed_days: number;
  applied_days: number;
  adjusted: boolean;
  sort_order: number;
}

export interface AdditionalCalculationOut {
  id: number | null;
  additional_id: number;
  name_snapshot: string;
  unit_price_snapshot: string;
  formula_type_snapshot: AdditionalFormulaType;
  factor_1_snapshot: string | null;
  additional_quantity: string | null;
  proposed_cost: string;
  applied_cost: string;
  adjusted: boolean;
  formula_explanation: string;
  sort_order: number;
}

export interface OtherCostCalculationOut {
  id: number | null;
  other_cost_id: number;
  name_snapshot: string;
  unit_price_snapshot: string;
  calculation_type_snapshot: OtherCostCalculationType;
  proposed_cost: string;
  applied_cost: string;
  adjusted: boolean;
  sort_order: number;
}

export interface QuotationCalculateOut {
  product_id: number;
  product_internal_reference: string;
  product_name: string;
  quantity: number;
  recipe_id: number | null;
  recipe_version_id: number | null;
  recipe_version_fingerprint_snapshot: string | null;
  firing_id: number | null;
  firing_line_id: number | null;
  firing_code_snapshot: string | null;
  firing_snapshot: Record<string, unknown>;
  materials_calculated: string;
  materials_applied: string;
  firing_cost: string;
  labor_cost: string;
  calculated_days: number;
  days_adjustment: number;
  waiting_days: number;
  total_days: number;
  space_cost: string;
  commercial_factor_default_snapshot: string;
  commercial_factor: string;
  current_sale_price_snapshot: string | null;
  base_commercial_cost: string;
  calculated_total: string;
  calculated_unit_price: string;
  /** Gramos de receta por pieza; el costo de materiales se calcula sobre ellos. */
  /** Componentes de la receta sin precio: suman cero y abaratan el material. */
  materials_without_cost: string[];
  material_grams_per_piece: string;
  material_total_grams: string;
  /** IGV en porcentaje. El total y el unitario de arriba son netos. */
  tax_percentage: string;
  tax_amount: string;
  total_with_tax: string;
  unit_price_with_tax: string;
  source_fingerprint: string;
  warnings: string[];
  /** La cotización se emite sin IGV y el impuesto se añade encima. */
  igv_rule_source: "FOUND";
  discount_rule_source: "NOT_FOUND";
  techniques: TechniqueCalculationOut[];
  additionals: AdditionalCalculationOut[];
  other_costs: OtherCostCalculationOut[];
}

export interface QuotationOut extends QuotationCalculateOut {
  id: number;
  code: string;
  status: QuotationStatus;
  created_by_id: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuotationSummaryOut {
  id: number;
  code: string;
  status: QuotationStatus;
  product_id: number;
  product_internal_reference: string;
  product_name: string;
  quantity: number;
  calculated_unit_price: string;
  calculated_total: string;
  total_with_tax: string;
  created_at: string;
}

export interface QuotationPage {
  items: QuotationSummaryOut[];
  total: number;
  limit: number;
  offset: number;
}

export interface QuotationFilters {
  search?: string;
  status?: QuotationStatus;
  product?: number;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export interface ProductPriceUpdateOut {
  quotation_id: number;
  product_id: number;
  old_price: string | null;
  new_price: string;
  updated_at: string;
}
