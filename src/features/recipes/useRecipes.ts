/**
 * Estado del motor de recetas e importacion sobre TanStack Query.
 *
 * La cache de la query es la unica copia del estado del servidor.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  activateRecipeVersion,
  calculateRecipe,
  commitRecipeImport,
  createRecipe,
  createRecipeVersion,
  fetchLatestRecipeBatch,
  fetchRecipe,
  fetchRecipeImportPreview,
  fetchRecipes,
  fetchRecipeVersion,
  resolveRecipeImportRows,
  updateRecipe,
} from "@/api/recipes";
import type {
  RecipeCalculateIn,
  RecipeCreate,
  RecipeRowResolutionIn,
  RecipeUpdate,
  RecipeVersionIn,
} from "@/types/recipes";

export const RECIPES_KEY = ["recipes"] as const;
export const recipeKey = (id: number) => [...RECIPES_KEY, id] as const;
export const recipeVersionKey = (id: number) => ["recipe-versions", id] as const;
export const recipeCalcKey = (versionId: number | undefined, qty: string) =>
  ["recipe-calc", versionId, qty] as const;
export const RECIPE_IMPORT_PREVIEW_KEY = (batchId: number) =>
  ["recipe-import-preview", batchId] as const;

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
      ? recipeCalcKey(payload.recipe_version_id, payload.target_base_quantity)
      : ["recipe-calc", null],
    queryFn: () => calculateRecipe(payload!),
    enabled: payload !== null && payload.target_base_quantity.trim() !== "",
  });
}

export function useLatestRecipeBatch() {
  return useQuery({
    queryKey: ["recipe-import-latest-batch"],
    queryFn: fetchLatestRecipeBatch,
  });
}

export function useRecipeImportPreview(batchId: number | null) {
  return useQuery({
    queryKey: RECIPE_IMPORT_PREVIEW_KEY(batchId!),
    queryFn: () => fetchRecipeImportPreview(batchId!),
    enabled: batchId !== null,
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

export function useResolveRecipeImport(batchId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (resolutions: RecipeRowResolutionIn[]) =>
      resolveRecipeImportRows(batchId, resolutions),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RECIPE_IMPORT_PREVIEW_KEY(batchId) });
    },
  });
}

export function useCommitRecipeImport(batchId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => commitRecipeImport(batchId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RECIPES_KEY });
      qc.invalidateQueries({ queryKey: RECIPE_IMPORT_PREVIEW_KEY(batchId) });
    },
  });
}
