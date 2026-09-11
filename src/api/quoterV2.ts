/**
 * Cliente HTTP del Cotizador V2.
 *
 * Ruta propia: `/quotations-v2`. No comparte ni un segmento con `/quotations`,
 * de modo que ninguna llamada de V2 puede acabar resuelta por un endpoint del
 * Cotizador histórico —ni al revés— por un error de composición de URL.
 *
 * Este módulo no importa nada de `@/api/quotations` ni de
 * `@/api/quotationBuilder`. `quoterV2.test.ts` lo comprueba.
 */

import { apiClient } from "@/api/client";
import { toQuery } from "@/api/masters";
import type {
  V2Quotation,
  V2QuotationCreateInput,
  V2QuotationPage,
} from "@/types/quoterV2";

export const QUOTER_V2_BASE = "/quotations-v2";

export const fetchV2Quotations = (
  filters: Record<string, unknown> = {},
): Promise<V2QuotationPage> => apiClient.get(`${QUOTER_V2_BASE}${toQuery(filters)}`);

export const fetchV2Quotation = (id: number): Promise<V2Quotation> =>
  apiClient.get(`${QUOTER_V2_BASE}/${id}`);

export const createV2Quotation = (payload: V2QuotationCreateInput): Promise<V2Quotation> =>
  apiClient.post(QUOTER_V2_BASE, payload);
