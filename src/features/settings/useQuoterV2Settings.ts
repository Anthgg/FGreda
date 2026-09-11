import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchV2Settings, setV2KilnRate, updateV2Settings } from "@/api/quoterV2Settings";
import type {
  FiringType,
  V2KilnRateInput,
  V2SettingsUpdateInput,
} from "@/types/quoterV2Settings";

/** Clave propia, distinta de la de la configuración de la empresa. */
export const V2_SETTINGS_KEY = ["settings", "quoter-v2"] as const;

export const useV2Settings = () =>
  useQuery({ queryKey: V2_SETTINGS_KEY, queryFn: fetchV2Settings });

/**
 * Guardar solo refresca la configuración.
 *
 * NO invalida el listado de cotizaciones, y eso es exactamente lo que dice el
 * principio de la fase: las que ya existen no cambian —cada una se llevó su
 * copia— y la siguiente todavía no está en caché. Invalidarlo sugeriría que
 * mover un default toca lo ya cotizado, que es justo lo contrario.
 */
export const useUpdateV2Settings = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: V2SettingsUpdateInput) => updateV2Settings(payload),
    onSuccess: (data) => client.setQueryData(V2_SETTINGS_KEY, data),
  });
};

export const useSetV2KilnRate = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (vars: { kilnId: number; firingType: FiringType; payload: V2KilnRateInput }) =>
      setV2KilnRate(vars.kilnId, vars.firingType, vars.payload),
    onSuccess: (data) => client.setQueryData(V2_SETTINGS_KEY, data),
  });
};
