/**
 * Procesos de la pieza y adicionales, en React (corrección 010H).
 *
 * Cada escritura invalida la cotización entera: asignar a alguien a un proceso
 * crea una tarea, y una tarea mueve el costo directo de su línea, el reparto de
 * los generales y el precio. Refrescar solo la lista de procesos dejaría el
 * resumen diciendo el número de antes.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addV2Process,
  addV2QuotationExtra,
  assignV2Process,
  createV2Extra,
  deleteV2QuotationExtra,
  fetchV2Extras,
  fetchV2Processes,
  fetchV2ProductTechniques,
  fetchV2QuotationExtras,
  removeV2Process,
  setV2ProcessQuantity,
  setV2ProductTechniques,
  unassignV2Process,
  updateV2Extra,
  updateV2QuotationExtra,
} from "@/api/quoterV2Processes";
import type {
  V2ExtraCreateInput,
  V2ExtraUpdateInput,
  V2ProcessInput,
  V2QuotationExtraInput,
  V2QuotationExtraUpdateInput,
} from "@/types/quoterV2Processes";
import {
  alcanceDeGuardado,
  claveDeGuardado,
  invalidarCotizacion,
  RECORDAR_GUARDADO,
  V2_EXTRAS_KEY,
  V2_PRODUCT_TECHNIQUES_KEY,
  V2_PROCESSES_KEY,
  V2_QUOTATION_EXTRAS_KEY,
  V2_STALE_TIME,
} from "@/features/cotizadorV2/claves";

export {
  V2_EXTRAS_KEY,
  V2_PROCESSES_KEY,
  V2_QUOTATION_EXTRAS_KEY,
} from "@/features/cotizadorV2/claves";

// ---------------------------------------------------------------- lecturas
export const useV2Processes = (quotationId: number) =>
  useQuery({
    queryKey: [...V2_PROCESSES_KEY, quotationId],
    queryFn: () => fetchV2Processes(quotationId),
    staleTime: V2_STALE_TIME,
  });

export const useV2QuotationExtras = (quotationId: number) =>
  useQuery({
    queryKey: [...V2_QUOTATION_EXTRAS_KEY, quotationId],
    queryFn: () => fetchV2QuotationExtras(quotationId),
    staleTime: V2_STALE_TIME,
  });

export const useV2Extras = (activeOnly = false) =>
  useQuery({
    queryKey: [...V2_EXTRAS_KEY, activeOnly],
    queryFn: () => fetchV2Extras(activeOnly),
  });

export const useV2ProductTechniques = (productId: number | null) =>
  useQuery({
    queryKey: [...V2_PRODUCT_TECHNIQUES_KEY, productId],
    queryFn: () => fetchV2ProductTechniques(productId as number),
    enabled: productId !== null,
  });

// -------------------------------------------------------------- escrituras
export const useAddV2Process = (quotationId: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationKey: claveDeGuardado(quotationId, "proceso-anadir"),
    scope: alcanceDeGuardado(quotationId),
    gcTime: RECORDAR_GUARDADO,
    mutationFn: (payload: V2ProcessInput) => addV2Process(quotationId, payload),
    onSuccess: () => {
      void invalidarCotizacion(client, quotationId);
    },
  });
};

export const useSetV2ProcessQuantity = (quotationId: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationKey: claveDeGuardado(quotationId, "proceso-editar"),
    scope: alcanceDeGuardado(quotationId),
    gcTime: RECORDAR_GUARDADO,
    mutationFn: ({ processId, quantity }: { processId: number; quantity: string }) =>
      setV2ProcessQuantity(quotationId, processId, quantity),
    onSuccess: () => {
      void invalidarCotizacion(client, quotationId);
    },
  });
};

/** Asignar a alguien. Es lo que convierte un proceso en costo. */
export const useAssignV2Process = (quotationId: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationKey: claveDeGuardado(quotationId, "proceso-editar"),
    scope: alcanceDeGuardado(quotationId),
    gcTime: RECORDAR_GUARDADO,
    mutationFn: ({ processId, workerId }: { processId: number; workerId: number | null }) =>
      workerId === null
        ? unassignV2Process(quotationId, processId)
        : assignV2Process(quotationId, processId, workerId),
    onSuccess: () => {
      void invalidarCotizacion(client, quotationId);
    },
  });
};

export const useRemoveV2Process = (quotationId: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationKey: claveDeGuardado(quotationId, "proceso-borrar"),
    scope: alcanceDeGuardado(quotationId),
    gcTime: RECORDAR_GUARDADO,
    mutationFn: (processId: number) => removeV2Process(quotationId, processId),
    onSuccess: () => {
      void invalidarCotizacion(client, quotationId);
    },
  });
};

export const useAddV2QuotationExtra = (quotationId: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationKey: claveDeGuardado(quotationId, "adicional-anadir"),
    scope: alcanceDeGuardado(quotationId),
    gcTime: RECORDAR_GUARDADO,
    mutationFn: (payload: V2QuotationExtraInput) => addV2QuotationExtra(quotationId, payload),
    onSuccess: () => {
      void invalidarCotizacion(client, quotationId);
    },
  });
};

export const useUpdateV2QuotationExtra = (quotationId: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationKey: claveDeGuardado(quotationId, "adicional-editar"),
    scope: alcanceDeGuardado(quotationId),
    gcTime: RECORDAR_GUARDADO,
    mutationFn: ({
      extraId,
      payload,
    }: {
      extraId: number;
      payload: V2QuotationExtraUpdateInput;
    }) => updateV2QuotationExtra(quotationId, extraId, payload),
    onSuccess: () => {
      void invalidarCotizacion(client, quotationId);
    },
  });
};

export const useDeleteV2QuotationExtra = (quotationId: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationKey: claveDeGuardado(quotationId, "adicional-borrar"),
    scope: alcanceDeGuardado(quotationId),
    gcTime: RECORDAR_GUARDADO,
    mutationFn: (extraId: number) => deleteV2QuotationExtra(quotationId, extraId),
    onSuccess: () => {
      void invalidarCotizacion(client, quotationId);
    },
  });
};

// ---------------------------------------------------------------- maestros
export const useCreateV2Extra = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: V2ExtraCreateInput) => createV2Extra(payload),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: V2_EXTRAS_KEY });
    },
  });
};

export const useUpdateV2Extra = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: V2ExtraUpdateInput }) =>
      updateV2Extra(id, payload),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: V2_EXTRAS_KEY });
    },
  });
};

export const useSetV2ProductTechniques = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, techniqueIds }: { productId: number; techniqueIds: number[] }) =>
      setV2ProductTechniques(productId, techniqueIds),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: V2_PRODUCT_TECHNIQUES_KEY });
    },
  });
};
