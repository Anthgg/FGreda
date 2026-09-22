import type { KilnBatchLayoutLevel } from "@/types/kilnBatches";

interface KilnLevelSelectorProps {
  levels: KilnBatchLayoutLevel[];
  placements: Array<{ level_index: number }>;
  activeLevelIndex?: number;
  selectedLevelIndex?: number;
  isReadOnly: boolean;
  onSelectLevel: (levelIndex: number) => void;
  onAddLevel?: () => void;
  onEditLevel?: (level: KilnBatchLayoutLevel) => void;
  onDeleteLevel?: (levelIndex: number) => void;
}

export function KilnLevelSelector({
  levels,
  placements,
  activeLevelIndex,
  selectedLevelIndex,
  isReadOnly,
  onSelectLevel,
  onEditLevel,
  onDeleteLevel,
}: KilnLevelSelectorProps) {
  const currentActive = selectedLevelIndex ?? activeLevelIndex ?? 0;

  if (levels.length === 0) {
    return null;
  }

  // Ordenar niveles por level_index ascendente
  const sortedLevels = [...levels].sort((a, b) => a.level_index - b.level_index);

  return (
    <div
      role="tablist"
      aria-label="Niveles del horno"
      className="flex flex-wrap items-center gap-2 border-b border-zinc-200 pb-2"
    >
      <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mr-2">
        Niveles:
      </span>
      {sortedLevels.map((level) => {
        const isActive = level.level_index === currentActive;
        const pieceCount = placements.filter((p) => p.level_index === level.level_index).length;

        return (
          <div
            key={level.level_index}
            className={`group inline-flex items-center rounded-xl border transition-all text-xs ${
              isActive
                ? "border-zinc-900 bg-zinc-900 text-white shadow-xs"
                : "border-zinc-200 bg-white/80 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            <button
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`${level.name || `Nivel ${level.level_index + 1}`}, ${pieceCount} piezas`}
              onClick={() => onSelectLevel(level.level_index)}
              className="flex items-center gap-2 px-3 py-1.5 font-medium"
            >
              <span>{level.name || `Nivel ${level.level_index + 1}`}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] tabular-nums font-bold ${
                  isActive ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {pieceCount} {pieceCount === 1 ? "pieza" : "piezas"}
              </span>
              <span className={`text-[10px] ${isActive ? "text-zinc-300" : "text-zinc-400"}`}>
                h: {level.usable_height_cm} cm
              </span>
            </button>

            {!isReadOnly && onEditLevel && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditLevel(level);
                }}
                title="Editar nivel"
                className={`p-1.5 hover:opacity-80 transition-opacity ${
                  isActive ? "text-zinc-300 hover:text-white" : "text-zinc-400 hover:text-zinc-800"
                }`}
              >
                <svg
                  className="size-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>
            )}

            {!isReadOnly && onDeleteLevel && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (pieceCount > 0) {
                    alert("No se puede eliminar un nivel que contiene piezas colocadas. Mueva o retire las piezas primero.");
                    return;
                  }
                  onDeleteLevel(level.level_index);
                }}
                title={pieceCount > 0 ? "Nivel con piezas no eliminable" : "Eliminar nivel"}
                disabled={pieceCount > 0}
                className={`pr-2 p-1.5 transition-opacity ${
                  pieceCount > 0
                    ? "opacity-30 cursor-not-allowed"
                    : isActive
                    ? "text-red-300 hover:text-red-100"
                    : "text-red-400 hover:text-red-600"
                }`}
              >
                <svg
                  className="size-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
