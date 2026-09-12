/**
 * Cliente HTTP de la mano de obra del Cotizador V2.
 *
 * Tres rutas distintas porque son tres cosas distintas: los maestros del
 * taller, las tareas de una cotización y la ilustración, que es una sola por
 * cotización.
 *
 * No importa nada del Cotizador histórico. `quoterV2.test.ts` lo comprueba.
 */

import { apiClient } from "@/api/client";
import { toQuery } from "@/api/masters";
import type {
  V2Illustration,
  V2IllustrationInput,
  V2LaborInput,
  V2LaborLine,
  V2LaborPage,
  V2Technique,
  V2TechniqueCreateInput,
  V2TechniqueUpdateInput,
  V2Worker,
  V2WorkerCreateInput,
  V2WorkerUpdateInput,
} from "@/types/quoterV2Labor";

export const V2_WORKERS_BASE = "/quoter-v2/workers";
export const V2_TECHNIQUES_BASE = "/quoter-v2/techniques";
const QUOTATIONS = "/quotations-v2";

export const fetchV2Workers = (activeOnly = false): Promise<{ items: V2Worker[] }> =>
  apiClient.get(`${V2_WORKERS_BASE}${toQuery(activeOnly ? { active_only: true } : {})}`);

export const createV2Worker = (payload: V2WorkerCreateInput): Promise<V2Worker> =>
  apiClient.post(V2_WORKERS_BASE, payload);

export const updateV2Worker = (id: number, payload: V2WorkerUpdateInput): Promise<V2Worker> =>
  apiClient.put(`${V2_WORKERS_BASE}/${id}`, payload);

export const fetchV2Techniques = (activeOnly = false): Promise<{ items: V2Technique[] }> =>
  apiClient.get(`${V2_TECHNIQUES_BASE}${toQuery(activeOnly ? { active_only: true } : {})}`);

export const createV2Technique = (payload: V2TechniqueCreateInput): Promise<V2Technique> =>
  apiClient.post(V2_TECHNIQUES_BASE, payload);

export const updateV2Technique = (
  id: number,
  payload: V2TechniqueUpdateInput,
): Promise<V2Technique> => apiClient.put(`${V2_TECHNIQUES_BASE}/${id}`, payload);

export const fetchV2Labor = (quotationId: number): Promise<V2LaborPage> =>
  apiClient.get(`${QUOTATIONS}/${quotationId}/labor`);

export const addV2Labor = (quotationId: number, payload: V2LaborInput): Promise<V2LaborLine> =>
  apiClient.post(`${QUOTATIONS}/${quotationId}/labor`, payload);

export const updateV2Labor = (
  quotationId: number,
  laborId: number,
  payload: V2LaborInput,
): Promise<V2LaborLine> => apiClient.put(`${QUOTATIONS}/${quotationId}/labor/${laborId}`, payload);

export const deleteV2Labor = (quotationId: number, laborId: number): Promise<void> =>
  apiClient.delete(`${QUOTATIONS}/${quotationId}/labor/${laborId}`);

export const setV2Planning = (
  quotationId: number,
  effectiveWorkDays: number | null,
): Promise<V2LaborPage> =>
  apiClient.put(`${QUOTATIONS}/${quotationId}/planning`, {
    effective_work_days: effectiveWorkDays,
  });

export const fetchV2Illustration = (quotationId: number): Promise<V2Illustration> =>
  apiClient.get(`${QUOTATIONS}/${quotationId}/illustration`);

export const setV2Illustration = (
  quotationId: number,
  payload: V2IllustrationInput,
): Promise<V2Illustration> =>
  apiClient.put(`${QUOTATIONS}/${quotationId}/illustration`, payload);
