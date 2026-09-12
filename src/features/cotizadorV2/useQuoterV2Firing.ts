import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchV2Firing, setV2Firing } from "@/api/quoterV2Firing";
import { V2_LINES_KEY } from "@/features/cotizadorV2/useQuoterV2Materials";
import type { V2FiringInput } from "@/types/quoterV2Firing";

export const V2_FIRING_KEY = ["quoter-v2", "firing"] as const;

export const useV2Firing = (quotationId: number) =>
  useQuery({
    queryKey: [...V2_FIRING_KEY, quotationId],
    queryFn: () => fetchV2Firing(quotationId),
  });

/**
 * Cambiar la quema invalida también las LÍNEAS.
 *
 * Cada línea lleva lo que le toca del costo de quema, y ese reparto cambia con
 * el horno, con las tarifas y con encender o apagar una quema. Sin esta
 * invalidación la tabla de productos seguiría enseñando el reparto anterior
 * junto a un total nuevo, y las dos cifras no cuadrarían.
 */
export const useSetV2Firing = (quotationId: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: V2FiringInput) => setV2Firing(quotationId, payload),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: [...V2_FIRING_KEY, quotationId] });
      void client.invalidateQueries({ queryKey: [...V2_LINES_KEY, quotationId] });
    },
  });
};
