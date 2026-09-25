import { V2ProductLines } from "@/features/cotizadorV2/V2ProductLines";
import type { PasoDelAsistenteProps } from "@/features/cotizadorV2Next/shell/pasosDelAsistente";

/**
 * Paso «Piezas» del Cotizador V2 rediseñado.
 *
 * INTERINO (010O.3): pinta la vista de piezas del asistente anterior tal cual,
 * con sus guardados y sus hooks. El contenido de este paso se reescribe en su
 * propia fase sin tocar ningún otro archivo.
 */
export function V2NextProductsStep({ quotationId, canEdit }: PasoDelAsistenteProps) {
  return <V2ProductLines quotationId={quotationId} canEdit={canEdit} vista="piezas" />;
}
