/**
 * Cliente HTTP de los materiales del Cotizador V2.
 *
 * Dos rutas distintas porque son dos cosas distintas: la valorización de un
 * material del maestro y las líneas de una cotización.
 *
 * No importa nada del Cotizador histórico. `quoterV2.test.ts` lo comprueba.
 */

import { apiClient } from "@/api/client";
import { toQuery } from "@/api/masters";
import type {
  V2Material,
  V2MaterialKind,
  V2MaterialUpsertInput,
  V2QuotationProduct,
  V2QuotationProductInput,
  V2QuotationProductsPage,
} from "@/types/quoterV2Materials";

export const V2_MATERIALS_BASE = "/quoter-v2/materials";
const QUOTATIONS = "/quotations-v2";

export const fetchV2Materials = (kind?: V2MaterialKind): Promise<{ items: V2Material[] }> =>
  apiClient.get(`${V2_MATERIALS_BASE}${toQuery(kind ? { kind } : {})}`);

export const upsertV2Material = (
  productId: number,
  payload: V2MaterialUpsertInput,
): Promise<V2Material> => apiClient.put(`${V2_MATERIALS_BASE}/${productId}`, payload);

export const fetchV2QuotationProducts = (
  quotationId: number,
): Promise<V2QuotationProductsPage> =>
  apiClient.get(`${QUOTATIONS}/${quotationId}/products`);

export const addV2QuotationProduct = (
  quotationId: number,
  payload: V2QuotationProductInput,
): Promise<V2QuotationProduct> =>
  apiClient.post(`${QUOTATIONS}/${quotationId}/products`, payload);

export const updateV2QuotationProduct = (
  quotationId: number,
  lineId: number,
  payload: V2QuotationProductInput,
): Promise<V2QuotationProduct> =>
  apiClient.put(`${QUOTATIONS}/${quotationId}/products/${lineId}`, payload);

export const deleteV2QuotationProduct = (
  quotationId: number,
  lineId: number,
): Promise<void> => apiClient.delete(`${QUOTATIONS}/${quotationId}/products/${lineId}`);
