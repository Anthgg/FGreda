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
 * Barra de acciones comun a todas las secciones editables.
 *
 * Concentra los estados que exige la fase: guardando, guardado, error,
 * formulario modificado y descarte de cambios.
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
      <p className="mt-5 border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        Solo un administrador puede modificar esta configuracion.
      </p>
    );
  }

  return (
    <div className="mt-5 border-t border-zinc-200 pt-3 dark:border-zinc-800">
      {error ? (
        <div
          role="alert"
          className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          <p>{describeError(error)}</p>
          {isConflict(error) ? (
            <button
              type="button"
              onClick={onReload}
              className="mt-1.5 text-xs font-medium underline underline-offset-2"
            >
              Recargar configuracion
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <PrimaryButton disabled={!isDirty || isSaving}>
          {isSaving ? <Spinner className="size-3.5" label="Guardando..." /> : "Guardar cambios"}
        </PrimaryButton>
        <SecondaryButton disabled={!isDirty || isSaving} onClick={onCancel}>
          Cancelar
        </SecondaryButton>

        {isDirty ? (
          <span className="text-xs text-amber-700 dark:text-amber-500">Cambios sin guardar</span>
        ) : isSuccess ? (
          <span className="text-xs text-emerald-700 dark:text-emerald-500">Cambios guardados</span>
        ) : null}
      </div>
    </div>
  );
}
