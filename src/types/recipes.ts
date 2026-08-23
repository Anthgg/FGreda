/**
 * Tipos del motor de recetas – Fase 003.5.
 *
 * Refleja el contrato de BGreda. El frontend nunca recalcula porcentajes
 * ni costos en Float: opera con strings para preservar la precision Decimal.
 */

export type RecipeStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type RecipeComponentType = "BASE" | "COLORANT" | "ADDITIVE";

export interface RecipeLine {
  id: number;
  component_product_id: number;
  component_name: string;
  component_internal_reference: string;
  component_type: RecipeComponentType;
  /** Decimal como texto. */
  percentage: string;
  sort_order: number;
  component_cost: string | null;
  component_uom: string | null;
}

export interface RecipeVersionOut {
  id: number;
  recipe_id: number;
  version_number: number;
  status: RecipeStatus;
  /** Decimal como texto. */
  yield_factor: string;
  base_total: string;
  additional_total: string;
  fingerprint: string;
  notes: string | null;
  lines: RecipeLine[];
  created_at: string;
  updated_at: string;
}

export interface RecipeOut {
  id: number;
  product_id: number;
  product_name: string;
  product_internal_reference: string;
  name: string;
  active: boolean;
  current_version_id: number | null;
  current_version: RecipeVersionOut | null;
  versions?: RecipeVersionOut[];
  versions_count: number;
  created_at: string;
  updated_at: string;
}

export interface RecipePage {
  items: RecipeOut[];
  total: number;
  limit: number;
  offset: number;
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------
export interface RecipeLineIn {
  component_product_id: number;
  component_type: RecipeComponentType;
  /** Decimal como texto para preservar precision. */
  percentage: string;
  sort_order?: number;
}

export interface RecipeCreate {
  product_id: number;
  name: string;
  lines: RecipeLineIn[];
  notes?: string;
  active?: boolean;
  activate_immediately?: boolean;
}

export interface RecipeUpdate {
  name?: string;
  active?: boolean;
}

export interface RecipeVersionIn {
  lines: RecipeLineIn[];
  notes?: string;
}

// ---------------------------------------------------------------------------
// Calculador
// ---------------------------------------------------------------------------
export interface RecipeCalculateIn {
  recipe_version_id?: number;
  recipe_id?: number;
  target_base_quantity: string;
  target_uom?: string;
}

export interface CalculatedComponentLineOut {
  component_product_id: number;
  component_internal_reference: string;
  component_name: string;
  component_type: RecipeComponentType;
  percentage: string;
  required_quantity: string;
  uom: string;
  unit_cost_in_grams: string;
  component_cost: string;
}

export interface RecipeCalculateOut {
  target_base_quantity: string;
  target_uom: string;
  yield_factor: string;
  real_output_quantity: string;
  base_cost: string;
  colorant_cost: string;
  additive_cost: string;
  total_material_cost: string;
  cost_per_real_unit: string;
  components: CalculatedComponentLineOut[];
}

// ---------------------------------------------------------------------------
// Importacion desde Staging (Fase 003.5)
// ---------------------------------------------------------------------------
export interface RecipeStagingLineOut {
  row_id: number;
  source_row: number;
  component_name_raw: string;
  component_product_id: number | null;
  component_reference: string | null;
  component_product_name: string | null;
  component_type: RecipeComponentType | null;
  suggested_component_type: RecipeComponentType | null;
  classification_role: "BASE" | "ADDITIONAL" | "UNKNOWN";
  classification_source: "SOURCE_STRUCTURE" | "HUMAN_RESOLUTION" | "UNRESOLVED" | "SUGGESTED";
  cumulative_percentage: string;
  source_percentage: string;
  final_percentage: string;
  percentage: string;
  resolution_source: string;
  status: "READY" | "REVIEW_REQUIRED" | "RESOLVED" | "SKIPPED" | "ERROR";
  action: "CREATE" | "SKIP";
  requires_review: boolean;
  quantity_raw: string | null;
  uom_raw: string | null;
  warnings: string[];
  errors: string[];
}

export interface RecipeStagingGroupOut {
  target_product_id: number;
  target_internal_reference: string;
  target_product_name: string;
  recipe_name: string;
  target_quantity: string | null;
  target_uom: string | null;
  base_total: string;
  additional_total: string;
  yield_factor: string;
  estimated_cost_per_gram: string;
  is_valid: boolean;
  has_structural_base_boundary: boolean;
  status: "READY" | "REVIEW_REQUIRED" | "ERROR";
  warnings: string[];
  errors: string[];
  lines: RecipeStagingLineOut[];
}

export interface RecipeImportPreviewOut {
  batch_id: number;
  recipes_detected: number;
  lines_detected: number;
  ready_count: number;
  review_required_count: number;
  error_count: number;
  recipes: RecipeStagingGroupOut[];
}

export interface RecipeRowResolutionIn {
  row_id: number;
  component_type?: RecipeComponentType;
  percentage?: string;
  action: "RESOLVE" | "SKIP";
}

export interface RecipeImportCommitResult {
  batch_id: number;
  recipes_detected: number;
  created: number;
  updated: number;
  skipped: number;
}
