import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  cancelPrototypeQuotation,
  confirmPrototypeQuotation,
  createPrototypeQuotation,
  fetchPrototypeQuotation,
  fetchPrototypeQuotations,
  markPrototypeQuotationPaid,
  previewPrototypeQuotation,
  updatePrototypeQuotation,
} from "@/api/prototypeQuotations";
import { PRODUCTION_KEY } from "@/features/production/useProductionOrders";
import { PROTOTYPES_KEY } from "@/features/prototypes/usePrototypes";
import type {
  PrototypeQuotation,
  PrototypeQuotationDraftInput,
  PrototypeQuotationUpdateInput,
} from "@/types/prototypeQuotations";

export const PROTOTYPE_QUOTATIONS_KEY = ["prototype-quotations"] as const;

export const usePrototypeQuotations = (filters: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: [...PROTOTYPE_QUOTATIONS_KEY, filters],
    queryFn: () => fetchPrototypeQuotations(filters),
  });

export const usePrototypeQuotation = (id: number | null) =>
  useQuery({
    queryKey: [...PROTOTYPE_QUOTATIONS_KEY, id],
    queryFn: () => fetchPrototypeQuotation(id as number),
    enabled: id !== null,
  });

/**
 * El costeo que devuelve el backend para lo que hay en pantalla.
 *
 * Es una mutación y no una consulta a propósito: el cálculo depende de todo el
 * formulario, no de una clave estable, y cachearlo mostraría el precio de una
 * versión anterior de los datos.
 */
export const usePrototypeQuotationPreview = () =>
  useMutation({
    mutationFn: (payload: PrototypeQuotationDraftInput) => previewPrototypeQuotation(payload),
  });

export const useCreatePrototypeQuotation = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: PrototypeQuotationDraftInput) => createPrototypeQuotation(payload),
    onSuccess: (data) => {
      client.setQueryData([...PROTOTYPE_QUOTATIONS_KEY, data.id], data);
      void client.invalidateQueries({ queryKey: PROTOTYPE_QUOTATIONS_KEY });
    },
  });
};

export const useUpdatePrototypeQuotation = (id: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: PrototypeQuotationUpdateInput) => updatePrototypeQuotation(id, payload),
    onSuccess: (data) => {
      client.setQueryData([...PROTOTYPE_QUOTATIONS_KEY, id], data);
      void client.invalidateQueries({ queryKey: PROTOTYPE_QUOTATIONS_KEY });
    },
  });
};

export const useConfirmPrototypeQuotation = (id: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => confirmPrototypeQuotation(id),
    onSuccess: (data) => {
      client.setQueryData([...PROTOTYPE_QUOTATIONS_KEY, id], data);
      void client.invalidateQueries({ queryKey: PROTOTYPE_QUOTATIONS_KEY });
    },
  });
};

export const useCancelPrototypeQuotation = (id: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => cancelPrototypeQuotation(id),
    onSuccess: (data) => {
      client.setQueryData([...PROTOTYPE_QUOTATIONS_KEY, id], data);
      void client.invalidateQueries({ queryKey: PROTOTYPE_QUOTATIONS_KEY });
    },
  });
};

/**
 * Cobrar habilita la producción, así que también se invalida el tablero de
 * muestras: al pagar aparece una nueva, y dejarla fuera de la caché haría que
 * el taller no la viera hasta recargar.
 */
/**
 * Cobrar. Recibe el almacén porque quien cobra es quien lo elige.
 *
 * Fase 009K.4: el cobro materializa también la ORDEN de producción, así que
 * también se invalida su listado; si no, el taller seguiría viendo la lista de
 * antes del cobro.
 */
export const useMarkPrototypeQuotationPaid = (id: number) => {
  const client = useQueryClient();
  return useMutation<PrototypeQuotation, Error, number>({
    mutationFn: (stockLocationId: number) => markPrototypeQuotationPaid(id, stockLocationId),
    onSuccess: (data) => {
      client.setQueryData([...PROTOTYPE_QUOTATIONS_KEY, id], data);
      void client.invalidateQueries({ queryKey: PROTOTYPE_QUOTATIONS_KEY });
      void client.invalidateQueries({ queryKey: PROTOTYPES_KEY });
      void client.invalidateQueries({ queryKey: PRODUCTION_KEY });
    },
  });
};
