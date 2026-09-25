import { V2DocumentoEmitido } from "@/features/cotizadorV2/V2DocumentoEmitido";
import { V2ResumenStep } from "@/features/cotizadorV2/V2ResumenStep";
import type { PasoDelAsistenteProps } from "@/features/cotizadorV2Next/shell/pasosDelAsistente";

/**
 * Paso «Revisar y emitir» del Cotizador V2 rediseñado.
 *
 * INTERINO (010O.3): pinta el resumen del asistente anterior tal cual, con la
 * emisión y su huella. Una cotización que ya no es borrador enseña además el
 * documento que recibió el cliente, como hacía la ficha anterior. El contenido
 * de este paso se reescribe en su propia fase sin tocar ningún otro archivo.
 */
export function V2NextReviewStep({ datos, estados, irAPaso }: PasoDelAsistenteProps) {
  const cotizacion = datos.cotizacion;
  return (
    <div className="space-y-5">
      {cotizacion && cotizacion.status !== "DRAFT" ? (
        <V2DocumentoEmitido cotizacion={cotizacion} />
      ) : null}
      <V2ResumenStep datos={datos} estados={estados} irAPaso={irAPaso} />
    </div>
  );
}
