/**
 * Consultas y guardados de Solo Quema V2 (fase 010K).
 *
 * Una sola clave por cotización: cambiar cualquier cosa —una pieza, el horno,
 * el modo, el vidriado o el factor— mueve TODO lo demás, porque el precio se
 * recalcula entero en el backend. Invalidar solo lo que se tocó dejaría la
 * pantalla enseñando un total que ya no corresponde a sus piezas.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addFiringQuotationLine,
  cancelFiringQuotation,
  confirmFiringQuotation,
  createFiringQuotation,
  deleteFiringQuotationLine,
  duplicateFiringQuotation,
  fetchFiringQuotation,
  fetchFiringQuotationPreview,
  fetchFiringQuotations,
  updateFiringQuotation,
  updateFiringQuotationLine,
} from "@/api/firingQuotationV2";
import type {
  V2FiringQuotationCreateInput,
  V2FiringQuotationLineInput,
  V2FiringQuotationUpdateInput,
} from "@/types/firingQuotationV2";

export const SOLO_QUEMA_KEY = ["firing-quotations-v2"] as const;
export const SOLO_QUEMA_STALE_TIME = 30_000;

const detalle = (id: number) => [...SOLO_QUEMA_KEY, id] as const;
const resumen = (id: number) => [...SOLO_QUEMA_KEY, id, "preview"] as const;

function invalidar(client: ReturnType<typeof useQueryClient>, id: number): void {
  void client.invalidateQueries({ queryKey: SOLO_QUEMA_KEY });
  void client.invalidateQueries({ queryKey: detalle(id) });
  void client.invalidateQueries({ queryKey: resumen(id) });
}

export const useFiringQuotations = () =>
  useQuery({
    queryKey: [...SOLO_QUEMA_KEY, "list"],
    queryFn: () => fetchFiringQuotations({ limit: 100 }),
    staleTime: SOLO_QUEMA_STALE_TIME,
  });

export const useFiringQuotation = (id: number | null) =>
  useQuery({
    queryKey: detalle(id ?? 0),
    queryFn: () => fetchFiringQuotation(id as number),
    enabled: id !== null,
    staleTime: SOLO_QUEMA_STALE_TIME,
  });

export const useFiringQuotationPreview = (id: number | null) =>
  useQuery({
    queryKey: resumen(id ?? 0),
    queryFn: () => fetchFiringQuotationPreview(id as number),
    enabled: id !== null,
    staleTime: SOLO_QUEMA_STALE_TIME,
  });

export const useCreateFiringQuotation = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: V2FiringQuotationCreateInput) => createFiringQuotation(payload),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: SOLO_QUEMA_KEY });
    },
  });
};

export const useUpdateFiringQuotation = (id: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: V2FiringQuotationUpdateInput) => updateFiringQuotation(id, payload),
    onSuccess: () => invalidar(client, id),
  });
};

export const useAddFiringQuotationLine = (id: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: V2FiringQuotationLineInput) => addFiringQuotationLine(id, payload),
    onSuccess: () => invalidar(client, id),
  });
};

export const useUpdateFiringQuotationLine = (id: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ lineId, payload }: { lineId: number; payload: V2FiringQuotationLineInput }) =>
      updateFiringQuotationLine(id, lineId, payload),
    onSuccess: () => invalidar(client, id),
  });
};

export const useDeleteFiringQuotationLine = (id: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (lineId: number) => deleteFiringQuotationLine(id, lineId),
    onSuccess: () => invalidar(client, id),
  });
};

export const useConfirmFiringQuotation = (id: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (fingerprint: string) => confirmFiringQuotation(id, fingerprint),
    onSuccess: () => invalidar(client, id),
  });
};

export const useCancelFiringQuotation = (id: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (reason: string | null) => cancelFiringQuotation(id, reason),
    onSuccess: () => invalidar(client, id),
  });
};

export const useDuplicateFiringQuotation = (id: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => duplicateFiringQuotation(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: SOLO_QUEMA_KEY });
      invalidar(client, id);
    },
  });
};
