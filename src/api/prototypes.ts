import { apiClient } from "@/api/client";
import { toQuery } from "@/api/masters";
import type {
  Prototype,
  PrototypeCreateInput,
  PrototypeFilters,
  PrototypeMaterialInput,
  PrototypePage,
  PrototypeUpdateInput,
} from "@/types/prototypes";

const PROTOTYPES = "/prototypes";

export const fetchPrototypes = (filters: PrototypeFilters = {}): Promise<PrototypePage> =>
  apiClient.get(`${PROTOTYPES}${toQuery(filters as Record<string, unknown>)}`);

export const fetchPrototype = (id: number): Promise<Prototype> =>
  apiClient.get(`${PROTOTYPES}/${id}`);

export const createPrototype = (payload: PrototypeCreateInput): Promise<Prototype> =>
  apiClient.post(PROTOTYPES, payload);

export const updatePrototype = (id: number, payload: PrototypeUpdateInput): Promise<Prototype> =>
  apiClient.put(`${PROTOTYPES}/${id}`, payload);

export const setPrototypeMaterials = (
  id: number,
  materials: PrototypeMaterialInput[],
): Promise<Prototype> => apiClient.put(`${PROTOTYPES}/${id}/materials`, { materials });

export const startPrototype = (id: number): Promise<Prototype> =>
  apiClient.post(`${PROTOTYPES}/${id}/start`, {});

export const completePrototype = (id: number): Promise<Prototype> =>
  apiClient.post(`${PROTOTYPES}/${id}/complete`, {});

export const approvePrototype = (id: number, note?: string): Promise<Prototype> =>
  apiClient.post(`${PROTOTYPES}/${id}/approve`, { note: note || null });

export const rejectPrototype = (id: number, note?: string): Promise<Prototype> =>
  apiClient.post(`${PROTOTYPES}/${id}/reject`, { note: note || null });

export const cancelPrototype = (id: number): Promise<Prototype> =>
  apiClient.post(`${PROTOTYPES}/${id}/cancel`, {});

export const createPrototypeSuccessor = (id: number, notes?: string): Promise<Prototype> =>
  apiClient.post(`${PROTOTYPES}/${id}/successor`, { notes: notes || null });

