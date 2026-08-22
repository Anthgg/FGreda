import { useState } from "react";
import type { FormEvent } from "react";

import { PrimaryButton, SecondaryButton, SelectField, TextField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { describeError, isConflict } from "@/features/settings/messages";
import {
  useCreateSequencePattern,
  useReferenceData,
  useSequences,
  useUpdateSequence,
} from "@/features/settings/useSettings";
import type {
  ResetPolicy,
  SequenceConfig,
  SequenceConfigInput,
  SequencePatternPreset,
} from "@/types/settings";

const TITULOS: Record<string, string> = {
  QUOTE: "Cotizaciones",
  FIRING: "Quemas",
};

const POLITICAS: readonly { value: ResetPolicy; label: string }[] = [
  { value: "YEARLY", label: "Cada año" },
  { value: "MONTHLY", label: "Cada mes" },
  { value: "DAILY", label: "Cada día" },
  { value: "NEVER", label: "Nunca" },
];

const CUSTOM_PATTERN = "__create_pattern__";
const CURRENT_PATTERN = "__current_pattern__";

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

/** La vista previa local nunca reserva ni consume un correlativo. */
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
  if (!/^[A-Za-z0-9]{1,10}$/.test(draft.prefix ?? "")) {
    errors.prefix = "Entre 1 y 10 letras o dígitos, sin separadores.";
  }
  if (!(draft.pattern ?? "").includes("{NUMBER}")) {
    errors.pattern = "El formato debe incluir {NUMBER}.";
  }
  if (draft.padding < 1 || draft.padding > 12) {
    errors.padding = "Entre 1 y 12 dígitos.";
  }
  return errors;
}

function SequenceCard({
  sequence,
  canEdit,
  patterns,
}: {
  sequence: SequenceConfig;
  canEdit: boolean;
  patterns: SequencePatternPreset[];
}) {
  const update = useUpdateSequence();
  const createPattern = useCreateSequencePattern();
  const [draft, setDraft] = useState<SequenceConfigInput>(() => toInput(sequence));
  const [creatingPattern, setCreatingPattern] = useState(false);
  const [patternName, setPatternName] = useState("");
  const [newPattern, setNewPattern] = useState(sequence.pattern);

  const errors = validate(draft);
  const hasErrors = Object.keys(errors).length > 0;
  const isDirty = JSON.stringify(draft) !== JSON.stringify(toInput(sequence));
  const patternIsPreset = patterns.some((item) => item.pattern === draft.pattern);
  const selectedPattern = creatingPattern
    ? CUSTOM_PATTERN
    : patternIsPreset
      ? draft.pattern
      : CURRENT_PATTERN;
  const patternOptions = [
    ...patterns.map((item) => ({ value: item.pattern, label: `${item.name} — ${item.pattern}` })),
    ...(patternIsPreset
      ? []
      : [{ value: CURRENT_PATTERN, label: `Formato actual — ${draft.pattern}` }]),
    { value: CUSTOM_PATTERN, label: "Crear un nuevo formato..." },
  ];

  const set = <K extends keyof SequenceConfigInput>(field: K, value: SequenceConfigInput[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const selectPattern = (value: string) => {
    if (value === CUSTOM_PATTERN) {
      setCreatingPattern(true);
      setNewPattern(draft.pattern);
      return;
    }
    if (value === CURRENT_PATTERN) {
      setCreatingPattern(false);
      return;
    }
    setCreatingPattern(false);
    set("pattern", value);
  };

  const handleCreatePattern = () => {
    if (patternName.trim().length < 2 || !newPattern.includes("{NUMBER}")) return;
    createPattern.mutate(
      { name: patternName.trim(), pattern: newPattern },
      {
        onSuccess: (created) => {
          set("pattern", created.pattern);
          setPatternName("");
          setCreatingPattern(false);
        },
      },
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isDirty || hasErrors || update.isPending) return;
    update.mutate(
      { sequenceType: sequence.sequence_type, payload: { ...draft, version: sequence.version } },
      { onSuccess: (data) => setDraft(toInput(data)) },
    );
  };

  const reset = () => {
    setDraft(toInput(sequence));
    setCreatingPattern(false);
    setPatternName("");
    setNewPattern(sequence.pattern);
  };
  const disabled = !canEdit || update.isPending;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="border-t border-zinc-200/80 pt-6 first:border-t-0 first:pt-0"
    >
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-zinc-900">
          {TITULOS[sequence.sequence_type] ?? sequence.sequence_type}
        </h3>
        <span className="text-xs text-zinc-400">
          {sequence.current_value === 0
            ? "Sin documentos emitidos"
            : `Último emitido: ${sequence.current_value}`}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-12 items-start">
        <TextField
          label="Prefijo"
          requirement="required"
          value={draft.prefix}
          onChange={(value) => set("prefix", value.toUpperCase())}
          disabled={disabled}
          maxLength={10}
          error={errors.prefix}
          className="lg:col-span-2"
        />
        <SelectField
          label="Formato"
          requirement="required"
          value={selectedPattern}
          options={patternOptions}
          onChange={selectPattern}
          disabled={disabled}
          error={errors.pattern}
          className="lg:col-span-5"
        />
        <TextField
          label="Dígitos"
          requirement="required"
          value={String(draft.padding)}
          onChange={(value) => set("padding", Number(value) || 0)}
          disabled={disabled}
          inputMode="numeric"
          error={errors.padding}
          className="lg:col-span-2"
        />
        <SelectField
          label="Reinicio del contador"
          requirement="required"
          value={draft.reset_policy}
          options={POLITICAS}
          onChange={(value) => set("reset_policy", value)}
          disabled={disabled}
          className="lg:col-span-3"
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(event) => set("active", event.target.checked)}
            disabled={disabled}
            className="size-4 rounded-md border-zinc-300 text-zinc-900 focus:ring-zinc-900"
          />
          <span className="text-sm font-medium">Activa</span>
          <span className="text-xs text-orange-600 font-semibold">* Obligatorio</span>
        </label>
      </div>

      {creatingPattern ? (
        <div className="mt-4 grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2">
          <TextField
            label="Nombre del nuevo formato"
            requirement="required"
            value={patternName}
            onChange={setPatternName}
            disabled={disabled || createPattern.isPending}
            error={patternName.length > 0 && patternName.trim().length < 2 ? "Use al menos 2 caracteres." : undefined}
          />
          <TextField
            label="Patrón"
            requirement="required"
            value={newPattern}
            onChange={setNewPattern}
            disabled={disabled || createPattern.isPending}
            error={!newPattern.includes("{NUMBER}") ? "Debe incluir {NUMBER}." : undefined}
          />
          <div className="flex items-center gap-2 sm:col-span-2">
            <PrimaryButton
              type="button"
              disabled={
                patternName.trim().length < 2 ||
                !newPattern.includes("{NUMBER}") ||
                createPattern.isPending
              }
              onClick={handleCreatePattern}
            >
              {createPattern.isPending ? "Creando..." : "Crear y usar"}
            </PrimaryButton>
            <SecondaryButton disabled={createPattern.isPending} onClick={() => setCreatingPattern(false)}>
              Volver a formatos
            </SecondaryButton>
          </div>
          {createPattern.error ? (
            <p role="alert" className="text-sm text-red-700 sm:col-span-2">
              {describeError(createPattern.error)}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Banner Vista Previa */}
      <div className="mt-4 rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-4">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
          Vista Previa
        </span>
        <span className="font-mono text-sm font-semibold text-zinc-900 tracking-tight">
          {hasErrors ? "—" : previewOf(draft, sequence)}
        </span>
        <p className="mt-1 text-xs text-zinc-400">
          Marcadores admitidos: {"{PREFIX}"} {"{YYYY}"} {"{YY}"} {"{MM}"} {"{DD}"} {"{NUMBER}"}. Solo un ejemplo del formato: no reserva ni consume correlativos.
        </p>
      </div>

      {update.error ? (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {describeError(update.error)}
          {isConflict(update.error) ? " Recargue la página para ver la versión vigente." : ""}
        </p>
      ) : null}

      {canEdit ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <PrimaryButton disabled={!isDirty || hasErrors || update.isPending || creatingPattern}>
            {update.isPending ? <Spinner className="size-3.5" label="Guardando..." /> : "Guardar"}
          </PrimaryButton>
          <SecondaryButton disabled={!isDirty || update.isPending} onClick={reset}>
            Cancelar
          </SecondaryButton>
          {isDirty ? (
            <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
              Cambios sin guardar
            </span>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

export function SequencesSection({ canEdit }: { canEdit: boolean }) {
  const query = useSequences();
  const reference = useReferenceData();

  if (!query.data || !reference.data) return null;

  return (
    <div className="space-y-8">
      {query.data.map((sequence) => (
        <SequenceCard
          key={sequence.sequence_type}
          sequence={sequence}
          canEdit={canEdit}
          patterns={reference.data.sequence_patterns}
        />
      ))}
      {!canEdit ? (
        <p className="border-t border-zinc-200/80 pt-4 text-xs text-zinc-500">
          Solo un administrador puede modificar la numeración.
        </p>
      ) : null}
    </div>
  );
}
