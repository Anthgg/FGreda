import { Spinner } from "@/components/Spinner";

interface KilnLayoutToolbarProps {
  isReadOnly: boolean;
  isDirty: boolean;
  isSaving: boolean;
  isSuggesting: boolean;
  hasLevels: boolean;
  hasValidDimensions: boolean;
  onSuggest: () => void;
  onSave: () => void;
  onReload: () => void;
  onAddLevel: () => void;
}

export function KilnLayoutToolbar({
  isReadOnly,
  isDirty,
  isSaving,
  isSuggesting,
  hasLevels,
  hasValidDimensions,
  onSuggest,
  onSave,
  onReload,
  onAddLevel,
}: KilnLayoutToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white/70 p-3 shadow-xs">
      <div className="flex flex-wrap items-center gap-2">
        {!isReadOnly && (
          <>
            <button
              type="button"
              onClick={onSuggest}
              disabled={isSuggesting || isSaving || !hasLevels || !hasValidDimensions}
              className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 shadow-2xs hover:bg-purple-100 disabled:opacity-40"
            >
              {isSuggesting ? (
                <Spinner className="size-3.5" label="Calculando…" />
              ) : (
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
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              )}
              Sugerir acomodo
            </button>

            <button
              type="button"
              onClick={onAddLevel}
              disabled={isSaving || !hasValidDimensions}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 disabled:opacity-40"
            >
              <svg
                className="size-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Añadir nivel
            </button>
          </>
        )}

        <button
          type="button"
          onClick={onReload}
          disabled={isSaving || isSuggesting}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-2xs hover:bg-zinc-50 disabled:opacity-40"
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
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Recargar
        </button>
      </div>

      <div className="flex items-center gap-3">
        {isDirty && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 border border-amber-200">
            <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
            Cambios sin guardar
          </span>
        )}

        {!isReadOnly && (
          <button
            type="button"
            onClick={onSave}
            disabled={!isDirty || isSaving || isSuggesting || !hasValidDimensions}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 disabled:opacity-40"
          >
            {isSaving ? <Spinner className="size-3.5 text-white" label="Guardando…" /> : null}
            Guardar distribución
          </button>
        )}
      </div>
    </div>
  );
}
