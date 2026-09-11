/**
 * Cliente HTTP de la configuración del Cotizador V2.
 *
 * Ruta propia bajo `/quoter-v2/settings`, separada de `/settings` —la
 * configuración de la empresa— y de `/quotations-v2` —los documentos—.
 *
 * No importa nada del Cotizador histórico. `quoterV2.test.ts` lo comprueba.
 */

import { apiClient } from "@/api/client";
import type {
  FiringType,
  V2KilnRateInput,
  V2SettingsPage,
  V2SettingsUpdateInput,
} from "@/types/quoterV2Settings";

export const QUOTER_V2_SETTINGS_BASE = "/quoter-v2/settings";

export const fetchV2Settings = (): Promise<V2SettingsPage> =>
  apiClient.get(QUOTER_V2_SETTINGS_BASE);

export const updateV2Settings = (payload: V2SettingsUpdateInput): Promise<V2SettingsPage> =>
  apiClient.put(QUOTER_V2_SETTINGS_BASE, payload);

/**
 * Fija los tres números de un horno para baja o para alta.
 *
 * Devuelve la página entera: la pantalla muestra la tabla completa y con una
 * respuesta parcial tendría que volver a pedirla.
 */
export const setV2KilnRate = (
  kilnId: number,
  firingType: FiringType,
  payload: V2KilnRateInput,
): Promise<V2SettingsPage> =>
  apiClient.put(`${QUOTER_V2_SETTINGS_BASE}/kiln-rates/${kilnId}/${firingType}`, payload);
