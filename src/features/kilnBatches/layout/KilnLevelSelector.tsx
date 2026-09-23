import type { KilnBatchLayoutLevel, KilnBatchLayoutLevelIn } from "@/types/kilnBatches";

interface KilnLevelSelectorProps {
  levels: Array<KilnBatchLayoutLevelIn | KilnBatchLayoutLevel>;
  placements: Array<{ level_index: number }>;
  activeLevelIndex?: number;
  selectedLevelIndex?: number;
  isReadOnly: boolean;
  onSelectLevel: (levelIndex: number) => void;
  onAddLevel?: () => void;
  onEditLevel?: (level: KilnBatchLayoutLevelIn) => void;
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
  const activeLevel = (sortedLevels.find((l) => l.level_index === currentActive) ?? sortedLevels[0]) as KilnBatchLayoutLevel;
  const activeLevelPieceCount = placements.filter((p) => p.level_index === activeLevel.level_index).length;
  const activeLevelName = activeLevel.name || `Nivel ${activeLevel.level_index + 1}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Niveles:
        </span>
        <div
          role="tablist"
          aria-label="Niveles del horno"
          className="inline-flex flex-wrap items-center gap-2"
        >
          {sortedLevels.map((level) => {
            const isActive = level.level_index === currentActive;
            const pieceCount = placements.filter((p) => p.level_index === level.level_index).length;
            const levelName = level.name || `Nivel ${level.level_index + 1}`;

            return (
              <button
                key={level.level_index}
                type="button"
                role="tab"
                id={`kiln-level-tab-${level.level_index}`}
                aria-controls="kiln-level-panel"
                aria-selected={isActive}
                onClick={() => onSelectLevel(level.level_index)}
                className={`inline-flex min-h-[32px] items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? "border-zinc-900 bg-zinc-900 text-white shadow-xs"
                    : "border-zinc-200 bg-white/80 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                <span>{levelName}</span>
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
            );
          })}
        </div>
      </div>

      {!isReadOnly && (onEditLevel || onDeleteLevel) && (
        <div
          role="group"
          aria-label="Acciones del nivel seleccionado"
          className="flex items-center gap-1.5"
        >
          {onEditLevel && (
            <button
              type="button"
              onClick={() => onEditLevel(activeLevel)}
              aria-label={`Editar nivel ${activeLevelName}`}
              title={`Editar nivel ${activeLevelName}`}
              className="inline-flex h-8 w-8 min-h-[32px] min-w-[32px] items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 shadow-2xs transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <svg
                className="size-3.5"
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

          {onDeleteLevel && (
            <button
              type="button"
              onClick={() => {
                if (activeLevelPieceCount > 0) {
                  alert(
                    "No se puede eliminar un nivel que contiene piezas colocadas. Mueva o retire las piezas primero.",
                  );
                  return;
                }
                onDeleteLevel(activeLevel.level_index);
              }}
              disabled={activeLevelPieceCount > 0}
              aria-label={`Eliminar nivel ${activeLevelName}`}
              title={
                activeLevelPieceCount > 0
                  ? "Nivel con piezas no eliminable"
                  : `Eliminar nivel ${activeLevelName}`
              }
              className={`inline-flex h-8 w-8 min-h-[32px] min-w-[32px] items-center justify-center rounded-lg border border-zinc-200 bg-white shadow-2xs transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 ${
                activeLevelPieceCount > 0
                  ? "cursor-not-allowed text-zinc-300 opacity-40"
                  : "text-red-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
              }`}
            >
              <svg
                className="size-3.5"
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
      )}
    </div>
  );
}
