/**
 * Estado del motor de recetas sobre TanStack Query.
 *
 * La cache de la query es la unica copia del estado del servidor. Las
 * mutaciones invalidan las claves afectadas; nunca duplican el estado en
 * ningun almacen global.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  activateRecipeVersion,
  calculateRecipe,
  createRecipe,
  createRecipeVersion,
  fetchRecipe,
  fetchRecipes,
  fetchRecipeVersion,
  updateRecipe,
} from "@/api/recipes";
import type {
  RecipeCalculateIn,
  RecipeCreate,
  RecipeUpdate,
  RecipeVersionIn,
} from "@/types/recipes";

export const RECIPES_KEY = ["recipes"] as const;
export const recipeKey = (id: number) => [...RECIPES_KEY, id] as const;
export const recipeVersionKey = (id: number) => ["recipe-versions", id] as const;
export const recipeCalcKey = (versionId: number, grams: number) =>
  ["recipe-calc", versionId, grams] as const;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
export function useRecipes(filters: {
  search?: string;
  product_id?: number;
  active?: boolean;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: [...RECIPES_KEY, filters],
    queryFn: () => fetchRecipes(filters),
  });
}

export function useRecipe(id: number | null) {
  return useQuery({
    queryKey: recipeKey(id!),
    queryFn: () => fetchRecipe(id!),
    enabled: id !== null,
  });
}

export function useRecipeVersion(versionId: number | null) {
  return useQuery({
    queryKey: recipeVersionKey(versionId!),
    queryFn: () => fetchRecipeVersion(versionId!),
    enabled: versionId !== null,
  });
}

export function useRecipeCalc(payload: RecipeCalculateIn | null) {
  return useQuery({
    queryKey: payload
      ? recipeCalcKey(payload.version_id, payload.target_base_grams)
      : ["recipe-calc", null],
    queryFn: () => calculateRecipe(payload!),
    enabled: payload !== null && payload.target_base_grams > 0,
  });
}

// ---------------------------------------------------------------------------
// Mutaciones
// ---------------------------------------------------------------------------
export function useCreateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RecipeCreate) => createRecipe(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: RECIPES_KEY }),
  });
}

export function useUpdateRecipe(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RecipeUpdate) => updateRecipe(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RECIPES_KEY });
      qc.invalidateQueries({ queryKey: recipeKey(id) });
    },
  });
}

export function useCreateVersion(recipeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, activate }: { payload: RecipeVersionIn; activate?: boolean }) =>
      createRecipeVersion(recipeId, payload, activate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RECIPES_KEY });
      qc.invalidateQueries({ queryKey: recipeKey(recipeId) });
    },
  });
}

export function useActivateVersion(recipeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versionId: number) => activateRecipeVersion(versionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RECIPES_KEY });
      qc.invalidateQueries({ queryKey: recipeKey(recipeId) });
    },
  });
}
