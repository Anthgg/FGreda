import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  approvePrototype,
  createFinalQuotation,
  cancelPrototype,
  completePrototype,
  createPrototype,
  createPrototypeSuccessor,
  fetchPrototype,
  fetchPrototypes,
  rejectPrototype,
  setPrototypeMaterials,
  startPrototype,
  updatePrototype,
} from "@/api/prototypes";
import { MOVEMENTS_KEY, STOCK_KEY } from "@/features/masters/useMasters";
import type {
  PrototypeCreateInput,
  PrototypeFilters,
  PrototypeMaterialInput,
  PrototypeUpdateInput,
} from "@/types/prototypes";

export const PROTOTYPES_KEY = ["prototypes"] as const;
export const prototypeKey = (id: number) => [...PROTOTYPES_KEY, id] as const;

export const usePrototypes = (filters: PrototypeFilters = {}) =>
  useQuery({ queryKey: [...PROTOTYPES_KEY, filters], queryFn: () => fetchPrototypes(filters) });

export const usePrototype = (id: number | null) =>
  useQuery({
    queryKey: prototypeKey(id!),
    queryFn: () => fetchPrototype(id!),
    enabled: id !== null,
  });

function useInvalidatePrototype() {
  const client = useQueryClient();
  return (id?: number) => {
    void client.invalidateQueries({ queryKey: PROTOTYPES_KEY });
    if (id) void client.invalidateQueries({ queryKey: prototypeKey(id) });
  };
}

export const useCreatePrototype = () => {
  const invalidate = useInvalidatePrototype();
  return useMutation({ mutationFn: (payload: PrototypeCreateInput) => createPrototype(payload), onSuccess: () => invalidate() });
};

export const useUpdatePrototype = (id: number) => {
  const invalidate = useInvalidatePrototype();
  return useMutation({ mutationFn: (payload: PrototypeUpdateInput) => updatePrototype(id, payload), onSuccess: () => invalidate(id) });
};

export const useSetPrototypeMaterials = (id: number) => {
  const invalidate = useInvalidatePrototype();
  return useMutation({ mutationFn: (materials: PrototypeMaterialInput[]) => setPrototypeMaterials(id, materials), onSuccess: () => invalidate(id) });
};

export const useStartPrototype = (id: number) => {
  const invalidate = useInvalidatePrototype();
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => startPrototype(id),
    onSettled: () => {
      invalidate(id);
      void client.invalidateQueries({ queryKey: STOCK_KEY });
      void client.invalidateQueries({ queryKey: MOVEMENTS_KEY });
    },
  });
};

export const useCompletePrototype = (id: number) => {
  const invalidate = useInvalidatePrototype();
  return useMutation({ mutationFn: () => completePrototype(id), onSuccess: () => invalidate(id) });
};

/**
 * Crea —u obtiene— la cotización final de la muestra.
 *
 * El backend responde 201 si la crea y 200 si ya existía, y la pantalla hace
 * lo mismo en los dos casos: abrir la cotización devuelta. Por eso pulsar dos
 * veces no produce un error, produce la misma pantalla.
 */
export const useCreateFinalQuotation = (id: number) => {
  const invalidate = useInvalidatePrototype();
  return useMutation({
    mutationFn: () => createFinalQuotation(id),
    onSuccess: () => invalidate(id),
  });
};

export const useApprovePrototype = (id: number) => {
  const invalidate = useInvalidatePrototype();
  return useMutation({ mutationFn: (note?: string) => approvePrototype(id, note), onSuccess: () => invalidate(id) });
};

export const useRejectPrototype = (id: number) => {
  const invalidate = useInvalidatePrototype();
  return useMutation({ mutationFn: (note?: string) => rejectPrototype(id, note), onSuccess: () => invalidate(id) });
};

export const useCancelPrototype = (id: number) => {
  const invalidate = useInvalidatePrototype();
  return useMutation({ mutationFn: () => cancelPrototype(id), onSuccess: () => invalidate(id) });
};

export const useCreatePrototypeSuccessor = (id: number) => {
  const invalidate = useInvalidatePrototype();
  return useMutation({ mutationFn: (notes?: string) => createPrototypeSuccessor(id, notes), onSuccess: () => invalidate(id) });
};

