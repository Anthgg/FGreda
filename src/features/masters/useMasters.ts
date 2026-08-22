/**
 * Estado de los maestros sobre TanStack Query.
 *
 * La cache de la query es la unica copia del estado del servidor: no se
 * duplica en ningun almacen global y las mutaciones la invalidan.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  commitImport,
  createAdjustment,
  createPartner,
  createProduct,
  fetchImport,
  fetchImportPreview,
  fetchImports,
  fetchLocations,
  fetchMovements,
  fetchPartners,
  fetchPosCategories,
  fetchProductCategories,
  fetchProducts,
  fetchStock,
  fetchUnits,
  resolveImportRows,
  updatePartner,
  updateProduct,
  uploadMasterWorkbook,
} from "@/api/masters";
import type {
  ImportEntity,
  ImportRowStatus,
  PartnerFilters,
  PartnerInput,
  ProductFilters,
  ProductInput,
  RowResolution,
  StockAdjustmentInput,
} from "@/types/masters";

export const CATEGORIES_KEY = ["masters", "categories"] as const;
export const POS_CATEGORIES_KEY = ["masters", "pos-categories"] as const;
export const UNITS_KEY = ["masters", "units"] as const;
export const PRODUCTS_KEY = ["masters", "products"] as const;
export const PARTNERS_KEY = ["masters", "partners"] as const;
export const STOCK_KEY = ["inventory", "stock"] as const;
export const LOCATIONS_KEY = ["inventory", "locations"] as const;
export const MOVEMENTS_KEY = ["inventory", "movements"] as const;
export const IMPORTS_KEY = ["imports"] as const;

// ---------------------------------------------------------------------------
// Catalogos
// ---------------------------------------------------------------------------
export function useProductCategories() {
  return useQuery({ queryKey: CATEGORIES_KEY, queryFn: fetchProductCategories });
}

export function usePosCategories() {
  return useQuery({ queryKey: POS_CATEGORIES_KEY, queryFn: fetchPosCategories });
}

export function useUnits() {
  return useQuery({ queryKey: UNITS_KEY, queryFn: fetchUnits });
}

// ---------------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------------
export function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: [...PRODUCTS_KEY, filters],
    queryFn: () => fetchProducts(filters),
  });
}

export function useCreateProduct() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProductInput) => createProduct(payload),
    onSuccess: () => client.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}

export function useUpdateProduct() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ProductInput }) => {
      const { internal_reference: _ignored, ...rest } = payload;
      return updateProduct(id, rest);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}

// ---------------------------------------------------------------------------
// Terceros
// ---------------------------------------------------------------------------
export function usePartners(filters: PartnerFilters) {
  return useQuery({
    queryKey: [...PARTNERS_KEY, filters],
    queryFn: () => fetchPartners(filters),
  });
}

export function useCreatePartner() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: PartnerInput) => createPartner(payload),
    onSuccess: () => client.invalidateQueries({ queryKey: PARTNERS_KEY }),
  });
}

export function useUpdatePartner() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: PartnerInput }) =>
      updatePartner(id, payload),
    onSuccess: () => client.invalidateQueries({ queryKey: PARTNERS_KEY }),
  });
}

// ---------------------------------------------------------------------------
// Inventario
// ---------------------------------------------------------------------------
export function useStock(filters: { search?: string; location_id?: number; limit?: number }) {
  return useQuery({ queryKey: [...STOCK_KEY, filters], queryFn: () => fetchStock(filters) });
}

export function useLocations() {
  return useQuery({ queryKey: LOCATIONS_KEY, queryFn: fetchLocations });
}

export function useMovements(filters: { product_id?: number; limit?: number }, enabled = true) {
  return useQuery({
    queryKey: [...MOVEMENTS_KEY, filters],
    queryFn: () => fetchMovements(filters),
    enabled,
  });
}

export function useCreateAdjustment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: StockAdjustmentInput) => createAdjustment(payload),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: STOCK_KEY });
      await client.invalidateQueries({ queryKey: MOVEMENTS_KEY });
    },
  });
}

// ---------------------------------------------------------------------------
// Importador
// ---------------------------------------------------------------------------
export function useImports() {
  return useQuery({ queryKey: IMPORTS_KEY, queryFn: fetchImports });
}

export function useImportBatch(id: number | null) {
  return useQuery({
    queryKey: [...IMPORTS_KEY, id],
    queryFn: () => fetchImport(id as number),
    enabled: id !== null,
  });
}

export function useImportPreview(
  id: number | null,
  filters: { entity?: ImportEntity; row_status?: ImportRowStatus; limit?: number },
) {
  return useQuery({
    queryKey: [...IMPORTS_KEY, id, "preview", filters],
    queryFn: () => fetchImportPreview(id as number, filters),
    enabled: id !== null,
  });
}

export function useUploadWorkbook() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadMasterWorkbook(file),
    onSuccess: () => client.invalidateQueries({ queryKey: IMPORTS_KEY }),
  });
}

export function useResolveRows(batchId: number | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (resolutions: RowResolution[]) =>
      resolveImportRows(batchId as number, resolutions),
    onSuccess: () => client.invalidateQueries({ queryKey: IMPORTS_KEY }),
  });
}

export function useCommitImport(batchId: number | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => commitImport(batchId as number),
    onSuccess: async () => {
      // Tras el commit cambian los maestros enteros, no solo el lote.
      await client.invalidateQueries({ queryKey: IMPORTS_KEY });
      await client.invalidateQueries({ queryKey: PRODUCTS_KEY });
      await client.invalidateQueries({ queryKey: PARTNERS_KEY });
      await client.invalidateQueries({ queryKey: STOCK_KEY });
      await client.invalidateQueries({ queryKey: CATEGORIES_KEY });
    },
  });
}
