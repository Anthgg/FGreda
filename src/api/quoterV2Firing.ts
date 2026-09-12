/**
 * Cliente HTTP de la quema del Cotizador V2.
 *
 * Dos rutas sobre una misma cosa: leer la quema de una cotización y cambiarla.
 * Los hornos y sus tarifas se administran en la configuración V2, desde 010B:
 * son política del taller y valen para todo lo que se cotice después.
 *
 * No importa nada del Cotizador histórico. `quoterV2.test.ts` lo comprueba.
 */

import { apiClient } from "@/api/client";
import type { V2Firing, V2FiringInput } from "@/types/quoterV2Firing";

const QUOTATIONS = "/quotations-v2";

export const fetchV2Firing = (quotationId: number): Promise<V2Firing> =>
  apiClient.get(`${QUOTATIONS}/${quotationId}/firing`);

/**
 * Manda SOLO lo que cambió.
 *
 * Es la mitad de la semántica de PATCH que el backend implementa: lo ausente
 * se conserva. Mandar el formulario entero convertiría cada guardado en
 * «reelegí el horno» y retiraría las tarifas pactadas en esta cotización.
 */
export const setV2Firing = (quotationId: number, payload: V2FiringInput): Promise<V2Firing> =>
  apiClient.put(`${QUOTATIONS}/${quotationId}/firing`, payload);
