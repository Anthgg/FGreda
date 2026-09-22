import { useState } from "react";

import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  XMarkIcon,
} from "./layoutIcons";

import type { KilnBatchLayoutSuggestion } from "../../../types/kilnBatches";

interface KilnSuggestionBannerProps {
  suggestion: KilnBatchLayoutSuggestion;
  onApply: () => void;
  onDismiss: () => void;
}

export function KilnSuggestionBanner({
  suggestion,
  onApply,
  onDismiss,
}: KilnSuggestionBannerProps) {
  const [showDetails, setShowDetails] = useState(false);

  const getReasonLabel = (reason: string): string => {
    switch (reason) {
      case "NO_LEVEL_FITS_HEIGHT":
        return "La pieza supera la altura útil de todos los niveles";
      case "NO_SPACE_AVAILABLE":
        return "No hay espacio físico libre disponible en ningún nivel";
      case "NO_LEVELS":
        return "No existen niveles configurados en el horno";
      default:
        return reason;
    }
  };

  return (
    <div
      role="region"
      aria-label="Vista previa de sugerencia de acomodo"
      className="rounded-2xl border border-purple-300 bg-purple-50/80 p-4 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white shadow-sm">
            <SparklesIcon className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-purple-950">
                Vista previa de acomodo automático sugerido
              </h4>
              <span className="rounded-full bg-purple-200 px-2.5 py-0.5 text-xs font-semibold text-purple-800">
                Borrador provisional
              </span>
            </div>
            <p className="mt-1 text-xs text-purple-800">
              Se han sugerido acomodos para{" "}
              <span className="font-bold text-purple-950">{suggestion.suggested_count}</span> de{" "}
              <span className="font-bold text-purple-950">{suggestion.total_pending}</span> piezas
              pendientes.
              {suggestion.unplaced_count > 0 && (
                <span className="ml-1 text-amber-700">
                  ({suggestion.unplaced_count} piezas no pudieron ubicarse por restricciones de
                  espacio o altura).
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          {suggestion.unplaced_count > 0 && (
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="inline-flex items-center gap-1 rounded-xl bg-purple-100 px-3 py-2 text-xs font-semibold text-purple-800 hover:bg-purple-200"
            >
              {showDetails ? (
                <>
                  Ocultar detalles <ChevronUpIcon className="h-4 w-4" />
                </>
              ) : (
                <>
                  Ver sin acomodar ({suggestion.unplaced_count}) <ChevronDownIcon className="h-4 w-4" />
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex items-center gap-1.5 rounded-xl border border-purple-300 bg-white px-3 py-2 text-xs font-semibold text-purple-900 shadow-sm hover:bg-purple-50"
          >
            <XMarkIcon className="h-4 w-4 text-purple-700" />
            Descartar
          </button>

          <button
            type="button"
            onClick={onApply}
            className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-700"
          >
            <CheckIcon className="h-4 w-4" />
            Aplicar al borrador
          </button>
        </div>
      </div>

      {/* Lista desplegable de piezas que no se pudieron ubicar */}
      {showDetails && suggestion.unplaced_pieces.length > 0 && (
        <div className="mt-4 rounded-xl border border-purple-200 bg-white/90 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
            <ExclamationTriangleIcon className="h-4 w-4" />
            <span>Piezas que no entraron en el horno:</span>
          </div>
          <div className="mt-2 max-h-40 overflow-y-auto divide-y divide-zinc-100 text-xs text-zinc-700">
            {suggestion.unplaced_pieces.map((up, idx) => (
              <div key={idx} className="flex items-center justify-between py-1.5">
                <div>
                  <span className="font-semibold text-zinc-900">
                    Asignación #{up.batch_assignment_id}
                  </span>
                  {up.unit_index !== null && up.unit_index !== undefined && (
                    <span className="ml-1 text-zinc-500">(Unidad {up.unit_index})</span>
                  )}
                </div>
                <span className="text-zinc-500">{getReasonLabel(up.reason)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
