/**
 * Cliente HTTP de los procesos de la pieza y de los adicionales (010H).
 *
 * El frontend no decide qué procesos necesita una pieza ni cuántas horas salen
 * de un rendimiento: los pide. Aquí no hay una sola cuenta.
 */

import { apiClient } from "@/api/client";
import { toQuery } from "@/api/masters";
import type {
  V2Extra,
  V2ExtraCreateInput,
  V2ExtraUpdateInput,
  V2ProcessInput,
  V2ProcessPage,
  V2ProductTechniquesPage,
  V2QuotationExtraInput,
  V2QuotationExtraPage,
  V2QuotationExtraUpdateInput,
} from "@/types/quoterV2Processes";

const QUOTATIONS = "/quotations-v2";
export const V2_EXTRAS_BASE = "/quoter-v2/extras";

// ---------------------------------------------------------------- maestro
export const fetchV2ProductTechniques = (productId: number): Promise<V2ProductTechniquesPage> =>
  apiClient.get(`/quoter-v2/products/${productId}/techniques`);

export const setV2ProductTechniques = (
  productId: number,
  techniqueIds: number[],
): Promise<V2ProductTechniquesPage> =>
  apiClient.put(`/quoter-v2/products/${productId}/techniques`, { technique_ids: techniqueIds });

// --------------------------------------------------- procesos de una CTZ
export const fetchV2Processes = (quotationId: number): Promise<V2ProcessPage> =>
  apiClient.get(`${QUOTATIONS}/${quotationId}/processes`);

export const addV2Process = (quotationId: number, payload: V2ProcessInput) =>
  apiClient.post(`${QUOTATIONS}/${quotationId}/processes`, payload);

export const setV2ProcessQuantity = (
  quotationId: number,
  processId: number,
  quantity: string,
): Promise<V2ProcessPage> =>
  apiClient.put(`${QUOTATIONS}/${quotationId}/processes/${processId}/quantity`, { quantity });

export const assignV2Process = (
  quotationId: number,
  processId: number,
  workerId: number,
): Promise<V2ProcessPage> =>
  apiClient.post(`${QUOTATIONS}/${quotationId}/processes/${processId}/assign`, {
    worker_id: workerId,
  });

export const unassignV2Process = (
  quotationId: number,
  processId: number,
): Promise<V2ProcessPage> =>
  apiClient.delete(`${QUOTATIONS}/${quotationId}/processes/${processId}/assign`);

export const removeV2Process = (quotationId: number, processId: number): Promise<V2ProcessPage> =>
  apiClient.delete(`${QUOTATIONS}/${quotationId}/processes/${processId}`);

// ------------------------------------------------------------- adicionales
export const fetchV2Extras = (activeOnly = false): Promise<{ items: V2Extra[] }> =>
  apiClient.get(`${V2_EXTRAS_BASE}${toQuery(activeOnly ? { active_only: true } : {})}`);

export const createV2Extra = (payload: V2ExtraCreateInput): Promise<V2Extra> =>
  apiClient.post(V2_EXTRAS_BASE, payload);

export const updateV2Extra = (id: number, payload: V2ExtraUpdateInput): Promise<V2Extra> =>
  apiClient.put(`${V2_EXTRAS_BASE}/${id}`, payload);

export const fetchV2QuotationExtras = (quotationId: number): Promise<V2QuotationExtraPage> =>
  apiClient.get(`${QUOTATIONS}/${quotationId}/extras`);

export const addV2QuotationExtra = (
  quotationId: number,
  payload: V2QuotationExtraInput,
): Promise<V2QuotationExtraPage> => apiClient.post(`${QUOTATIONS}/${quotationId}/extras`, payload);

export const updateV2QuotationExtra = (
  quotationId: number,
  extraId: number,
  payload: V2QuotationExtraUpdateInput,
): Promise<V2QuotationExtraPage> =>
  apiClient.put(`${QUOTATIONS}/${quotationId}/extras/${extraId}`, payload);

export const deleteV2QuotationExtra = (
  quotationId: number,
  extraId: number,
): Promise<V2QuotationExtraPage> =>
  apiClient.delete(`${QUOTATIONS}/${quotationId}/extras/${extraId}`);
