/**
 * Consulta de identidad (DNI/RUC) bajo demanda.
 *
 * Son mutaciones, no queries: una consulta gasta cuota externa real, asi que
 * solo debe dispararse cuando el usuario pulsa el boton, nunca automatico ni
 * en cada tecla.
 */

import { useMutation } from "@tanstack/react-query";

import { fetchDniLookup, fetchRucLookup } from "@/api/identity";

export function useDniLookup() {
  return useMutation({
    mutationFn: (dni: string) => fetchDniLookup(dni),
  });
}

export function useRucLookup() {
  return useMutation({
    mutationFn: (ruc: string) => fetchRucLookup(ruc),
  });
}
