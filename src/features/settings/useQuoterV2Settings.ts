import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchV2Settings, setV2KilnRate, updateV2Settings } from "@/api/quoterV2Settings";
import { QUOTER_V2_KEY } from "@/features/cotizadorV2/useQuoterV2";
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
 * Guardar la configuración invalida también el listado de cotizaciones V2.
 *
 * No porque cambie las que ya existen —no las cambia: cada una se llevó su
 * copia— sino porque la SIGUIENTE nacerá con otros números, y la pantalla que
 * los muestre debe pedirlos de nuevo.
 */
export const useUpdateV2Settings = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: V2SettingsUpdateInput) => updateV2Settings(payload),
    onSuccess: (data) => {
      client.setQueryData(V2_SETTINGS_KEY, data);
      void client.invalidateQueries({ queryKey: QUOTER_V2_KEY });
    },
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
