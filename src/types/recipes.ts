/**
 * Tipos del motor de recetas – Fase 003.5.
 *
 * Refleja el contrato de BGreda. El frontend nunca recalcula porcentajes
 * ni costos: los muestra tal como los devuelve el backend.
 */

export type RecipeStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type RecipeComponentType = "BASE" | "COLORANT" | "ADDITIVE";

export interface RecipeLine {
  id: number;
  component_product_id: number;
  component_product_name: string;
  component_product_ref: string;
  component_type: RecipeComponentType;
  /** Decimal como texto para no perder precision. */
  percentage: string;
  sort_order: number;
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
  product_ref: string;
  name: string;
  active: boolean;
  current_version_id: number | null;
  current_version: RecipeVersionOut | null;
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
  /** Numero entre 0 y 100. */
  percentage: number;
  sort_order?: number;
}

export interface RecipeCreate {
  product_id: number;
  name: string;
  lines: RecipeLineIn[];
  notes?: string;
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
  version_id: number;
  /** Gramos de base objetivo. */
  target_base_grams: number;
}

export interface RecipeLineCalc {
  component_product_id: number;
  component_product_name: string;
  component_type: RecipeComponentType;
  percentage: string;
  grams: string;
  unit_cost_per_gram: string | null;
  line_cost: string | null;
}

export interface RecipeCalculateOut {
  version_id: number;
  target_base_grams: string;
  real_output_grams: string;
  yield_factor: string;
  total_material_cost: string | null;
  cost_per_gram: string | null;
  lines: RecipeLineCalc[];
}
