import { V2LaborLines } from "@/features/cotizadorV2/V2LaborLines";
import type { PasoDelAsistenteProps } from "@/features/cotizadorV2Next/shell/pasosDelAsistente";

/**
 * Paso «Trabajo» del Cotizador V2 rediseñado.
 *
 * INTERINO (010O.3): pinta la mano de obra del asistente anterior tal cual
 * —procesos, personal adicional, jornada, días efectivos e ilustración—, con
 * sus guardados y sus hooks. El contenido de este paso se reescribe en su
 * propia fase sin tocar ningún otro archivo.
 */
export function V2NextLaborStep({ quotationId, canEdit }: PasoDelAsistenteProps) {
  return <V2LaborLines quotationId={quotationId} canEdit={canEdit} />;
}
