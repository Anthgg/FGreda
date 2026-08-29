/**
 * Capa API del motor de recetas e importacion desde staging.
 *
 * Todo pasa por el cliente HTTP unico; ningun componente usa fetch directamente.
 */

import { apiClient } from "@/api/client";
import { toQuery } from "@/api/masters";
import type {
  GlazeEstimateIn,
  GlazeEstimateOut,
  RecipeCalculateIn,
  RecipeCalculateOut,
  RecipeCreate,
  RecipeImportCommitResult,
  RecipeImportPreviewOut,
  RecipeOut,
  RecipePage,
  RecipePreparationIn,
  RecipePreparationOut,
  RecipePreparationPage,
  RecipeRowResolutionIn,
  RecipeUpdate,
  RecipeVersionIn,
  RecipeVersionOut,
  UnitConversionOut,
} from "@/types/recipes";

const RECIPES = "/recipes";
const RECIPE_VERSIONS = "/recipe-versions";
const RECIPE_IMPORTS = "/recipe-imports";

// ---------------------------------------------------------------------------
// Recetas
// ---------------------------------------------------------------------------
export function fetchRecipes(filters: {
  search?: string;
  product_id?: number;
  active?: boolean;
  limit?: number;
  offset?: number;
}): Promise<RecipePage> {
  return apiClient.get<RecipePage>(RECIPES + toQuery(filters as Record<string, unknown>));
}

export function fetchRecipe(id: number): Promise<RecipeOut> {
  return apiClient.get<RecipeOut>(`${RECIPES}/${id}`);
}

export function createRecipe(payload: RecipeCreate): Promise<RecipeOut> {
  return apiClient.post<RecipeOut>(RECIPES, payload);
}

export function updateRecipe(id: number, payload: RecipeUpdate): Promise<RecipeOut> {
  return apiClient.put<RecipeOut>(`${RECIPES}/${id}`, payload);
}

// ---------------------------------------------------------------------------
// Versiones
// ---------------------------------------------------------------------------
export function fetchRecipeVersion(versionId: number): Promise<RecipeVersionOut> {
  return apiClient.get<RecipeVersionOut>(`${RECIPE_VERSIONS}/${versionId}`);
}

export function createRecipeVersion(
  recipeId: number,
  payload: RecipeVersionIn,
  activate = false,
): Promise<RecipeVersionOut> {
  return apiClient.post<RecipeVersionOut>(
    `${RECIPES}/${recipeId}/versions?activate=${activate}`,
    payload,
  );
}

export function activateRecipeVersion(versionId: number): Promise<RecipeVersionOut> {
  return apiClient.post<RecipeVersionOut>(`${RECIPE_VERSIONS}/${versionId}/activate`, {});
}

// ---------------------------------------------------------------------------
// Calculador
// ---------------------------------------------------------------------------
export function calculateRecipe(payload: RecipeCalculateIn): Promise<RecipeCalculateOut> {
  return apiClient.post<RecipeCalculateOut>(`${RECIPES}/calculate`, payload);
}

// ---------------------------------------------------------------------------
// Importador de Recetas (Staging)
// ---------------------------------------------------------------------------
export function fetchLatestRecipeBatch(): Promise<{ batch_id: number | null }> {
  return apiClient.get<{ batch_id: number | null }>(`${RECIPE_IMPORTS}/latest-batch`);
}

export function fetchRecipeImportPreview(batchId: number): Promise<RecipeImportPreviewOut> {
  return apiClient.get<RecipeImportPreviewOut>(`${RECIPE_IMPORTS}/${batchId}/preview`);
}

export function resolveRecipeImportRows(
  batchId: number,
  resolutions: RecipeRowResolutionIn[],
): Promise<RecipeImportPreviewOut> {
  return apiClient.post<RecipeImportPreviewOut>(
    `${RECIPE_IMPORTS}/${batchId}/resolve`,
    resolutions,
  );
}

export function commitRecipeImport(batchId: number): Promise<RecipeImportCommitResult> {
  return apiClient.post<RecipeImportCommitResult>(
    `${RECIPE_IMPORTS}/${batchId}/commit`,
    {},
    { timeoutMs: 120_000 },
  );
}

// ---------------------------------------------------------------------------
// Preparaciones (Fase 009D)
// ---------------------------------------------------------------------------
const PREPARATIONS = "/recipe-preparations";

export function fetchPreparations(filters: {
  recipe_id?: number;
  prepared_product_id?: number;
  limit?: number;
  offset?: number;
}): Promise<RecipePreparationPage> {
  return apiClient.get<RecipePreparationPage>(
    PREPARATIONS + toQuery(filters as Record<string, unknown>),
  );
}

export function fetchPreparation(id: number): Promise<RecipePreparationOut> {
  return apiClient.get<RecipePreparationOut>(`${PREPARATIONS}/${id}`);
}

/**
 * Registra una preparacion fisica: descuenta materia prima y da de alta el
 * preparado, todo o nada.
 *
 * `idempotency_key` no es decorativa. Sin ella, un doble clic o un reintento
 * del navegador descontaria dos veces la misma mezcla.
 */
export function createPreparation(payload: RecipePreparationIn): Promise<RecipePreparationOut> {
  return apiClient.post<RecipePreparationOut>(PREPARATIONS, payload);
}

/** Convierte g <-> ml con la concentracion de un lote concreto. */
export function convertPreparationUnits(payload: {
  preparation_id: number;
  value: string;
  from_unit: "g" | "ml";
}): Promise<UnitConversionOut> {
  return apiClient.post<UnitConversionOut>(`${PREPARATIONS}/convert`, payload);
}

/**
 * Cuanto esmalte estima una cotizacion y como se reparte.
 *
 * El porcentaje NO viaja aqui: lo pone la configuracion comercial. Estimar no
 * mueve inventario.
 */
export function estimateGlaze(payload: GlazeEstimateIn): Promise<GlazeEstimateOut> {
  return apiClient.post<GlazeEstimateOut>(`${PREPARATIONS}/glaze-estimate`, payload);
}
