import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createV2Quotation,
  fetchV2Quotation,
  fetchV2Quotations,
  updateV2Quotation,
} from "@/api/quoterV2";
import {
  claveDeGuardado,
  invalidarCotizacion,
  QUOTER_V2_KEY,
  RECORDAR_GUARDADO,
  V2_STALE_TIME,
} from "@/features/cotizadorV2/claves";
import type { V2QuotationCreateInput, V2QuotationUpdateInput } from "@/types/quoterV2";

// Se reexportan para no obligar a cada pantalla a saber que las claves
// viven en otro fichero desde 010G.
export { QUOTER_V2_KEY, V2_STALE_TIME } from "@/features/cotizadorV2/claves";



export const useV2Quotations = (
  filters: Record<string, unknown> = {},
  options: { enabled?: boolean } = {},
) =>
  useQuery({
    queryKey: [...QUOTER_V2_KEY, filters],
    queryFn: () => fetchV2Quotations(filters),
    enabled: options.enabled ?? true,
  });

export const useV2Quotation = (id: number | null) =>
  useQuery({
    queryKey: [...QUOTER_V2_KEY, id],
    queryFn: () => fetchV2Quotation(id as number),
    enabled: id !== null,
    staleTime: V2_STALE_TIME,
  });

/**
 * Cambiar la cabecera invalida TODO lo que cuelga de ella.
 *
 * La moneda y el tipo de producción mueven el horno y, con él, cada precio
 * unitario. Sin esta invalidación el resumen seguiría enseñando las cifras de
 * antes junto a una cabecera nueva.
 */
export const useUpdateV2Quotation = (id: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationKey: claveDeGuardado(id, "cabecera"),
    gcTime: RECORDAR_GUARDADO,
    mutationFn: (payload: V2QuotationUpdateInput) => updateV2Quotation(id, payload),
    onSuccess: () => {
      void invalidarCotizacion(client, id);
    },
  });
};

export const useCreateV2Quotation = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: V2QuotationCreateInput) => createV2Quotation(payload),
    onSuccess: (data) => {
      client.setQueryData([...QUOTER_V2_KEY, data.id], data);
      void client.invalidateQueries({ queryKey: QUOTER_V2_KEY });
    },
  });
};
