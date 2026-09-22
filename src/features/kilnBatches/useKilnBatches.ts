import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  assignKilnBatch,
  cancelKilnBatch,
  completeKilnBatch,
  createKilnBatch,
  fetchKilnBatch,
  fetchKilnBatches,
  fetchKilnBatchLayout,
  fetchProductionBatchSuggestions,
  fetchProductionFiringPlan,
  startKilnBatch,
  suggestKilnBatchLayout,
  updateKilnBatchLayout,
} from "@/api/kilnBatches";
import type {
  FiringType,
  KilnBatchAssignmentCreateIn,
  KilnBatchCreateIn,
  KilnBatchFilters,
  KilnBatchLayoutSuggestIn,
  KilnBatchLayoutUpdateIn,
} from "@/types/kilnBatches";

export const KILN_BATCHES_KEY = ["kiln-batches"] as const;
export const kilnBatchKey = (id: number) => [...KILN_BATCHES_KEY, id] as const;

export const useKilnBatches = (filters: KilnBatchFilters) =>
  useQuery({
    queryKey: [...KILN_BATCHES_KEY, filters],
    queryFn: () => fetchKilnBatches(filters),
  });

export const useKilnBatch = (id: number | null) =>
  useQuery({
    queryKey: kilnBatchKey(id!),
    queryFn: () => fetchKilnBatch(id!),
    enabled: id !== null,
  });

export const useProductionFiringPlan = (orderId: number | null) =>
  useQuery({
    queryKey: [...KILN_BATCHES_KEY, "production-plan", orderId],
    queryFn: () => fetchProductionFiringPlan(orderId!),
    enabled: orderId !== null,
  });

export const useProductionBatchSuggestions = (orderId: number | null, firingType: FiringType) =>
  useQuery({
    queryKey: [...KILN_BATCHES_KEY, "production-suggestions", orderId, firingType],
    queryFn: () => fetchProductionBatchSuggestions(orderId!, firingType),
    enabled: orderId !== null,
  });

function useInvalidateKilnBatches() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: KILN_BATCHES_KEY });
  };
}

export const useCreateKilnBatch = () => {
  const invalidate = useInvalidateKilnBatches();
  return useMutation({
    mutationFn: (payload: KilnBatchCreateIn) => createKilnBatch(payload),
    onSuccess: invalidate,
  });
};

export const useAssignKilnBatch = () => {
  const invalidate = useInvalidateKilnBatches();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: KilnBatchAssignmentCreateIn }) =>
      assignKilnBatch(id, payload),
    onSuccess: invalidate,
  });
};

export const useStartKilnBatch = () => {
  const invalidate = useInvalidateKilnBatches();
  return useMutation({
    mutationFn: (id: number) => startKilnBatch(id),
    onSuccess: invalidate,
  });
};

export const useCompleteKilnBatch = () => {
  const invalidate = useInvalidateKilnBatches();
  return useMutation({
    mutationFn: (id: number) => completeKilnBatch(id),
    onSuccess: invalidate,
  });
};

export const useCancelKilnBatch = () => {
  const invalidate = useInvalidateKilnBatches();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => cancelKilnBatch(id, reason),
    onSuccess: invalidate,
  });
};

export const kilnBatchLayoutKey = (batchId: number) =>
  [...kilnBatchKey(batchId), "layout"] as const;

export const useKilnBatchLayout = (batchId: number | null) =>
  useQuery({
    queryKey: kilnBatchLayoutKey(batchId!),
    queryFn: () => fetchKilnBatchLayout(batchId!),
    enabled: batchId !== null && !Number.isNaN(batchId),
    retry: (failureCount, error: unknown) => {
      // No reintentar si es 404 (el layout aún no existe) o 422 (falta dimensiones)
      if (typeof error === "object" && error !== null && "status" in error) {
        const status = (error as { status: number }).status;
        if (status === 404 || status === 422) return false;
      }
      return failureCount < 2;
    },
  });

export const useUpdateKilnBatchLayout = (batchId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: KilnBatchLayoutUpdateIn) => updateKilnBatchLayout(batchId, payload),
    onSuccess: (data) => {
      qc.setQueryData(kilnBatchLayoutKey(batchId), data);
      void qc.invalidateQueries({ queryKey: kilnBatchKey(batchId) });
      void qc.invalidateQueries({ queryKey: KILN_BATCHES_KEY });
    },
  });
};

export const useSuggestKilnBatchLayout = (batchId: number) => {
  return useMutation({
    mutationFn: (payload?: KilnBatchLayoutSuggestIn) => suggestKilnBatchLayout(batchId, payload),
  });
};
