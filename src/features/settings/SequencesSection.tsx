import { useState } from "react";
import type { FormEvent } from "react";

import { PrimaryButton, SecondaryButton, SelectField, TextField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { describeError, isConflict } from "@/features/settings/messages";
import { useSequences, useUpdateSequence } from "@/features/settings/useSettings";
import type { ResetPolicy, SequenceConfig, SequenceConfigInput } from "@/types/settings";

const TITULOS: Record<string, string> = {
  QUOTE: "Cotizaciones",
  FIRING: "Quemas",
};

const POLITICAS: readonly { value: ResetPolicy; label: string }[] = [
  { value: "YEARLY", label: "Cada ano" },
  { value: "MONTHLY", label: "Cada mes" },
  { value: "DAILY", label: "Cada dia" },
  { value: "NEVER", label: "Nunca" },
];

function toInput(sequence: SequenceConfig): SequenceConfigInput {
  return {
    prefix: sequence.prefix,
    pattern: sequence.pattern,
    padding: sequence.padding,
    reset_policy: sequence.reset_policy,
    active: sequence.active,
    version: sequence.version,
  };
}

/**
 * Calcula el ejemplo mostrado mientras se edita.
 *
 * Es puramente visual y no llama a ningun endpoint: el correlativo oficial lo
 * asigna el backend al crear un documento.
 */
function previewOf(draft: SequenceConfigInput, sequence: SequenceConfig): string {
  const hoy = new Date();
  const siguiente = sequence.current_value + 1;
  return draft.pattern
    .replaceAll("{PREFIX}", draft.prefix)
    .replaceAll("{YYYY}", String(hoy.getFullYear()))
    .replaceAll("{YY}", String(hoy.getFullYear() % 100).padStart(2, "0"))
    .replaceAll("{MM}", String(hoy.getMonth() + 1).padStart(2, "0"))
    .replaceAll("{DD}", String(hoy.getDate()).padStart(2, "0"))
    .replaceAll("{NUMBER}", String(siguiente).padStart(draft.padding, "0"));
}

function validate(draft: SequenceConfigInput): Partial<Record<string, string>> {
  const errors: Partial<Record<string, string>> = {};
  // Se comprueba la presencia antes que el contenido: una respuesta
  // inesperada del servidor debe mostrar un error, no dejar la pantalla en
  // blanco.
  if (!/^[A-Za-z0-9]{1,10}$/.test(draft.prefix ?? "")) {
    errors.prefix = "Entre 1 y 10 letras o digitos, sin separadores.";
  }
  if (!(draft.pattern ?? "").includes("{NUMBER}")) {
    errors.pattern = "El formato debe incluir {NUMBER}.";
  }
  if (draft.padding < 1 || draft.padding > 12) {
    errors.padding = "Entre 1 y 12 digitos.";
  }
  return errors;
}

function SequenceCard({ sequence, canEdit }: { sequence: SequenceConfig; canEdit: boolean }) {
  const update = useUpdateSequence();
  const [draft, setDraft] = useState<SequenceConfigInput>(() => toInput(sequence));

  const errors = validate(draft);
  const hasErrors = Object.keys(errors).length > 0;
  const isDirty = JSON.stringify(draft) !== JSON.stringify(toInput(sequence));

  const set = <K extends keyof SequenceConfigInput>(field: K, value: SequenceConfigInput[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isDirty || hasErrors || update.isPending) return;
    update.mutate(
      { sequenceType: sequence.sequence_type, payload: { ...draft, version: sequence.version } },
      { onSuccess: (data) => setDraft(toInput(data)) },
    );
  };

  const disabled = !canEdit || update.isPending;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="border-t border-zinc-200 pt-4 first:border-t-0 first:pt-0 dark:border-zinc-800"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {TITULOS[sequence.sequence_type] ?? sequence.sequence_type}
        </h3>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {sequence.current_value === 0
            ? "Sin documentos emitidos"
            : `Ultimo emitido: ${sequence.current_value}`}
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextField
          label="Prefijo"
          value={draft.prefix}
          onChange={(value) => set("prefix", value.toUpperCase())}
          disabled={disabled}
          maxLength={10}
          error={errors.prefix}
        />
        <TextField
          label="Formato"
          value={draft.pattern}
          onChange={(value) => set("pattern", value)}
          disabled={disabled}
          error={errors.pattern}
          className="lg:col-span-2"
        />
        <TextField
          label="Digitos"
          value={String(draft.padding)}
          onChange={(value) => set("padding", Number(value) || 0)}
          disabled={disabled}
          inputMode="numeric"
          error={errors.padding}
        />
        <SelectField
          label="Reinicio del contador"
          value={draft.reset_policy}
          options={POLITICAS}
          onChange={(value) => set("reset_policy", value)}
          disabled={disabled}
        />
        <div className="flex items-end pb-1.5">
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) => set("active", event.target.checked)}
              disabled={disabled}
              className="size-3.5 rounded border-zinc-300 text-clay-700 focus:ring-clay-600 dark:border-zinc-700"
            />
            Activa
          </label>
        </div>
      </div>

      <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Vista previa
        </p>
        <p className="mt-0.5 font-mono text-sm text-zinc-900 dark:text-zinc-100">
          {hasErrors ? "—" : previewOf(draft, sequence)}
        </p>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          Solo un ejemplo del formato. No reserva ni consume ningun numero: el correlativo oficial
          lo asigna el servidor al crear el documento.
        </p>
      </div>

      <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
        Marcadores admitidos: <code>{"{PREFIX}"}</code> <code>{"{YYYY}"}</code>{" "}
        <code>{"{YY}"}</code> <code>{"{MM}"}</code> <code>{"{DD}"}</code>{" "}
        <code>{"{NUMBER}"}</code>. Los cambios afectan solo a los documentos futuros.
      </p>

      {update.error ? (
        <p
          role="alert"
          className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {describeError(update.error)}
          {isConflict(update.error) ? " Recargue la pagina para ver la version vigente." : ""}
        </p>
      ) : null}

      {canEdit ? (
        <div className="mt-3 flex items-center gap-2">
          <PrimaryButton disabled={!isDirty || hasErrors || update.isPending}>
            {update.isPending ? <Spinner className="size-3.5" label="Guardando..." /> : "Guardar"}
          </PrimaryButton>
          <SecondaryButton
            disabled={!isDirty || update.isPending}
            onClick={() => setDraft(toInput(sequence))}
          >
            Cancelar
          </SecondaryButton>
          {isDirty ? (
            <span className="text-xs text-amber-700 dark:text-amber-500">Cambios sin guardar</span>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

export function SequencesSection({ canEdit }: { canEdit: boolean }) {
  const query = useSequences();

  if (!query.data) return null;

  return (
    <div className="space-y-5">
      {query.data.map((sequence) => (
        <SequenceCard key={sequence.sequence_type} sequence={sequence} canEdit={canEdit} />
      ))}
      {!canEdit ? (
        <p className="border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Solo un administrador puede modificar la numeracion.
        </p>
      ) : null}
    </div>
  );
}
