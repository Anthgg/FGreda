import { V2NextMaterialsPanel } from "@/features/cotizadorV2Next/steps/materials/V2NextMaterialsPanel";
import type { PasoDelAsistenteProps } from "@/features/cotizadorV2Next/shell/pasosDelAsistente";

/** Paso "Arcilla y esmalte" del Cotizador V2 rediseñado. */
export function V2NextMaterialsStep(props: PasoDelAsistenteProps) {
  return <V2NextMaterialsPanel {...props} />;
}
