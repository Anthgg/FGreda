import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createV2Quotation,
  fetchV2Quotation,
  fetchV2Quotations,
  updateV2Quotation,
} from "@/api/quoterV2";
import type { V2QuotationCreateInput, V2QuotationUpdateInput } from "@/types/quoterV2";

/**
 * Clave de caché propia.
 *
 * Distinta de la del Cotizador histórico a propósito: si compartieran clave,
 * crear una cotización V2 invalidaría el listado Legacy —y al revés—, y las
 * dos pantallas empezarían a refrescarse por cosas que no les han pasado.
 */
export const QUOTER_V2_KEY = ["quotations-v2"] as const;

/**
 * Cuanto vale una respuesta antes de volver a pedirla.
 *
 * Desde 010G una misma consulta tiene DOS observadores: el asistente la mira
 * para saber si el paso esta completo, y el panel del paso la mira para
 * pintarla. Sin esto, montar el segundo disparaba una peticion identica a la
 * que acababa de resolverse —dos viajes por paso, cinco por ficha—.
 *
 * No afecta a la frescura de lo que se ve: cada mutacion invalida su clave a
 * mano, e invalidar ignora este plazo. Solo tapa el refresco redundante de un
 * dato que se acaba de traer y que nadie ha cambiado entre medias.
 */
export const V2_STALE_TIME = 30_000;

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
    mutationFn: (payload: V2QuotationUpdateInput) => updateV2Quotation(id, payload),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: QUOTER_V2_KEY });
      void client.invalidateQueries({ queryKey: ["quoter-v2"] });
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
