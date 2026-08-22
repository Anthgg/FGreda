/**
 * Capa API del motor de recetas.
 *
 * Todo pasa por el cliente HTTP unico; ningun componente usa fetch directamente.
 */

import { apiClient } from "@/api/client";
import { toQuery } from "@/api/masters";
import type {
  RecipeCalculateIn,
  RecipeCalculateOut,
  RecipeCreate,
  RecipePage,
  RecipeOut,
  RecipeUpdate,
  RecipeVersionIn,
  RecipeVersionOut,
} from "@/types/recipes";

const RECIPES = "/recipes";
const RECIPE_VERSIONS = "/recipe-versions";

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
