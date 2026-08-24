/**
 * Capa API de la consulta de identidad (DNI/RUC).
 *
 * Nunca llama a Peru API ni a Decolecta directamente: siempre pasa por el
 * backend, que es el unico que conoce esas credenciales.
 */

import { apiClient } from "@/api/client";
import type { DniLookupResult, RucLookupResult } from "@/types/identity";

export function fetchDniLookup(dni: string): Promise<DniLookupResult> {
  return apiClient.get<DniLookupResult>(
    `/identity/dni/${encodeURIComponent(dni)}`,
  );
}

export function fetchRucLookup(ruc: string): Promise<RucLookupResult> {
  return apiClient.get<RucLookupResult>(
    `/identity/ruc/${encodeURIComponent(ruc)}`,
  );
}
