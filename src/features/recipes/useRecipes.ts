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
  createPreparation,
  createRecipe,
  createRecipeVersion,
  estimateGlaze,
  fetchLatestRecipeBatch,
  fetchPreparations,
  fetchRecipe,
  fetchRecipeImportPreview,
  fetchRecipes,
  fetchRecipeVersion,
  resolveRecipeImportRows,
  updateRecipe,
} from "@/api/recipes";
import type {
  GlazeEstimateIn,
  RecipeCalculateIn,
  RecipeCreate,
  RecipePreparationIn,
  RecipeRowResolutionIn,
  RecipeUpdate,
  RecipeVersionIn,
} from "@/types/recipes";
import { MOVEMENTS_KEY, STOCK_KEY } from "@/features/masters/useMasters";

export const RECIPES_KEY = ["recipes"] as const;
export const recipeKey = (id: number) => [...RECIPES_KEY, id] as const;
export const recipeVersionKey = (id: number) => ["recipe-versions", id] as const;
export const recipeCalcKey = (versionId: number | undefined, qty: string) =>
  ["recipe-calc", versionId, qty] as const;
export const RECIPE_IMPORT_PREVIEW_KEY = (batchId: number) =>
  ["recipe-import-preview", batchId] as const;
export const PREPARATIONS_KEY = ["recipe-preparations"] as const;
export const GLAZE_ESTIMATE_KEY = ["glaze-estimate"] as const;

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

// ---------------------------------------------------------------------------
// Preparaciones (Fase 009D)
// ---------------------------------------------------------------------------
export function usePreparations(
  filters: {
    recipe_id?: number;
    prepared_product_id?: number;
    limit?: number;
    offset?: number;
  },
  enabled = true,
) {
  return useQuery({
    queryKey: [...PREPARATIONS_KEY, filters],
    queryFn: () => fetchPreparations(filters),
    enabled,
  });
}

/**
 * Registra una preparacion fisica.
 *
 * Invalida tambien saldos y movimientos: preparar consume materia prima de
 * verdad, y dejar el inventario en pantalla con los numeros de antes es
 * mostrar existencias que ya no estan.
 */
export function useCreatePreparation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RecipePreparationIn) => createPreparation(payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: PREPARATIONS_KEY });
      await qc.invalidateQueries({ queryKey: STOCK_KEY });
      await qc.invalidateQueries({ queryKey: MOVEMENTS_KEY });
    },
  });
}

/**
 * Estima el esmalte de una cotizacion.
 *
 * Es una consulta, no una mutacion: no escribe nada. Se pide al servidor y no
 * se calcula aqui porque el porcentaje y la concentracion son autoridad del
 * backend; multiplicar en el navegador daria un numero que nadie ha decidido.
 */
export function useGlazeEstimate(payload: GlazeEstimateIn | null) {
  return useQuery({
    queryKey: [...GLAZE_ESTIMATE_KEY, payload],
    queryFn: () => estimateGlaze(payload!),
    enabled: payload !== null,
  });
}
