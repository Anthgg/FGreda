import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createV2Quotation, fetchV2Quotation, fetchV2Quotations } from "@/api/quoterV2";
import type { V2QuotationCreateInput } from "@/types/quoterV2";

/**
 * Clave de caché propia.
 *
 * Distinta de la del Cotizador histórico a propósito: si compartieran clave,
 * crear una cotización V2 invalidaría el listado Legacy —y al revés—, y las
 * dos pantallas empezarían a refrescarse por cosas que no les han pasado.
 */
export const QUOTER_V2_KEY = ["quotations-v2"] as const;

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
  });

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
