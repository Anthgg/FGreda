/**
 * Cliente HTTP de Solo Quema V2 (fase 010K).
 *
 * Recurso propio, `/firing-quotations-v2`. No comparte ruta con el Cotizador V2
 * ni con la quema Legacy: son documentos distintos con talonario distinto.
 */

import { apiClient } from "@/api/client";
import type {
  V2FiringQuotation,
  V2FiringQuotationCreateInput,
  V2FiringQuotationDuplicateResult,
  V2FiringQuotationLineInput,
  V2FiringQuotationPage,
  V2FiringQuotationPreview,
  V2FiringQuotationUpdateInput,
} from "@/types/firingQuotationV2";

const BASE = "/firing-quotations-v2";

export const fetchFiringQuotations = (params?: {
  limit?: number;
  offset?: number;
}): Promise<V2FiringQuotationPage> => {
  const query = new URLSearchParams();
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  if (params?.offset !== undefined) query.set("offset", String(params.offset));
  const cola = query.toString();
  return apiClient.get(cola ? `${BASE}?${cola}` : BASE);
};

export const fetchFiringQuotation = (id: number): Promise<V2FiringQuotation> =>
  apiClient.get(`${BASE}/${id}`);

export const createFiringQuotation = (
  payload: V2FiringQuotationCreateInput,
): Promise<V2FiringQuotation> => apiClient.post(BASE, payload);

export const updateFiringQuotation = (
  id: number,
  payload: V2FiringQuotationUpdateInput,
): Promise<V2FiringQuotation> => apiClient.put(`${BASE}/${id}`, payload);

export const addFiringQuotationLine = (
  id: number,
  payload: V2FiringQuotationLineInput,
): Promise<V2FiringQuotation> => apiClient.post(`${BASE}/${id}/lines`, payload);

export const updateFiringQuotationLine = (
  id: number,
  lineId: number,
  payload: V2FiringQuotationLineInput,
): Promise<V2FiringQuotation> => apiClient.put(`${BASE}/${id}/lines/${lineId}`, payload);

export const deleteFiringQuotationLine = (
  id: number,
  lineId: number,
): Promise<V2FiringQuotation> => apiClient.delete(`${BASE}/${id}/lines/${lineId}`);

export const fetchFiringQuotationPreview = (id: number): Promise<V2FiringQuotationPreview> =>
  apiClient.get(`${BASE}/${id}/preview`);

export const confirmFiringQuotation = (
  id: number,
  expectedFingerprint: string,
): Promise<V2FiringQuotation> =>
  apiClient.post(`${BASE}/${id}/confirm`, { expected_fingerprint: expectedFingerprint });

export const cancelFiringQuotation = (
  id: number,
  reason: string | null,
): Promise<V2FiringQuotation> => apiClient.post(`${BASE}/${id}/cancel`, { reason });

export const duplicateFiringQuotation = (
  id: number,
): Promise<V2FiringQuotationDuplicateResult> => apiClient.post(`${BASE}/${id}/duplicate`, {});

/**
 * El documento, como binario y con el nombre que le puso el backend.
 *
 * No se abre una URL suelta: el PDF va detrás de la sesión, y un enlace sin
 * cabeceras acabaría en el login en vez de en el documento.
 */
export const fetchFiringQuotationPdf = (
  id: number,
): Promise<{ blob: Blob; filename: string | null }> =>
  apiClient.getBlobWithFilename(`${BASE}/${id}/pdf`);
