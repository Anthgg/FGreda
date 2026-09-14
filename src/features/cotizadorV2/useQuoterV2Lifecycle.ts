import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  cancelV2Quotation,
  confirmV2Quotation,
  duplicateV2Quotation,
  fetchV2ConfirmationPreview,
  fetchV2QuotationHistory,
  sendV2QuotationToProduction,
} from "@/api/quoterV2";
import {
  alcanceDeGuardado,
  invalidarCotizacion,
  QUOTER_V2_KEY,
} from "@/features/cotizadorV2/claves";

/**
 * Emitir, anular, duplicar y pasar a producción. Fase 010H.
 *
 * Ninguna de estas operaciones decide nada en el navegador: el backend es quien
 * sabe si la cotización está completa, si venció o si ya pasó a producción, y
 * las cuatro son idempotentes allí. Lo que sí hace la pantalla es no invitar al
 * doble clic —cada botón se apaga mientras su petición está en vuelo— y ordenar
 * la emisión DETRÁS de los guardados pendientes.
 *
 * ## Por qué emitir comparte el `scope` de los guardados
 *
 * TanStack ejecuta en serie las mutaciones de un mismo `scope`. Si alguien
 * cambia una cantidad y pulsa «Confirmar» antes de que el PUT termine, la
 * emisión espera a ese guardado en lugar de adelantarlo. Aun así el resumen se
 * revisó ANTES del cambio: la huella ya no coincide y el backend responde 409,
 * que el diálogo convierte en «revise los valores actualizados».
 */

export const V2_PREVIEW_KEY = ["quoter-v2", "confirmation-preview"] as const;
export const V2_HISTORY_KEY = ["quoter-v2", "history"] as const;

export const useV2ConfirmationPreview = (id: number, enabled: boolean) =>
  useQuery({
    queryKey: [...V2_PREVIEW_KEY, id],
    queryFn: () => fetchV2ConfirmationPreview(id),
    enabled,
    // El resumen es lo que se va a congelar: se pide fresco cada vez que se
    // abre el diálogo, nunca de una caché de hace un minuto.
    staleTime: 0,
    gcTime: 0,
  });

export const useV2QuotationHistory = (id: number, enabled: boolean) =>
  useQuery({
    queryKey: [...V2_HISTORY_KEY, id],
    queryFn: () => fetchV2QuotationHistory(id),
    enabled,
  });

/** Tras cualquier cambio de ciclo de vida, todo lo de la cotización y el listado. */
function refrescarTodo(client: ReturnType<typeof useQueryClient>, id: number) {
  void invalidarCotizacion(client, id);
  void client.invalidateQueries({ queryKey: QUOTER_V2_KEY });
  void client.invalidateQueries({ queryKey: [...V2_PREVIEW_KEY, id] });
  void client.invalidateQueries({ queryKey: [...V2_HISTORY_KEY, id] });
}

export const useConfirmV2Quotation = (id: number) => {
  const client = useQueryClient();
  return useMutation({
    scope: alcanceDeGuardado(id),
    mutationFn: (fingerprint: string) => confirmV2Quotation(id, fingerprint),
    onSuccess: (data) => {
      client.setQueryData([...QUOTER_V2_KEY, id], data);
      refrescarTodo(client, id);
    },
  });
};

export const useCancelV2Quotation = (id: number) => {
  const client = useQueryClient();
  return useMutation({
    scope: alcanceDeGuardado(id),
    mutationFn: (reason: string | null) => cancelV2Quotation(id, reason),
    onSuccess: (data) => {
      client.setQueryData([...QUOTER_V2_KEY, id], data);
      refrescarTodo(client, id);
    },
  });
};

export const useDuplicateV2Quotation = (id: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => duplicateV2Quotation(id),
    onSuccess: (data) => {
      client.setQueryData([...QUOTER_V2_KEY, data.quotation.id], data.quotation);
      refrescarTodo(client, id);
    },
  });
};

export const useSendV2ToProduction = (id: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => sendV2QuotationToProduction(id),
    onSuccess: () => refrescarTodo(client, id),
  });
};
