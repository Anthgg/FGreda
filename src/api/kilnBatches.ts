import { apiClient } from "@/api/client";
import { toQuery } from "@/api/masters";
import type {
  FiringPlan,
  FiringType,
  KilnBatch,
  KilnBatchAssignmentCreateIn,
  KilnBatchCreateIn,
  KilnBatchFilters,
  KilnBatchLayout,
  KilnBatchLayoutSuggestIn,
  KilnBatchLayoutSuggestion,
  KilnBatchLayoutUpdateIn,
  KilnBatchPage,
  KilnBatchSuggestion,
} from "@/types/kilnBatches";

const KILN_BATCHES = "/kiln-batches";

export const fetchKilnBatches = (filters: KilnBatchFilters = {}): Promise<KilnBatchPage> =>
  apiClient.get<KilnBatchPage>(`${KILN_BATCHES}${toQuery({ ...filters })}`);

export const fetchKilnBatch = (id: number): Promise<KilnBatch> =>
  apiClient.get<KilnBatch>(`${KILN_BATCHES}/${id}`);

export const createKilnBatch = (payload: KilnBatchCreateIn): Promise<KilnBatch> =>
  apiClient.post<KilnBatch>(KILN_BATCHES, payload);

export const assignKilnBatch = (
  id: number,
  payload: KilnBatchAssignmentCreateIn,
): Promise<KilnBatch> => apiClient.post<KilnBatch>(`${KILN_BATCHES}/${id}/assignments`, payload);

export const startKilnBatch = (id: number): Promise<KilnBatch> =>
  apiClient.post<KilnBatch>(`${KILN_BATCHES}/${id}/start`, {});

export const completeKilnBatch = (id: number): Promise<KilnBatch> =>
  apiClient.post<KilnBatch>(`${KILN_BATCHES}/${id}/complete`, {});

export const cancelKilnBatch = (id: number, reason?: string): Promise<KilnBatch> =>
  apiClient.post<KilnBatch>(`${KILN_BATCHES}/${id}/cancel`, { reason: reason ?? null });

export const fetchProductionFiringPlan = (orderId: number): Promise<FiringPlan> =>
  apiClient.get<FiringPlan>(`${KILN_BATCHES}/production-orders/${orderId}/firing-plan`);

export const fetchProductionBatchSuggestions = (
  orderId: number,
  firingType: FiringType,
): Promise<KilnBatchSuggestion[]> =>
  apiClient.get<KilnBatchSuggestion[]>(
    `${KILN_BATCHES}/production-orders/${orderId}/batch-suggestions${toQuery({
      firing_type: firingType,
    })}`,
  );

export const fetchKilnBatchLayout = (batchId: number): Promise<KilnBatchLayout> =>
  apiClient.get<KilnBatchLayout>(`${KILN_BATCHES}/${batchId}/layout`);

export const updateKilnBatchLayout = (
  batchId: number,
  payload: KilnBatchLayoutUpdateIn,
): Promise<KilnBatchLayout> =>
  apiClient.put<KilnBatchLayout>(`${KILN_BATCHES}/${batchId}/layout`, payload);

export const suggestKilnBatchLayout = (
  batchId: number,
  payload?: KilnBatchLayoutSuggestIn,
): Promise<KilnBatchLayoutSuggestion> =>
  apiClient.post<KilnBatchLayoutSuggestion>(
    `${KILN_BATCHES}/${batchId}/layout/suggest`,
    payload ?? {},
  );
