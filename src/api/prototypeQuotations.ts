import { apiClient } from "@/api/client";
import { toQuery } from "@/api/masters";
import type {
  PrototypeQuotation,
  PrototypeQuotationDraftInput,
  PrototypeQuotationPage,
  PrototypeQuotationUpdateInput,
} from "@/types/prototypeQuotations";

const BASE = "/prototype-quotations";

export const fetchPrototypeQuotations = (
  filters: Record<string, unknown> = {},
): Promise<PrototypeQuotationPage> => apiClient.get(`${BASE}${toQuery(filters)}`);

export const fetchPrototypeQuotation = (id: number): Promise<PrototypeQuotation> =>
  apiClient.get(`${BASE}/${id}`);

/**
 * Cuánto costaría y cuánto tardaría, sin guardar nada.
 *
 * El backend calcula sobre una fila en memoria y deshace la transacción: mirar
 * un precio no gasta un correlativo ni deja borradores sueltos cada vez que
 * alguien mueve un día arriba o abajo.
 */
export const previewPrototypeQuotation = (
  payload: PrototypeQuotationDraftInput,
): Promise<PrototypeQuotation> => apiClient.post(`${BASE}/preview`, payload);

export const createPrototypeQuotation = (
  payload: PrototypeQuotationDraftInput,
): Promise<PrototypeQuotation> => apiClient.post(BASE, payload);

export const updatePrototypeQuotation = (
  id: number,
  payload: PrototypeQuotationUpdateInput,
): Promise<PrototypeQuotation> => apiClient.put(`${BASE}/${id}`, payload);

/** Emite el documento: le pone número CPR y congela el precio. */
export const confirmPrototypeQuotation = (id: number): Promise<PrototypeQuotation> =>
  apiClient.post(`${BASE}/${id}/confirm`, {});

export const cancelPrototypeQuotation = (id: number): Promise<PrototypeQuotation> =>
  apiClient.post(`${BASE}/${id}/cancel`, {});

/**
 * Registra el cobro y habilita la muestra para el taller.
 *
 * No gasta material: eso ocurre al arrancarla. Devuelve la cotización con la
 * muestra ya asociada.
 */
export const markPrototypeQuotationPaid = (id: number): Promise<PrototypeQuotation> =>
  apiClient.post(`${BASE}/${id}/mark-paid`, {});

export const prototypeQuotationPdfUrl = (id: number): string => `/api/v1${BASE}/${id}/pdf`;
