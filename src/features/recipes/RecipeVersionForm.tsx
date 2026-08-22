/**
 * Formulario para crear una nueva version de receta.
 *
 * Utiliza SelectField para todos los desplegables con soporte de teclado,
 * mini buscador y cero selects nativos.
 * No utiliza parseFloat/Number para porcentajes o calculos de negocio.
 */

import { useState } from "react";

import { Field, PrimaryButton, SecondaryButton, SelectField } from "@/components/form";
import { describeError } from "@/features/settings/messages";
import { useProducts } from "@/features/masters/useMasters";
import { formatDecimal, sumDecimalStrings } from "@/features/recipes/formatDecimal";
import type { RecipeComponentType, RecipeLineIn, RecipeVersionIn } from "@/types/recipes";

interface Props {
  recipeId: number;
  onClose: () => void;
  onSubmit: (payload: RecipeVersionIn, activate: boolean) => Promise<void>;
  isPending: boolean;
}

const COMPONENT_TYPE_OPTIONS = [
  { value: "BASE", label: "Base" },
  { value: "COLORANT", label: "Colorante" },
  { value: "ADDITIVE", label: "Aditivo" },
] as const;

interface DraftLine {
  component_product_id: string;
  component_type: RecipeComponentType;
  percentage: string;
}

function emptyLine(): DraftLine {
  return { component_product_id: "", component_type: "BASE", percentage: "" };
}

export function RecipeVersionForm({ onClose, onSubmit, isPending }: Props) {
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [notes, setNotes] = useState("");
  const [activateNow, setActivateNow] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Insumos y materias primas disponibles
  const products = useProducts({ limit: 300 });
  const rawProducts = products.data?.items ?? [];

  const productOptions = rawProducts.map((p) => ({
    value: String(p.id),
    label: `${p.internal_reference} · ${p.name}`,
  }));

  // Suma de componentes base calculada con strings (cero float)
  const basePercentages = lines
    .filter((l) => l.component_type === "BASE" && l.percentage.trim() !== "")
    .map((l) => l.percentage);
  const baseSum = sumDecimalStrings(basePercentages);
  const isBase100 = baseSum === "100" || baseSum === "100.0" || baseSum === "100.00" || baseSum === "100.0000";

  const handleAddLine = () => setLines((prev) => [...prev, emptyLine()]);

  const handleRemoveLine = (i: number) =>
    setLines((prev) => prev.filter((_, idx) => idx !== i));

  const handleLineChange = (i: number, field: keyof DraftLine, value: string) => {
    setLines((prev) =>
      prev.map((l, idx) =>
        idx === i ? { ...l, [field]: value } : l,
      ),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const validLines: RecipeLineIn[] = lines
      .filter((l) => l.component_product_id !== "" && l.percentage.trim() !== "")
      .map((l, i) => ({
        component_product_id: Number(l.component_product_id),
        component_type: l.component_type,
        percentage: l.percentage.trim(),
        sort_order: i,
      }));
    const trimmedNotes = notes.trim();
    const payload: RecipeVersionIn = {
      lines: validLines,
      ...(trimmedNotes ? { notes: trimmedNotes } : {}),
    };
    try {
      await onSubmit(payload, activateNow);
    } catch (err) {
      setSubmitError(describeError(err));
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-900 text-xl font-bold"
          aria-label="Cerrar"
        >
          ✕
        </button>

        <h2 className="mb-4 text-lg font-semibold text-zinc-900">Nueva versión de receta</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Indicador de suma de base */}
          <div
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              isBase100
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            Suma base: {formatDecimal(baseSum)}% {isBase100 ? "✓ (Exacto 100%)" : "≠ 100% (La suma debe ser 100%)"}
          </div>

          {/* Líneas de componentes */}
          <div className="space-y-3">
            {lines.map((line, i) => (
              <div key={i} className="flex flex-wrap gap-2 items-end rounded-xl border border-zinc-100 bg-zinc-50/50 p-3">
                {/* Tipo */}
                <div className="w-36">
                  <SelectField
                    label="Tipo"
                    value={line.component_type}
                    options={COMPONENT_TYPE_OPTIONS}
                    onChange={(val) => handleLineChange(i, "component_type", val)}
                    searchable={false}
                  />
                </div>

                {/* Producto */}
                <div className="flex-1 min-w-[200px]">
                  <SelectField
                    label="Componente"
                    requirement="required"
                    value={line.component_product_id}
                    options={productOptions}
                    onChange={(val) => handleLineChange(i, "component_product_id", val)}
                    searchable={true}
                    searchPlaceholder="Buscar componente..."
                    placeholder="Seleccionar..."
                  />
                </div>

                {/* Porcentaje */}
                <div className="w-24">
                  <Field label="%" requirement="required">
                    {(id) => (
                      <input
                        id={id}
                        type="text"
                        inputMode="decimal"
                        value={line.percentage}
                        onChange={(e) => handleLineChange(i, "percentage", e.target.value)}
                        className="w-full h-10 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-right font-mono"
                        placeholder="Ej: 50.00"
                        required
                      />
                    )}
                  </Field>
                </div>

                <div className="pb-1">
                  <button
                    type="button"
                    onClick={() => handleRemoveLine(i)}
                    className="rounded-lg p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50"
                    aria-label="Quitar línea"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddLine}
            className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 underline"
          >
            + Agregar componente
          </button>

          {/* Notas */}
          <Field label="Notas" requirement="optional">
            {(id) => (
              <textarea
                id={id}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm focus:border-zinc-900 focus:outline-none"
              />
            )}
          </Field>

          {/* Activar inmediatamente */}
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={activateNow}
              onChange={(e) => setActivateNow(e.target.checked)}
              className="rounded border-zinc-300"
            />
            Activar inmediatamente
          </label>

          {submitError && (
            <p className="text-sm text-red-600">{submitError}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <SecondaryButton onClick={onClose}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : "Guardar versión"}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}
