import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addV2Labor,
  createV2Technique,
  createV2Worker,
  deleteV2Labor,
  fetchV2Illustration,
  fetchV2Labor,
  fetchV2Techniques,
  fetchV2Workers,
  setV2Illustration,
  setV2Planning,
  updateV2Labor,
  updateV2Technique,
  updateV2Worker,
} from "@/api/quoterV2Labor";
import type {
  V2IllustrationInput,
  V2LaborInput,
  V2TechniqueCreateInput,
  V2TechniqueUpdateInput,
  V2WorkerCreateInput,
  V2WorkerUpdateInput,
} from "@/types/quoterV2Labor";

export const V2_WORKERS_KEY = ["quoter-v2", "workers"] as const;
export const V2_TECHNIQUES_KEY = ["quoter-v2", "techniques"] as const;
export const V2_LABOR_KEY = ["quoter-v2", "labor"] as const;
export const V2_ILLUSTRATION_KEY = ["quoter-v2", "illustration"] as const;

export const useV2Workers = (activeOnly = false) =>
  useQuery({
    queryKey: [...V2_WORKERS_KEY, activeOnly],
    queryFn: () => fetchV2Workers(activeOnly),
  });

export const useV2Techniques = (activeOnly = false) =>
  useQuery({
    queryKey: [...V2_TECHNIQUES_KEY, activeOnly],
    queryFn: () => fetchV2Techniques(activeOnly),
  });

/**
 * Cambiar el maestro invalida las LISTAS, no las tareas ya guardadas.
 *
 * Las tareas llevan su copia: subir el jornal de alguien no cambia lo ya
 * cotizado, y refrescarlas sugeriría lo contrario.
 */
export const useCreateV2Worker = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: V2WorkerCreateInput) => createV2Worker(payload),
    onSuccess: () => client.invalidateQueries({ queryKey: V2_WORKERS_KEY }),
  });
};

export const useUpdateV2Worker = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; payload: V2WorkerUpdateInput }) =>
      updateV2Worker(vars.id, vars.payload),
    onSuccess: () => client.invalidateQueries({ queryKey: V2_WORKERS_KEY }),
  });
};

export const useCreateV2Technique = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: V2TechniqueCreateInput) => createV2Technique(payload),
    onSuccess: () => client.invalidateQueries({ queryKey: V2_TECHNIQUES_KEY }),
  });
};

export const useUpdateV2Technique = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; payload: V2TechniqueUpdateInput }) =>
      updateV2Technique(vars.id, vars.payload),
    onSuccess: () => client.invalidateQueries({ queryKey: V2_TECHNIQUES_KEY }),
  });
};

export const useV2Labor = (quotationId: number) =>
  useQuery({
    queryKey: [...V2_LABOR_KEY, quotationId],
    queryFn: () => fetchV2Labor(quotationId),
  });

export const useAddV2Labor = (quotationId: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: V2LaborInput) => addV2Labor(quotationId, payload),
    onSuccess: () => client.invalidateQueries({ queryKey: [...V2_LABOR_KEY, quotationId] }),
  });
};

export const useUpdateV2Labor = (quotationId: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (vars: { laborId: number; payload: V2LaborInput }) =>
      updateV2Labor(quotationId, vars.laborId, vars.payload),
    onSuccess: () => client.invalidateQueries({ queryKey: [...V2_LABOR_KEY, quotationId] }),
  });
};

export const useDeleteV2Labor = (quotationId: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (laborId: number) => deleteV2Labor(quotationId, laborId),
    onSuccess: () => client.invalidateQueries({ queryKey: [...V2_LABOR_KEY, quotationId] }),
  });
};

export const useSetV2Planning = (quotationId: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (effectiveWorkDays: number | null) => setV2Planning(quotationId, effectiveWorkDays),
    onSuccess: () => client.invalidateQueries({ queryKey: [...V2_LABOR_KEY, quotationId] }),
  });
};

export const useV2Illustration = (quotationId: number) =>
  useQuery({
    queryKey: [...V2_ILLUSTRATION_KEY, quotationId],
    queryFn: () => fetchV2Illustration(quotationId),
  });

export const useSetV2Illustration = (quotationId: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: V2IllustrationInput) => setV2Illustration(quotationId, payload),
    onSuccess: () => client.invalidateQueries({ queryKey: [...V2_ILLUSTRATION_KEY, quotationId] }),
  });
};
