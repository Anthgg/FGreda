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
  isStale?: boolean;
  onApply: () => void;
  onDismiss: () => void;
}

export function KilnSuggestionBanner({
  suggestion,
  isStale = false,
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
      className={`rounded-2xl border p-4 shadow-sm ${
        isStale
          ? "border-amber-300 bg-amber-50/90"
          : "border-purple-300 bg-purple-50/80"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${
              isStale ? "bg-amber-600" : "bg-purple-600"
            }`}
          >
            {isStale ? (
              <ExclamationTriangleIcon className="h-6 w-6" />
            ) : (
              <SparklesIcon className="h-6 w-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4
                className={`text-sm font-semibold ${
                  isStale ? "text-amber-950" : "text-purple-950"
                }`}
              >
                {isStale
                  ? "Sugerencia de acomodo desactualizada"
                  : "Vista previa de acomodo automático sugerido"}
              </h4>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  isStale
                    ? "bg-amber-200 text-amber-900"
                    : "bg-purple-200 text-purple-800"
                }`}
              >
                {isStale ? "Versión obsoleta" : "Borrador provisional"}
              </span>
            </div>
            <p
              className={`mt-1 text-xs ${
                isStale ? "text-amber-900" : "text-purple-800"
              }`}
            >
              {isStale ? (
                "Esta sugerencia se basó en una versión anterior de la distribución. Descartar y generar una nueva."
              ) : (
                <>
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
                </>
              )}
            </p>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          {!isStale && suggestion.unplaced_count > 0 && (
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
            className={`inline-flex items-center gap-1.5 rounded-xl border bg-white px-3 py-2 text-xs font-semibold shadow-sm ${
              isStale
                ? "border-amber-300 text-amber-900 hover:bg-amber-50"
                : "border-purple-300 text-purple-900 hover:bg-purple-50"
            }`}
          >
            <XMarkIcon
              className={`h-4 w-4 ${isStale ? "text-amber-700" : "text-purple-700"}`}
            />
            Descartar
          </button>

          <button
            type="button"
            onClick={onApply}
            disabled={isStale}
            title={
              isStale
                ? "Esta sugerencia está desactualizada. Genere una nueva sugerencia."
                : undefined
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed"
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
            {suggestion.unplaced_pieces.map((up) => (
              <div
                key={`${up.batch_assignment_id}-${up.unit_index ?? 0}-${up.reason}`}
                className="flex items-center justify-between py-1.5"
              >
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
