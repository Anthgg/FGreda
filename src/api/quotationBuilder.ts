import { apiClient } from "@/api/client";
import { toQuery } from "@/api/masters";
import type {
  BodyMaterialOptionPage,
  QuotationBuilderDraftIn,
  QuotationBuilderOut,
} from "@/types/quotationBuilder";

const BUILDER = "/quotation-builder";

/**
 * Materiales que pueden formar el cuerpo de una pieza.
 *
 * Qué categorías del maestro califican lo decide el backend: aquí no se filtra
 * por tipo de producto ni se adivina. Si mañana cambia la regla, cambia en un
 * sitio y esta pantalla la obedece sin enterarse.
 */
export const fetchBodyMaterials = (filters: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<BodyMaterialOptionPage> =>
  apiClient.get(`${BUILDER}/body-materials${toQuery(filters as Record<string, unknown>)}`);

export const previewQuotationBuilder = (
  payload: QuotationBuilderDraftIn,
): Promise<QuotationBuilderOut> => apiClient.post(`${BUILDER}/preview`, payload);

export const createQuotationBuilder = (
  payload: QuotationBuilderDraftIn,
): Promise<QuotationBuilderOut> => apiClient.post(BUILDER, payload);

export const fetchQuotationBuilder = (id: number): Promise<QuotationBuilderOut> =>
  apiClient.get(`${BUILDER}/${id}`);

export const updateQuotationBuilder = (
  id: number,
  payload: QuotationBuilderDraftIn & { expected_updated_at: string },
): Promise<QuotationBuilderOut> => apiClient.put(`${BUILDER}/${id}`, payload);

export const confirmQuotationBuilder = (
  id: number,
  expectedUpdatedAt: string,
): Promise<QuotationBuilderOut> =>
  apiClient.post(`${BUILDER}/${id}/confirm`, { expected_updated_at: expectedUpdatedAt });

export const cancelQuotationBuilder = (id: number): Promise<QuotationBuilderOut> =>
  apiClient.post(`${BUILDER}/${id}/cancel`, {});

export const duplicateQuotationBuilder = (id: number): Promise<QuotationBuilderOut> =>
  apiClient.post(`${BUILDER}/${id}/duplicate`, {});

/** Registra el cobro. El backend decide si la transición es legal. */
export const markQuotationBuilderPaid = (id: number): Promise<QuotationBuilderOut> =>
  apiClient.post(`${BUILDER}/${id}/mark-paid`, {});

export const fetchDraftPdfPreview = (
  payload: QuotationBuilderDraftIn,
): Promise<{ blob: Blob; filename: string | null }> =>
  apiClient.postBlobWithFilename(`${BUILDER}/pdf-preview`, payload);

export const fetchSavedDraftPdfPreview = (
  id: number,
): Promise<{ blob: Blob; filename: string | null }> =>
  apiClient.getBlobWithFilename(`${BUILDER}/${id}/pdf-preview`);
