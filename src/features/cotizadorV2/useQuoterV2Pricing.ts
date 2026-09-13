import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchV2Pricing, setV2Pricing } from "@/api/quoterV2Pricing";
import type { V2PricingInput } from "@/types/quoterV2Pricing";
import {
  alcanceDeGuardado,
  claveDeGuardado,
  invalidarCotizacion,
  RECORDAR_GUARDADO,
  V2_PRICING_KEY,
  V2_STALE_TIME,
} from "@/features/cotizadorV2/claves";

export { V2_PRICING_KEY } from "@/features/cotizadorV2/claves";


export const useV2Pricing = (quotationId: number) =>
  useQuery({
    queryKey: [...V2_PRICING_KEY, quotationId],
    queryFn: () => fetchV2Pricing(quotationId),
    staleTime: V2_STALE_TIME,
  });

/**
 * Cambiar el factor invalida también las LÍNEAS.
 *
 * Cada línea lleva su precio unitario y su total, y los dos salen del factor.
 * Sin esta invalidación la tabla de productos seguiría enseñando los precios
 * anteriores junto a un total nuevo, y las dos cifras no cuadrarían.
 */
export const useSetV2Pricing = (quotationId: number) => {
  const client = useQueryClient();
  return useMutation({
    mutationKey: claveDeGuardado(quotationId, "precio"),
    scope: alcanceDeGuardado(quotationId),
    gcTime: RECORDAR_GUARDADO,
    mutationFn: (payload: V2PricingInput) => setV2Pricing(quotationId, payload),
    onSuccess: () => {
      void invalidarCotizacion(client, quotationId);
    },
  });
};
