import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addCommercialLine,
  cancelQuotationBuilder,
  deleteCommercialLine,
  confirmQuotationBuilder,
  createQuotationBuilder,
  duplicateQuotationBuilder,
  fetchQuotationBuilder,
  markQuotationBuilderPaid,
  previewQuotationBuilder,
  updateCommercialLine,
  updateQuotationBuilder,
} from "@/api/quotationBuilder";
import { QUOTATIONS_KEY } from "@/features/quotations/useQuotations";
import type { CommercialLineIn, QuotationBuilderDraftIn } from "@/types/quotationBuilder";

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

// ---------------------------------------------------------------------------
// Cargos comerciales (Fase 009K.1)
//
// Las tres devuelven la cotización entera ya recalculada por el backend, así
// que la pantalla no suma nada: muestra lo que vuelve.
// ---------------------------------------------------------------------------
export const useAddCommercialLine = (id: number) => {
  const invalidate = useInvalidateCotizador();
  return useMutation({
    mutationFn: (payload: CommercialLineIn) => addCommercialLine(id, payload),
    onSuccess: (data) => invalidate(data.id),
  });
};

export const useUpdateCommercialLine = (id: number) => {
  const invalidate = useInvalidateCotizador();
  return useMutation({
    mutationFn: ({ lineId, payload }: { lineId: number; payload: CommercialLineIn }) =>
      updateCommercialLine(id, lineId, payload),
    onSuccess: (data) => invalidate(data.id),
  });
};

export const useDeleteCommercialLine = (id: number) => {
  const invalidate = useInvalidateCotizador();
  return useMutation({
    mutationFn: (lineId: number) => deleteCommercialLine(id, lineId),
    onSuccess: (data) => invalidate(data.id),
  });
};

export const useMarkCotizadorPaid = () => {
  const invalidate = useInvalidateCotizador();
  return useMutation({ mutationFn: markQuotationBuilderPaid, onSuccess: (data) => invalidate(data.id) });
};

export const useDuplicateCotizador = () => {
  const invalidate = useInvalidateCotizador();
  return useMutation({ mutationFn: duplicateQuotationBuilder, onSuccess: (data) => invalidate(data.id) });
};
