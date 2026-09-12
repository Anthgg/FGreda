import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchV2Pricing, setV2Pricing } from "@/api/quoterV2Pricing";
import { V2_LINES_KEY } from "@/features/cotizadorV2/useQuoterV2Materials";
import type { V2PricingInput } from "@/types/quoterV2Pricing";

export const V2_PRICING_KEY = ["quoter-v2", "pricing"] as const;

export const useV2Pricing = (quotationId: number) =>
  useQuery({
    queryKey: [...V2_PRICING_KEY, quotationId],
    queryFn: () => fetchV2Pricing(quotationId),
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
    mutationFn: (payload: V2PricingInput) => setV2Pricing(quotationId, payload),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: [...V2_PRICING_KEY, quotationId] });
      void client.invalidateQueries({ queryKey: [...V2_LINES_KEY, quotationId] });
    },
  });
};
