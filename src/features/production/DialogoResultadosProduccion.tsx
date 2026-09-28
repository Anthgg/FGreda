import { useId, useState, type FormEvent } from "react";

import { PrimaryButton, SecondaryButton } from "@/components/form";
import { useDialogoAccesible } from "@/features/cotizadorV2/useDialogoAccesible";
import { esDecimalValido, esPositivo, normalizar, sumar } from "@/features/production/decimales";
import type { ProductionResultLineIn } from "@/types/production";

export interface ProductionResultLineDraft {
  line_ref: string;
  product_name: string;
  started_quantity: string;
}

interface ResultDraft {
  good: string;
  scrap: string;
  reason: string;
}

interface Props {
  lines: readonly ProductionResultLineDraft[];
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (results: ProductionResultLineIn[]) => void;
}

const esCantidadValida = (value: string) =>
  esDecimalValido(value) && (value.split(".")[1]?.length ?? 0) <= 6;

export function DialogoResultadosProduccion({ lines, pending, error, onClose, onSubmit }: Props) {
  const titleId = useId();
  const dialogRef = useDialogoAccesible<HTMLDivElement>(true);
  const [drafts, setDrafts] = useState<Record<string, ResultDraft>>(() =>
    Object.fromEntries(lines.map((line) => [line.line_ref, { good: "", scrap: "", reason: "" }])),
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const results: ProductionResultLineIn[] = [];

    for (const line of lines) {
      const draft = drafts[line.line_ref];
      if (!draft || !esCantidadValida(line.started_quantity) || !esCantidadValida(draft.good) || !esCantidadValida(draft.scrap)) {
        setValidationError(`Completa buenas y merma con cantidades válidas para «${line.product_name}».`);
        return;
      }
      if (normalizar(sumar([draft.good, draft.scrap])) !== normalizar(line.started_quantity)) {
        setValidationError(`Buenas + merma deben ser iguales a las ${normalizar(line.started_quantity)} unidades iniciadas de «${line.product_name}».`);
        return;
      }
      if (esPositivo(draft.scrap) && !draft.reason.trim()) {
        setValidationError(`Indica el motivo de merma de «${line.product_name}».`);
        return;
      }
      if (draft.reason.trim().length > 240) {
        setValidationError("El motivo de merma admite hasta 240 caracteres.");
        return;
      }

      results.push({
        line_ref: line.line_ref,
        good_quantity: draft.good.trim(),
        scrap_quantity: draft.scrap.trim(),
        scrap_reason: esPositivo(draft.scrap) ? draft.reason.trim() : null,
      });
    }

    setValidationError(null);
    onSubmit(results);
  };

  const setDraft = (lineRef: string, key: keyof ResultDraft, value: string) => {
    setDrafts((current) => ({
      ...current,
      [lineRef]: { ...current[lineRef]!, [key]: value },
    }));
    setValidationError(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 sm:items-center sm:p-4"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !pending) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
      >
        <h2 id={titleId} className="text-base font-bold text-zinc-950">Registrar resultados de producción</h2>
        <p className="mt-1 text-xs text-zinc-600">Registra explícitamente las cantidades buenas y de merma para cada línea iniciada.</p>

        <form className="mt-4 space-y-4" onSubmit={submit}>
          {lines.map((line, index) => {
            const draft = drafts[line.line_ref]!;
            const goodId = `${titleId}-good-${index}`;
            const scrapId = `${titleId}-scrap-${index}`;
            const reasonId = `${titleId}-reason-${index}`;
            return (
              <fieldset key={line.line_ref} className="rounded-xl border border-zinc-200 p-3 sm:p-4">
                <legend className="max-w-full px-1 text-sm font-semibold text-zinc-900">{line.product_name}</legend>
                <p className="mb-3 text-xs text-zinc-600">Cantidad iniciada: <strong className="tabular-nums">{normalizar(line.started_quantity)}</strong></p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor={goodId} className="mb-1 block text-xs font-medium text-zinc-700">Buenas</label>
                    <input id={goodId} required type="text" inputMode="decimal" autoComplete="off" value={draft.good} disabled={pending} onChange={(event) => setDraft(line.line_ref, "good", event.target.value)} className="min-h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-800" />
                  </div>
                  <div>
                    <label htmlFor={scrapId} className="mb-1 block text-xs font-medium text-zinc-700">Merma</label>
                    <input id={scrapId} required type="text" inputMode="decimal" autoComplete="off" value={draft.scrap} disabled={pending} onChange={(event) => setDraft(line.line_ref, "scrap", event.target.value)} className="min-h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-800" />
                  </div>
                  {esPositivo(draft.scrap) ? (
                    <div className="sm:col-span-2">
                      <label htmlFor={reasonId} className="mb-1 block text-xs font-medium text-zinc-700">Motivo de merma</label>
                      <input id={reasonId} required type="text" maxLength={240} value={draft.reason} disabled={pending} onChange={(event) => setDraft(line.line_ref, "reason", event.target.value)} className="min-h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-800" />
                    </div>
                  ) : null}
                </div>
              </fieldset>
            );
          })}

          {validationError ? <p role="alert" className="text-xs text-red-700">{validationError}</p> : null}
          {error ? <p role="alert" className="text-xs text-red-700">{error}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <SecondaryButton type="button" disabled={pending} onClick={onClose}>Cancelar</SecondaryButton>
            <PrimaryButton type="submit" disabled={pending || lines.length === 0}>{pending ? "Registrando…" : "Completar producción"}</PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}
