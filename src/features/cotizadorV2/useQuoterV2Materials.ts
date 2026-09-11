import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addV2QuotationProduct,
  deleteV2QuotationProduct,
  fetchV2Materials,
  fetchV2QuotationProducts,
  updateV2QuotationProduct,
  upsertV2Material,
} from "@/api/quoterV2Materials";
import type {
  V2MaterialKind,
  V2MaterialUpsertInput,
  V2QuotationProductInput,
} from "@/types/quoterV2Materials";

export const V2_MATERIALS_KEY = ["quoter-v2", "materials"] as const;
export const V2_LINES_KEY = ["quoter-v2", "lines"] as const;

export const useV2Materials = (kind?: V2MaterialKind) =>
  useQuery({
    queryKey: [...V2_MATERIALS_KEY, kind ?? "all"],
    queryFn: () => fetchV2Materials(kind),
  });

/**
 * Valorizar un material invalida las LISTAS, no las líneas ya guardadas.
 *
 * Las líneas llevan su copia: subir el precio de la arcilla no cambia lo ya
 * cotizado, y refrescarlas sugeriría lo contrario.
 */
export const useUpsertV2Material = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (vars: { productId: number; payload: V2MaterialUpsertInput }) =>
      upsertV2Material(vars.productId, vars.payload),
    onSuccess: () => client.invalidateQueries({ queryKey: V2_MATERIALS_KEY }),
  });
};

export const useV2QuotationProducts = (quotationId: number | null) =>
  useQuery({
    queryKey: [...V2_LINES_KEY, quotationId],
    queryFn: () => fetchV2QuotationProducts(quotationId as number),
    enabled: quotationId !== null,
  });

export const useAddV2QuotationProduct = (quotationId: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: V2QuotationProductInput) =>
      addV2QuotationProduct(quotationId, payload),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [...V2_LINES_KEY, quotationId] }),
  });
};

export const useUpdateV2QuotationProduct = (quotationId: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (vars: { lineId: number; payload: V2QuotationProductInput }) =>
      updateV2QuotationProduct(quotationId, vars.lineId, vars.payload),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [...V2_LINES_KEY, quotationId] }),
  });
};

export const useDeleteV2QuotationProduct = (quotationId: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (lineId: number) => deleteV2QuotationProduct(quotationId, lineId),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [...V2_LINES_KEY, quotationId] }),
  });
};
