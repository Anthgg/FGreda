import { ArrowPathIcon, TrashIcon, XMarkIcon } from "./layoutIcons";

import type { KilnBatchLayoutLevel } from "../../../types/kilnBatches";
import type { DisplayPlacement } from "./KilnPlacementItem";

interface KilnSelectedPiecePanelProps {
  placement: DisplayPlacement | null;
  levels: KilnBatchLayoutLevel[];
  currentLevelIndex: number;
  isReadOnly: boolean;
  onRotate: (id: string | number) => void;
  onMoveLevel: (id: string | number, targetLevelIndex: number) => void;
  onRemovePlacement: (id: string | number) => void;
  onClose: () => void;
}

export function KilnSelectedPiecePanel({
  placement,
  levels,
  currentLevelIndex,
  isReadOnly,
  onRotate,
  onMoveLevel,
  onRemovePlacement,
  onClose,
}: KilnSelectedPiecePanelProps) {
  if (!placement) return null;

  const currentLevel = levels.find((l) => l.level_index === currentLevelIndex);
  const otherLevels = levels.filter((l) => l.level_index !== currentLevelIndex);

  return (
    <div
      role="region"
      aria-label="Detalles de la pieza seleccionada"
      className="rounded-2xl border border-amber-300 bg-amber-50/50 p-4 shadow-sm"
    >
      <div className="flex items-start justify-between border-b border-amber-200/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              {placement.orderLabel || `Asignación #${placement.batch_assignment_id}`}
            </span>
            {placement.unit_index !== null && placement.unit_index !== undefined && (
              <span className="text-xs font-medium text-zinc-600">
                Unidad #{placement.unit_index}
              </span>
            )}
            {placement.isSuggested && (
              <span className="inline-flex items-center rounded-md bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">
                Sugerencia
              </span>
            )}
          </div>
          <h4 className="mt-1 text-sm font-semibold text-zinc-900">
            {placement.productName || "Pieza en horno"}
          </h4>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar panel de pieza"
          className="rounded-lg p-1 text-zinc-400 hover:bg-amber-100 hover:text-zinc-600"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Especificaciones físicas / Snapshots */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-700 sm:grid-cols-4">
        <div className="rounded-lg bg-white/80 p-2 border border-amber-100">
          <span className="text-zinc-500 block">Largo × Ancho</span>
          <span className="font-semibold text-zinc-900">
            {Number(placement.piece_length_cm_snapshot)} × {Number(placement.piece_width_cm_snapshot)} cm
          </span>
        </div>
        <div className="rounded-lg bg-white/80 p-2 border border-amber-100">
          <span className="text-zinc-500 block">Altura</span>
          <span className="font-semibold text-zinc-900">
            {Number(placement.piece_height_cm_snapshot)} cm
          </span>
        </div>
        <div className="rounded-lg bg-white/80 p-2 border border-amber-100">
          <span className="text-zinc-500 block">Separación</span>
          <span className="font-semibold text-zinc-900">
            {Number(placement.separation_cm_snapshot)} cm
          </span>
        </div>
        <div className="rounded-lg bg-white/80 p-2 border border-amber-100">
          <span className="text-zinc-500 block">Posición (X, Y)</span>
          <span className="font-semibold text-zinc-900">
            ({Number(placement.x_cm)}, {Number(placement.y_cm)}) cm
          </span>
        </div>
      </div>

      {/* Información del nivel actual */}
      <div className="mt-2 text-xs text-zinc-600">
        <span>Nivel actual: </span>
        <span className="font-medium text-zinc-800">
          {currentLevel?.name || `Nivel ${currentLevelIndex}`} (z={currentLevel?.z_cm} cm, alto útil={currentLevel?.usable_height_cm} cm)
        </span>
      </div>

      {/* Acciones operativas si no es de solo lectura */}
      {!isReadOnly && (
        <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-amber-200/80">
          {/* Botón Rotar 90° */}
          <button
            type="button"
            onClick={() => onRotate(placement.id!)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50"
          >
            <ArrowPathIcon className="h-4 w-4 text-zinc-500" />
            Rotar 90° ({placement.rotation_degrees}°)
          </button>

          {/* Mover a otro nivel */}
          {otherLevels.length > 0 && (
            <div className="inline-flex items-center gap-1.5">
              <span className="text-xs text-zinc-500">Mover a:</span>
              <div className="flex flex-wrap gap-1">
                {otherLevels.map((lvl) => (
                  <button
                    key={lvl.level_index}
                    type="button"
                    aria-label={`Mover pieza al ${lvl.name || `Nivel ${lvl.level_index}`}`}
                    onClick={() => onMoveLevel(placement.id!, lvl.level_index)}
                    className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 shadow-xs hover:bg-zinc-50"
                  >
                    {lvl.name || `Nivel ${lvl.level_index}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Botón Quitar / Desasignar del layout */}
          <button
            type="button"
            onClick={() => onRemovePlacement(placement.id!)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 ml-auto"
          >
            <TrashIcon className="h-4 w-4 text-red-600" />
            Quitar del horno
          </button>
        </div>
      )}
    </div>
  );
}
