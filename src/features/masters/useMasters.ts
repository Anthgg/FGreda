/**
 * Estado de los maestros sobre TanStack Query.
 *
 * La cache de la query es la unica copia del estado del servidor: no se
 * duplica en ningun almacen global y las mutaciones la invalidan.
 */

import { useMemo } from "react";
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

/**
 * Materiales que una muestra o una pieza pueden consumir: materia prima y
 * preparados.
 *
 * Filtra **en el servidor**, por tipo, y esa es la razon de existir del hook.
 * Antes se pedia una pagina de productos y se descartaba lo que no era
 * material ya en el navegador: con 269 productos activos y un tope de 200, el
 * corte se comia las referencias altas —arcillas y pastas entre ellas— y el
 * selector se quedaba sin el material del cuerpo sin decir nada. Un filtro que
 * llega despues del limite no filtra: recorta.
 *
 * Se piden los dos tipos por separado porque la API admite uno por consulta.
 * Cada uno ronda la cincuentena, asi que el tope de 200 deja margen de verdad
 * y no por casualidad.
 */
export function useConsumableProducts() {
  const raw = useProducts({ active: true, product_type: "RAW_MATERIAL", limit: 200 });
  const prepared = useProducts({ active: true, product_type: "PREPARED_MATERIAL", limit: 200 });

  const items = useMemo(() => {
    // Deduplicado por id: un producto tiene un solo tipo, asi que las dos
    // consultas no deberian devolver el mismo nunca. «No deberia» no es una
    // garantia, y un material repetido en el selector se elige dos veces.
    const porId = new Map(
      [...(raw.data?.items ?? []), ...(prepared.data?.items ?? [])].map((p) => [p.id, p]),
    );
    return [...porId.values()].sort((a, b) =>
      a.internal_reference.localeCompare(b.internal_reference),
    );
  }, [raw.data?.items, prepared.data?.items]);

  return {
    items,
    isPending: raw.isPending || prepared.isPending,
    isError: raw.isError || prepared.isError,
  };
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
    mutationFn: ({ id, payload }: { id: number; payload: ProductInput }) =>
      updateProduct(id, payload),
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
export function useStock(
  filters: { search?: string; location_id?: number; limit?: number },
  enabled = true,
) {
  return useQuery({ queryKey: [...STOCK_KEY, filters], queryFn: () => fetchStock(filters), enabled });
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
