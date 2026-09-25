import { V2ClienteStep } from "@/features/cotizadorV2/V2ClienteStep";
import { Panel } from "@/features/masters/MasterTable";
import type { PasoDelAsistenteProps } from "@/features/cotizadorV2Next/shell/pasosDelAsistente";

/**
 * Paso «Cliente» del Cotizador V2 rediseñado.
 *
 * INTERINO (010O.3): pinta el paso del asistente anterior tal cual, con sus
 * guardados y sus hooks. El shell ya es el nuevo; el contenido de este paso se
 * reescribe en su propia fase sin tocar ningún otro archivo.
 */
export function V2NextClientStep({ datos, canEdit }: PasoDelAsistenteProps) {
  if (!datos.cotizacion) return null;
  return (
    <Panel>
      <V2ClienteStep cotizacion={datos.cotizacion} canEdit={canEdit} />
    </Panel>
  );
}
