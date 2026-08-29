/**
 * Estado del modulo de quemas sobre TanStack Query.
 *
 * La cache de la query es la unica copia del estado del servidor.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  calculateFiring,
  cancelFiring,
  confirmFiring,
  createFiring,
  createKiln,
  fetchConfirmedFiringLines,
  fetchFiring,
  fetchFirings,
  fetchKiln,
  fetchKilnRates,
  fetchKilns,
  setKilnOccupancyFactors,
  setKilnRate,
  updateFiring,
  updateKiln,
} from "@/api/firings";
import type {
  FiringFilters,
  FiringIn,
  KilnCreate,
  KilnOccupancyFactorIn,
  KilnRateIn,
  KilnUpdate,
} from "@/types/firings";

export const KILNS_KEY = ["kilns"] as const;
export const kilnKey = (id: number) => [...KILNS_KEY, id] as const;
export const kilnRatesKey = (id: number) => [...KILNS_KEY, id, "rates"] as const;
export const FIRINGS_KEY = ["firings"] as const;
export const firingKey = (id: number) => [...FIRINGS_KEY, id] as const;

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------
export function useKilns(
  filters: { search?: string; active?: boolean; limit?: number; offset?: number } = {},
) {
  return useQuery({
    queryKey: [...KILNS_KEY, filters],
    queryFn: () => fetchKilns(filters),
  });
}

export function useKiln(id: number | null) {
  return useQuery({
    queryKey: kilnKey(id!),
    queryFn: () => fetchKiln(id!),
    enabled: id !== null,
  });
}

export function useKilnRates(id: number | null) {
  return useQuery({
    queryKey: kilnRatesKey(id!),
    queryFn: () => fetchKilnRates(id!),
    enabled: id !== null,
  });
}

export function useFirings(filters: FiringFilters) {
  return useQuery({
    queryKey: [...FIRINGS_KEY, filters],
    queryFn: () => fetchFirings(filters),
  });
}

export const CONFIRMED_LINES_KEY = ["firing-lines"] as const;

/** Líneas de quemas confirmadas, opcionalmente acotadas a un producto. */
export function useConfirmedFiringLines(filters: {
  product_id?: number;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: [...CONFIRMED_LINES_KEY, filters],
    queryFn: () => fetchConfirmedFiringLines(filters),
  });
}

export function useFiring(id: number | null) {
  return useQuery({
    queryKey: firingKey(id!),
    queryFn: () => fetchFiring(id!),
    enabled: id !== null,
  });
}

/**
 * Vista previa del costo mientras se edita.
 *
 * `payload` en `null` desactiva la consulta: sin sesiones ni piezas no hay
 * nada que calcular y el servidor respondería 422 en cada tecleo.
 */
export function useFiringPreview(payload: FiringIn | null) {
  return useQuery({
    queryKey: ["firing-preview", payload],
    queryFn: () => calculateFiring(payload!),
    enabled: payload !== null,
    // Un error de validacion es una respuesta esperada mientras se captura:
    // reintentarlo solo retrasa el mensaje.
    retry: false,
  });
}

// ---------------------------------------------------------------------------
// Mutaciones
// ---------------------------------------------------------------------------
export function useCreateKiln() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: KilnCreate) => createKiln(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KILNS_KEY }),
  });
}

export function useUpdateKiln(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: KilnUpdate) => updateKiln(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KILNS_KEY }),
  });
}

/**
 * Guarda la tabla de factores de un horno.
 *
 * Invalida los hornos para que la ficha vuelva a leerse del backend: la
 * respuesta trae los tramos ya normalizados y ordenados por el servidor, que
 * es la version que debe verse, no la que quedo en el formulario.
 */
export function useSetKilnOccupancyFactors(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: KilnOccupancyFactorIn[]) => setKilnOccupancyFactors(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KILNS_KEY }),
  });
}

export function useSetKilnRate(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: KilnRateIn) => setKilnRate(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KILNS_KEY });
      qc.invalidateQueries({ queryKey: kilnRatesKey(id) });
    },
  });
}

export function useCreateFiring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: FiringIn) => createFiring(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: FIRINGS_KEY }),
  });
}

export function useUpdateFiring(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: FiringIn) => updateFiring(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: FIRINGS_KEY }),
  });
}

export function useConfirmFiring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => confirmFiring(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: FIRINGS_KEY }),
  });
}

export function useCancelFiring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => cancelFiring(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: FIRINGS_KEY }),
  });
}
