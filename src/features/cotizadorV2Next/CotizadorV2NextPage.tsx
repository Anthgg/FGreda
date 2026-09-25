import { Navigate, useParams } from "react-router-dom";

import { EmptyState } from "@/features/masters/MasterTable";
import { PASOS, esPasoValido } from "@/features/cotizadorV2/pasos";
import { V2NextQuotationList } from "@/features/cotizadorV2Next/V2NextQuotationList";
import { RUTA_V2_NEXT } from "@/features/cotizadorV2Next/shell/rutas";
import { V2NextWizard } from "@/features/cotizadorV2Next/shell/V2NextWizard";

/** `/cotizador-v2-next/7/3` → el tercer paso por su nombre. Enlaces de antes de 010O.3. */
const PASO_NUMERICO = /^[1-7]$/;

/**
 * Entrada del Cotizador V2 rediseñado: el listado, o una cotización en su paso.
 * Fase 010O.3.
 */
export function CotizadorV2NextPage() {
  const { id, step } = useParams();

  if (id === undefined) return <V2NextQuotationList />;

  const quotationId = Number(id);
  if (!Number.isInteger(quotationId) || quotationId <= 0) {
    return <EmptyState message="Esa cotización V2 no existe. Comprueba el enlace." />;
  }

  if (step !== undefined && PASO_NUMERICO.test(step)) {
    const destino = PASOS[Number(step) - 1]?.id ?? "cliente";
    return <Navigate to={`${RUTA_V2_NEXT}/${quotationId}/${destino}`} replace />;
  }

  // Un paso que no existe no merece una pantalla de error: el shell lleva al
  // primero que falte, igual que una ficha abierta sin paso.
  const paso = esPasoValido(step) ? step : null;
  return (
    <V2NextWizard key={quotationId} quotationId={quotationId} paso={paso} rutaBase={RUTA_V2_NEXT} />
  );
}
