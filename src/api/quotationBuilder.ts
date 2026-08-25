import { apiClient } from "@/api/client";
import type { QuotationBuilderDraftIn, QuotationBuilderOut } from "@/types/quotationBuilder";

const BUILDER = "/quotation-builder";

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
