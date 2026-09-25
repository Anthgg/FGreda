import { V2FiringPanel } from "@/features/cotizadorV2/V2FiringPanel";
import type { PasoDelAsistenteProps } from "@/features/cotizadorV2Next/shell/pasosDelAsistente";

/**
 * Paso «Horno» del Cotizador V2 rediseñado.
 *
 * INTERINO (010O.3): pinta la quema del asistente anterior tal cual, con sus
 * guardados y sus hooks. El contenido de este paso se reescribe en su propia
 * fase sin tocar ningún otro archivo.
 */
export function V2NextKilnStep({ quotationId, canEdit }: PasoDelAsistenteProps) {
  return <V2FiringPanel quotationId={quotationId} canEdit={canEdit} />;
}
