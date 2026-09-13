import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchV2Firing, setV2Firing } from "@/api/quoterV2Firing";
import {
  claveDeGuardado,
  invalidarCotizacion,
  RECORDAR_GUARDADO,
  V2_FIRING_KEY,
  V2_STALE_TIME,
} from "@/features/cotizadorV2/claves";

export { V2_FIRING_KEY } from "@/features/cotizadorV2/claves";
import type { V2FiringInput } from "@/types/quoterV2Firing";


export const useV2Firing = (quotationId: number) =>
  useQuery({
    queryKey: [...V2_FIRING_KEY, quotationId],
    queryFn: () => fetchV2Firing(quotationId),
    staleTime: V2_STALE_TIME,
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
    mutationKey: claveDeGuardado(quotationId, "quema"),
    gcTime: RECORDAR_GUARDADO,
    mutationFn: (payload: V2FiringInput) => setV2Firing(quotationId, payload),
    onSuccess: () => invalidarCotizacion(client, quotationId),
  });
};
