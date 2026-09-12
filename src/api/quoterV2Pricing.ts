/**
 * Cliente HTTP del motor económico del Cotizador V2.
 *
 * Dos rutas sobre una misma cosa: leer el resultado económico de una cotización
 * y cambiar su factor comercial. No hay más que decidir —los costos los fijan
 * 010C a 010E— y por eso el cuerpo de entrada tiene un solo campo.
 *
 * No importa nada del Cotizador histórico. `quoterV2.test.ts` lo comprueba.
 */

import { apiClient } from "@/api/client";
import type { V2Pricing, V2PricingInput } from "@/types/quoterV2Pricing";

const QUOTATIONS = "/quotations-v2";

export const fetchV2Pricing = (quotationId: number): Promise<V2Pricing> =>
  apiClient.get(`${QUOTATIONS}/${quotationId}/pricing`);

export const setV2Pricing = (quotationId: number, payload: V2PricingInput): Promise<V2Pricing> =>
  apiClient.put(`${QUOTATIONS}/${quotationId}/pricing`, payload);
