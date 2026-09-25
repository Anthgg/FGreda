import { V2PricingPanel } from "@/features/cotizadorV2/V2PricingPanel";
import type { PasoDelAsistenteProps } from "@/features/cotizadorV2Next/shell/pasosDelAsistente";

/**
 * Paso «Precio» del Cotizador V2 rediseñado.
 *
 * INTERINO (010O.3): pinta el margen y precio del asistente anterior tal cual
 * —con adicionales y reducciones—, con sus guardados y sus hooks. El contenido
 * de este paso se reescribe en su propia fase sin tocar ningún otro archivo.
 */
export function V2NextPricingStep({ quotationId, canEdit }: PasoDelAsistenteProps) {
  return <V2PricingPanel quotationId={quotationId} canEdit={canEdit} />;
}
