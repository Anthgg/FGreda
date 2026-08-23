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
