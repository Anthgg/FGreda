import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  calculateQuotation,
  cancelQuotation,
  confirmQuotation,
  createAdditional,
  createOtherCost,
  createQuotation,
  createTechnique,
  duplicateQuotation,
  fetchAdditionals,
  fetchOtherCosts,
  fetchQuotation,
  fetchQuotationTotals,
  fetchQuotations,
  fetchTechniques,
  updateAdditional,
  updateOtherCost,
  updateQuotation,
  updateQuotationProductPrice,
  updateTechnique,
} from "@/api/quotations";
import type {
  AdditionalInput,
  OtherCostInput,
  QuotationCalculateIn,
  QuotationFilters,
  QuotationSummaryOut,
  TechniqueInput,
} from "@/types/quotations";

export const QUOTATIONS_KEY = ["quotations"] as const;
export const quotationKey = (id: number) => [...QUOTATIONS_KEY, id] as const;
export const COST_MASTERS_KEY = ["quotation-cost-masters"] as const;

export const useTechniques = (active?: boolean) =>
  useQuery({
    queryKey: [...COST_MASTERS_KEY, "techniques", active],
    queryFn: () => fetchTechniques(active),
  });
export const useAdditionals = (active?: boolean) =>
  useQuery({
    queryKey: [...COST_MASTERS_KEY, "additionals", active],
    queryFn: () => fetchAdditionals(active),
  });
export const useOtherCosts = (active?: boolean) =>
  useQuery({
    queryKey: [...COST_MASTERS_KEY, "other-costs", active],
    queryFn: () => fetchOtherCosts(active),
  });
export const useQuotations = (filters: QuotationFilters) =>
  useQuery({
    queryKey: [...QUOTATIONS_KEY, filters],
    queryFn: () => fetchQuotations(filters),
  });

/** Maximo que acepta `/quotations`: `limit: int = Query(50, ge=1, le=200)`. */
const MAX_PAGE_SIZE = 200;

/**
 * Todas las cotizaciones que cumplen un filtro, recorriendo las paginas.
 *
 * Existe para los IMPORTES. Un contador se resuelve leyendo `total` y ya, pero
 * una suma necesita las filas, y el endpoint entrega como mucho 200 por
 * pagina: pedir una sola pagina y sumarla devolveria un importe truncado en
 * cuanto un mes pase de 200 confirmadas, que es exactamente el defecto que
 * este proyecto ya tuvo con los contadores.
 *
 * No se suma en el backend porque la regla de QUE campo es el total de una
 * cotizacion (`total_with_tax` en Cotizador, `commercial_total` en Legacy, con
 * el caso del cero `0E-18`) vive hoy en el frontend y es materia comercial:
 * moverla seria redefinirla, no auditarla.
 */
export async function fetchAllQuotations(
  filters: QuotationFilters,
): Promise<QuotationSummaryOut[]> {
  const first = await fetchQuotations({ ...filters, limit: MAX_PAGE_SIZE, offset: 0 });
  const rows = [...first.items];
  while (rows.length < first.total) {
    const next = await fetchQuotations({
      ...filters,
      limit: MAX_PAGE_SIZE,
      offset: rows.length,
    });
    // Una pagina vacia con `total` mayor solo puede venir de filas borradas
    // entre peticiones o de un backend inconsistente. Cortar aqui evita un
    // bucle infinito que colgaria la pestana.
    if (next.items.length === 0) break;
    rows.push(...next.items);
  }
  return rows;
}

export const useAllQuotations = (filters: QuotationFilters) =>
  useQuery({
    queryKey: [...QUOTATIONS_KEY, "all", filters],
    queryFn: () => fetchAllQuotations(filters),
  });
/** Totales por moneda, calculados en el servidor. */
export const useQuotationTotals = (filters: QuotationFilters) =>
  useQuery({
    queryKey: [...QUOTATIONS_KEY, "totals", filters],
    queryFn: () => fetchQuotationTotals(filters),
  });

export const useQuotation = (id: number | null) =>
  useQuery({
    queryKey: quotationKey(id!),
    queryFn: () => fetchQuotation(id!),
    enabled: id !== null,
  });
export const useQuotationPreview = (payload: QuotationCalculateIn | null) =>
  useQuery({
    queryKey: ["quotation-preview", payload],
    queryFn: () => calculateQuotation(payload!),
    enabled: payload !== null,
    retry: false,
  });

function useInvalidateMasters() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: COST_MASTERS_KEY });
}
export const useSaveTechnique = () => {
  const invalidate = useInvalidateMasters();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number | undefined; payload: TechniqueInput }) =>
      id ? updateTechnique(id, payload) : createTechnique(payload),
    onSuccess: invalidate,
  });
};
export const useSaveAdditional = () => {
  const invalidate = useInvalidateMasters();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number | undefined; payload: AdditionalInput }) =>
      id ? updateAdditional(id, payload) : createAdditional(payload),
    onSuccess: invalidate,
  });
};
export const useSaveOtherCost = () => {
  const invalidate = useInvalidateMasters();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number | undefined; payload: OtherCostInput }) =>
      id ? updateOtherCost(id, payload) : createOtherCost(payload),
    onSuccess: invalidate,
  });
};

export const useCreateQuotation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createQuotation,
    onSuccess: () => qc.invalidateQueries({ queryKey: QUOTATIONS_KEY }),
  });
};
export const useUpdateQuotation = (id: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      payload: QuotationCalculateIn & {
        expected_source_fingerprint: string;
        accept_source_changes: boolean;
      },
    ) => updateQuotation(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUOTATIONS_KEY }),
  });
};
export const useConfirmQuotation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accept }: { id: number; accept?: boolean }) =>
      confirmQuotation(id, accept),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUOTATIONS_KEY }),
  });
};
export const useCancelQuotation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cancelQuotation,
    onSuccess: () => qc.invalidateQueries({ queryKey: QUOTATIONS_KEY }),
  });
};
export const useDuplicateQuotation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: duplicateQuotation,
    onSuccess: () => qc.invalidateQueries({ queryKey: QUOTATIONS_KEY }),
  });
};
export const useUpdateQuotationProductPrice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateQuotationProductPrice,
    onSuccess: () => qc.invalidateQueries({ queryKey: QUOTATIONS_KEY }),
  });
};
