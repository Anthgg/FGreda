import { PrimaryButton, SecondaryButton } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { describeError, isConflict } from "@/features/settings/messages";

interface SaveBarProps {
  canEdit: boolean;
  isDirty: boolean;
  isSaving: boolean;
  isSuccess: boolean;
  error: unknown;
  onCancel: () => void;
  onReload: () => void;
}

/**
 * Barra de acciones para secciones editables de Configuración.
 */
export function SaveBar({
  canEdit,
  isDirty,
  isSaving,
  isSuccess,
  error,
  onCancel,
  onReload,
}: SaveBarProps) {
  if (!canEdit) {
    return (
      <div className="mt-8 border-t border-black/[0.04] pt-4">
        <p className="text-xs text-zinc-500">
          Solo un administrador puede modificar esta configuración.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-10 border-t border-black/[0.04] pt-6">
      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-2xl border border-red-200/60 bg-red-50/80 p-4 text-xs text-red-700"
        >
          <p className="font-semibold">{describeError(error)}</p>
          {isConflict(error) ? (
            <button
              type="button"
              onClick={onReload}
              className="mt-2 text-xs font-semibold text-red-800 underline underline-offset-2 hover:text-red-900 cursor-pointer"
            >
              Recargar configuración vigente
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <PrimaryButton disabled={!isDirty || isSaving}>
            {isSaving ? <Spinner className="size-4" label="Guardando..." /> : "Guardar cambios"}
          </PrimaryButton>
          <SecondaryButton disabled={!isDirty || isSaving} onClick={onCancel}>
            Cancelar
          </SecondaryButton>
        </div>

        <div>
          {isDirty ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50/80 border border-amber-200/60 px-3 py-1.5 rounded-full animate-pulse shadow-2xs">
              <span className="size-1.5 rounded-full bg-amber-500" />
              Cambios sin guardar
            </span>
          ) : isSuccess ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50/80 border border-emerald-200/60 px-3 py-1.5 rounded-full shadow-2xs">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Cambios guardados
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
