import React, { useState } from "react";
import { ExclamationCircleIcon, XMarkIcon } from "./layoutIcons";

import type { KilnBatchLayoutLevelIn } from "../../../types/kilnBatches";
import { toDecimal6 } from "./kilnLayoutMath";

interface KilnLevelModalProps {
  isOpen: boolean;
  kilnHeight: number;
  initialLevel?: KilnBatchLayoutLevelIn | null;
  existingLevels: KilnBatchLayoutLevelIn[];
  onSave: (level: KilnBatchLayoutLevelIn) => void;
  onClose: () => void;
}

export function KilnLevelModal({
  isOpen,
  kilnHeight,
  initialLevel,
  existingLevels,
  onSave,
  onClose,
}: KilnLevelModalProps) {
  const isEditing = initialLevel !== null && initialLevel !== undefined;

  const [name, setName] = useState(initialLevel?.name || "");
  const [z_cm, setZCm] = useState(initialLevel?.z_cm ?? "0");
  const [usable_height_cm, setUsableHeightCm] = useState(
    initialLevel?.usable_height_cm ?? "20",
  );
  const [plate_label, setPlateLabel] = useState(initialLevel?.plate_label || "");
  const [plate_thickness_cm, setPlateThicknessCm] = useState(
    initialLevel?.plate_thickness_cm || "",
  );
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const zNum = Number(z_cm);
    const hNum = Number(usable_height_cm);

    if (isNaN(zNum) || zNum < 0) {
      setError("La altura z_cm debe ser un número mayor o igual a 0.");
      return;
    }

    if (isNaN(hNum) || hNum <= 0) {
      setError("La altura útil debe ser un número mayor a 0.");
      return;
    }

    if (zNum + hNum > kilnHeight) {
      setError(
        `El nivel supera la altura útil total del horno (${kilnHeight} cm). Actualmente z (${zNum}) + altura útil (${hNum}) = ${
          zNum + hNum
        } cm.`,
      );
      return;
    }

    // Calcular el level_index
    let level_index = initialLevel?.level_index;
    if (level_index === undefined || level_index === null) {
      // Encontrar el siguiente índice libre
      const existingIndices = existingLevels.map((l) => l.level_index);
      level_index = existingIndices.length > 0 ? Math.max(...existingIndices) + 1 : 0;
    }

    onSave({
      level_index,
      name: name.trim() || null,
      z_cm: toDecimal6(zNum),
      usable_height_cm: toDecimal6(hNum),
      plate_label: plate_label.trim() || null,
      plate_thickness_cm: plate_thickness_cm.trim()
        ? toDecimal6(Number(plate_thickness_cm))
        : null,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="level-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-zinc-900/10">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <h3 id="level-modal-title" className="text-base font-semibold text-zinc-900">
            {isEditing ? "Editar nivel del horno" : "Añadir nuevo nivel"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-800">
            <ExclamationCircleIcon className="h-5 w-5 flex-shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label htmlFor="level-name" className="block font-medium text-zinc-700">
              Nombre o descripción del nivel
            </label>
            <input
              id="level-name"
              type="text"
              placeholder="p. ej. Nivel 1 - Base"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-xl border-zinc-300 py-2 px-3 text-xs text-zinc-900 shadow-sm focus:border-amber-500 focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="level-z" className="block font-medium text-zinc-700">
                Altura base z (cm) *
              </label>
              <input
                id="level-z"
                type="number"
                step="0.1"
                min="0"
                max={kilnHeight}
                required
                value={z_cm}
                onChange={(e) => setZCm(e.target.value)}
                className="mt-1 block w-full rounded-xl border-zinc-300 py-2 px-3 text-xs text-zinc-900 shadow-sm focus:border-amber-500 focus:ring-amber-500"
              />
              <span className="text-[10px] text-zinc-400">Desde la base del horno</span>
            </div>

            <div>
              <label htmlFor="level-height" className="block font-medium text-zinc-700">
                Altura útil (cm) *
              </label>
              <input
                id="level-height"
                type="number"
                step="0.1"
                min="0.1"
                max={kilnHeight}
                required
                value={usable_height_cm}
                onChange={(e) => setUsableHeightCm(e.target.value)}
                className="mt-1 block w-full rounded-xl border-zinc-300 py-2 px-3 text-xs text-zinc-900 shadow-sm focus:border-amber-500 focus:ring-amber-500"
              />
              <span className="text-[10px] text-zinc-400">Espacio vertical libre</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="level-plate" className="block font-medium text-zinc-700">
                Identificador de placa
              </label>
              <input
                id="level-plate"
                type="text"
                placeholder="p. ej. Placa refractaria A"
                value={plate_label}
                onChange={(e) => setPlateLabel(e.target.value)}
                className="mt-1 block w-full rounded-xl border-zinc-300 py-2 px-3 text-xs text-zinc-900 shadow-sm focus:border-amber-500 focus:ring-amber-500"
              />
            </div>

            <div>
              <label htmlFor="level-plate-thick" className="block font-medium text-zinc-700">
                Grosor de placa (cm)
              </label>
              <input
                id="level-plate-thick"
                type="number"
                step="0.1"
                min="0"
                value={plate_thickness_cm}
                onChange={(e) => setPlateThicknessCm(e.target.value)}
                className="mt-1 block w-full rounded-xl border-zinc-300 py-2 px-3 text-xs text-zinc-900 shadow-sm focus:border-amber-500 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700"
            >
              {isEditing ? "Guardar cambios" : "Añadir nivel"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
