import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  cancelQuotationBuilder,
  confirmQuotationBuilder,
  createQuotationBuilder,
  duplicateQuotationBuilder,
  fetchQuotationBuilder,
  markQuotationBuilderPaid,
  previewQuotationBuilder,
  updateQuotationBuilder,
} from "@/api/quotationBuilder";
import { QUOTATIONS_KEY } from "@/features/quotations/useQuotations";
import type { QuotationBuilderDraftIn } from "@/types/quotationBuilder";

export const COTIZADOR_KEY = ["quotation-builder"] as const;
export const cotizadorKey = (id: number) => [...COTIZADOR_KEY, id] as const;

export const useCotizador = (id: number | null) =>
  useQuery({
    queryKey: cotizadorKey(id!),
    queryFn: () => fetchQuotationBuilder(id!),
    enabled: id !== null,
    retry: false,
  });

export const useCotizadorPreview = (payload: QuotationBuilderDraftIn | null) =>
  useQuery({
    queryKey: [...COTIZADOR_KEY, "preview", payload],
    queryFn: () => previewQuotationBuilder(payload!),
    enabled: payload !== null,
    retry: false,
  });

function useInvalidateCotizador() {
  const client = useQueryClient();
  return (id?: number | null) => {
    void client.invalidateQueries({ queryKey: COTIZADOR_KEY });
    void client.invalidateQueries({ queryKey: QUOTATIONS_KEY });
    if (id) void client.invalidateQueries({ queryKey: cotizadorKey(id) });
  };
}

export const useCreateCotizador = () => {
  const invalidate = useInvalidateCotizador();
  return useMutation({ mutationFn: createQuotationBuilder, onSuccess: (data) => invalidate(data.id) });
};

export const useUpdateCotizador = (id: number) => {
  const invalidate = useInvalidateCotizador();
  return useMutation({
    mutationFn: (payload: QuotationBuilderDraftIn & { expected_updated_at: string }) =>
      updateQuotationBuilder(id, payload),
    onSuccess: () => invalidate(id),
  });
};

export const useConfirmCotizador = () => {
  const invalidate = useInvalidateCotizador();
  return useMutation({
    mutationFn: ({ id, expectedUpdatedAt }: { id: number; expectedUpdatedAt: string }) =>
      confirmQuotationBuilder(id, expectedUpdatedAt),
    onSuccess: (data) => invalidate(data.id),
  });
};

export const useCancelCotizador = () => {
  const invalidate = useInvalidateCotizador();
  return useMutation({ mutationFn: cancelQuotationBuilder, onSuccess: (data) => invalidate(data.id) });
};

export const useMarkCotizadorPaid = () => {
  const invalidate = useInvalidateCotizador();
  return useMutation({ mutationFn: markQuotationBuilderPaid, onSuccess: (data) => invalidate(data.id) });
};

export const useDuplicateCotizador = () => {
  const invalidate = useInvalidateCotizador();
  return useMutation({ mutationFn: duplicateQuotationBuilder, onSuccess: (data) => invalidate(data.id) });
};
