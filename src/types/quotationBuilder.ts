import type {
  AdditionalSelectionIn,
  OtherCostSelectionIn,
  QuotationPaymentStatus,
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
  /**
   * Fase 009C: quema baja y alta son INDEPENDIENTES. Una pieza puede
   * necesitar solo baja, solo alta o ambas (al menos una).
   */
  low_kiln_selected?: boolean;
  high_kiln_selected?: boolean;
  factor_kiln_id?: number;
  /**
   * Fase 009D. SOLO intencion: que esmalte y con que peso relativo. El
   * navegador no manda gramos, mililitros, concentracion ni costo — todo eso
   * lo deriva el backend del gramaje del producto y del porcentaje
   * configurado. Si el cliente pudiera mandarlos, dos cotizaciones podrian
   * discrepar sin que nadie lo hubiera decidido.
   */
  glazes?: GlazeSelectionItemIn[];
  glaze_unit?: GlazeUnit;
  /**
   * El usuario ya toco la seleccion de esmaltes de esta linea.
   *
   * Distingue "todavia no ha elegido" de "eligio no llevar ninguno", que en
   * `glazes` se ven igual. Sin esto, quitar el esmalte sugerido lo haria
   * reaparecer en el siguiente recalculo.
   */
  glaze_selection_touched?: boolean;
  techniques: TechniqueSelectionIn[];
  additionals: AdditionalSelectionIn[];
  days_adjustment: number;
  waiting_days: number;
  other_costs?: OtherCostSelectionIn[];
  markup_percent: string;
  commercial_sale_unit_price?: string;
  sort_order: number;
}

export type GlazeUnit = "g" | "ml";

export interface GlazeSelectionItemIn {
  /** Lote concreto. Sin el hay gramos pero no mililitros. */
  preparation_id?: number;
  prepared_product_id?: number;
  /**
   * Peso relativo, NO porcentaje. 1 y 1 es mitad y mitad; 2 y 1 son dos
   * tercios y un tercio. El porcentaje lo resuelve el backend.
   */
  share: string;
}

export interface GlazeAllocationOut {
  prepared_product_id: number;
  prepared_product_internal_reference: string | null;
  prepared_product_name: string | null;
  preparation_id: number | null;
  preparation_code: string | null;
  /** Lo que tecleo el usuario, literal. */
  share: string;
  /** Lo que ese share representa una vez resuelto contra el resto. */
  allocation_percent: string;
  grams: string;
  /** `null` sin lote elegido: sin concentracion no hay conversion. */
  millilitres: string | null;
  solids_g_per_ml_snapshot: string | null;
  unit_cost_per_ml_snapshot: string | null;
  estimated_cost: string | null;
}

/**
 * Plan tecnico de esmaltes de una linea, tal como quedo guardado.
 *
 * En un borrador se recalcula con la configuracion vigente; en una cotizacion
 * confirmada es historia y no vuelve a tocarse.
 */
export interface GlazePlanOut {
  unit: GlazeUnit;
  /** El plan lo propuso el backend porque el usuario aun no habia elegido. */
  default_applied: boolean;
  estimated_glaze_percent_snapshot: string;
  piece_weight_g_snapshot: string;
  grams_per_piece: string;
  total_estimated_solids_g: string;
  allocations: GlazeAllocationOut[];
  total_estimated_cost: string | null;
}

export interface QuotationBuilderDraftIn {
  name?: string;
  customer_id?: number;
  kiln_id?: number;
  items: QuotationBuilderItemIn[];
  /** Fase 009F. Moneda de emision elegida para ESTA cotizacion. */
  currency_code?: "PEN" | "USD";
  /** Cuantos soles vale un dolar. Obligatoria con USD, prohibida con PEN. */
  exchange_rate?: string;
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
  /**
   * Fase 009C: la INTENCION de quemar, independiente de con que horno. Una
   * quema que hereda el horno de cabecera no trae *_kiln_id propio, asi que
   * deducirla del id la apagaria en silencio al reabrir el borrador.
   */
  low_kiln_selected: boolean;
  high_kiln_selected: boolean;
  factor_kiln_id: number | null;
  production_snapshot: Record<string, unknown>;
  /**
   * Fase 009D. El frontend consume ESTE campo tipado y nunca el JSON crudo de
   * production_snapshot.
   */
  glaze_plan: GlazePlanOut | null;
  glaze_unit: GlazeUnit;
  glaze_selection_touched: boolean;
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
  // ---- Fase 009E: el motor comercial, paso a paso -------------------
  /** Material + quema asignada + mano de obra. SIN costos fijos. */
  technical_cost: string;
  production_factor: string;
  factored_cost: string;
  /** Parte de los costos fijos de la cotizacion que le toca a esta linea. */
  fixed_cost_allocation: string;
  commercial_base_cost: string;
  commercial_base_unit_cost: string;
  /** Moneda y tasa efectivas: son las de la cotizacion, no de la linea. */
  currency_code_snapshot: string;
  exchange_rate_snapshot: string | null;
  /** Neto unitario ANTES de convertir, siempre en PEN. */
  raw_net_unit_base: string;
  raw_net_unit: string;
  raw_tax_unit: string;
  raw_gross_unit: string;
  rounding_step: string;
  /** Lo que el CEILING contractual anadio al bruto crudo. Siempre >= 0. */
  rounding_adjustment_unit: string;
  final_gross_unit: string;
  final_net_unit: string;
  final_tax_unit: string;
  line_total_gross: string;
  line_total_net: string;
  line_total_tax: string;
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
  // ---- Fase 009E: los tres totales, sin ambiguedad -------------------
  /** Suma de `line_total_net`. Es EL neto de la cotizacion. */
  quotation_net_total: string;
  quotation_tax_total: string;
  /** Suma de `line_total_gross`. Es EL total: el que se firma. */
  quotation_gross_total: string;
  production_factor: string;
  rounding_step: string;
  total_fixed_cost: string;
  currency_code_snapshot: string;
  currency_symbol_snapshot: string;
  /** Fase 009F. Cuantos soles vale un dolar. Nulo si se emite en PEN. */
  exchange_rate_snapshot: string | null;
  exchange_rate_source_snapshot: string | null;
  warnings: string[];
  complete: boolean;
  next_step: "GENERAL_DATA" | "ITEMS" | "PRODUCTION" | "SUMMARY";
  source_fingerprint: string;
  created_at: string | null;
  updated_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  /** `null` = el pago no lo registró el sistema. No es lo mismo que UNPAID. */
  payment_status: QuotationPaymentStatus | null;
  paid_at: string | null;
}
