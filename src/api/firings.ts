/**
 * Capa API del modulo de quemas.
 *
 * Todo pasa por el cliente HTTP unico; ningun componente usa `fetch`.
 */

import { apiClient } from "@/api/client";
import { toQuery } from "@/api/masters";
import type {
  ConfirmedFiringLinePage,
  FiringCalculateOut,
  FiringFilters,
  FiringIn,
  FiringOut,
  FiringPage,
  KilnCreate,
  KilnOccupancyFactorIn,
  KilnOccupancyFactorOut,
  KilnOut,
  KilnPage,
  KilnRateIn,
  KilnRateOut,
  KilnUpdate,
} from "@/types/firings";

const KILNS = "/kilns";
const FIRINGS = "/firings";

// ---------------------------------------------------------------------------
// Hornos
// ---------------------------------------------------------------------------
export function fetchKilns(filters: {
  search?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
}): Promise<KilnPage> {
  return apiClient.get<KilnPage>(KILNS + toQuery(filters as Record<string, unknown>));
}

export function fetchKiln(id: number): Promise<KilnOut> {
  return apiClient.get<KilnOut>(`${KILNS}/${id}`);
}

export function createKiln(payload: KilnCreate): Promise<KilnOut> {
  return apiClient.post<KilnOut>(KILNS, payload);
}

export function updateKiln(id: number, payload: KilnUpdate): Promise<KilnOut> {
  return apiClient.put<KilnOut>(`${KILNS}/${id}`, payload);
}

/** Reemplaza la tabla completa de factores de ocupación de un horno. */
export function setKilnOccupancyFactors(
  kilnId: number,
  payload: KilnOccupancyFactorIn[],
): Promise<KilnOccupancyFactorOut[]> {
  return apiClient.put<KilnOccupancyFactorOut[]>(
    `${KILNS}/${kilnId}/occupancy-factors`,
    payload,
  );
}

// ---------------------------------------------------------------------------
// Tarifas
// ---------------------------------------------------------------------------
export function fetchKilnRates(kilnId: number): Promise<KilnRateOut[]> {
  return apiClient.get<KilnRateOut[]>(`${KILNS}/${kilnId}/rates`);
}

export function setKilnRate(kilnId: number, payload: KilnRateIn): Promise<KilnRateOut> {
  return apiClient.post<KilnRateOut>(`${KILNS}/${kilnId}/rates`, payload);
}

// ---------------------------------------------------------------------------
// Hojas de quema
// ---------------------------------------------------------------------------
export function fetchFirings(filters: FiringFilters): Promise<FiringPage> {
  return apiClient.get<FiringPage>(FIRINGS + toQuery(filters as Record<string, unknown>));
}

export function fetchFiring(id: number): Promise<FiringOut> {
  return apiClient.get<FiringOut>(`${FIRINGS}/${id}`);
}

export function createFiring(payload: FiringIn): Promise<FiringOut> {
  return apiClient.post<FiringOut>(FIRINGS, payload);
}

export function updateFiring(id: number, payload: FiringIn): Promise<FiringOut> {
  return apiClient.put<FiringOut>(`${FIRINGS}/${id}`, payload);
}

export function confirmFiring(id: number): Promise<FiringOut> {
  return apiClient.post<FiringOut>(`${FIRINGS}/${id}/confirm`, {});
}

export function cancelFiring(id: number): Promise<FiringOut> {
  return apiClient.post<FiringOut>(`${FIRINGS}/${id}/cancel`, {});
}

/**
 * Simulador. Es el **unico** sitio donde se calcula el costo de una quema:
 * el frontend no reimplementa el reparto ni el factor.
 */
export function calculateFiring(payload: FiringIn): Promise<FiringCalculateOut> {
  return apiClient.post<FiringCalculateOut>(`${FIRINGS}/calculate`, payload);
}

/**
 * Líneas de quemas confirmadas para el cotizador.
 *
 * Una sola petición: listar las quemas y pedir el detalle de cada una para
 * quedarse con una fila obligaría a traer cien documentos completos.
 */
export function fetchConfirmedFiringLines(filters: {
  product_id?: number;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<ConfirmedFiringLinePage> {
  return apiClient.get<ConfirmedFiringLinePage>(
    "/firing-lines" + toQuery(filters as Record<string, unknown>),
  );
}
