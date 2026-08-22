/**
 * Formulario para crear una nueva version de receta.
 *
 * Permite agregar componentes (BASE / COLORANT / ADDITIVE) con sus porcentajes.
 * La validacion semantica (Base=100%) la ejecuta el backend; el frontend solo
 * muestra el marcador de suma actual como referencia visual.
 */

import { useState } from "react";

import { Field, PrimaryButton, SecondaryButton } from "@/components/form";
import { describeError } from "@/features/settings/messages";
import { useProducts } from "@/features/masters/useMasters";
import type { RecipeComponentType, RecipeLineIn, RecipeVersionIn } from "@/types/recipes";

interface Props {
  recipeId: number;
  onClose: () => void;
  onSubmit: (payload: RecipeVersionIn, activate: boolean) => Promise<void>;
  isPending: boolean;
}

const COMPONENT_TYPES: { value: RecipeComponentType; label: string }[] = [
  { value: "BASE", label: "Base" },
  { value: "COLORANT", label: "Colorante" },
  { value: "ADDITIVE", label: "Aditivo" },
];

interface DraftLine {
  component_product_id: number | "";
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

  // Productos disponibles como componentes
  const products = useProducts({ limit: 200 });
  const productOptions = products.data?.items ?? [];

  // Marcadores visuales
  const baseSum = lines
    .filter((l) => l.component_type === "BASE")
    .reduce((acc, l) => acc + (parseFloat(l.percentage) || 0), 0);

  const handleAddLine = () => setLines((prev) => [...prev, emptyLine()]);

  const handleRemoveLine = (i: number) =>
    setLines((prev) => prev.filter((_, idx) => idx !== i));

  const handleLineChange = (i: number, field: keyof DraftLine, value: string) => {
    setLines((prev) =>
      prev.map((l, idx) =>
        idx === i ? { ...l, [field]: field === "component_product_id" ? Number(value) : value } : l,
      ),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const validLines: RecipeLineIn[] = lines
      .filter((l) => l.component_product_id !== "" && l.percentage !== "")
      .map((l, i) => ({
        component_product_id: l.component_product_id as number,
        component_type: l.component_type,
        percentage: parseFloat(l.percentage),
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
      <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
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
              Math.abs(baseSum - 100) < 0.01
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            Suma base: {baseSum.toFixed(2)}% {Math.abs(baseSum - 100) < 0.01 ? "✓" : "≠ 100"}
          </div>

          {/* Líneas de componentes */}
          <div className="space-y-2">
            {lines.map((line, i) => (
              <div key={i} className="flex flex-wrap gap-2 items-end">
                {/* Tipo */}
                <div className="w-28">
                  <label className="mb-0.5 block text-[11px] font-medium text-zinc-600">Tipo</label>
                  <select
                    value={line.component_type}
                    onChange={(e) => handleLineChange(i, "component_type", e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900"
                  >
                    {COMPONENT_TYPES.map((ct) => (
                      <option key={ct.value} value={ct.value}>
                        {ct.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Producto */}
                <div className="flex-1 min-w-40">
                  <label className="mb-0.5 block text-[11px] font-medium text-zinc-600">
                    Componente
                  </label>
                  <select
                    value={line.component_product_id}
                    onChange={(e) => handleLineChange(i, "component_product_id", e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900"
                    required
                  >
                    <option value="">— Seleccionar —</option>
                    {productOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.internal_reference} · {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Porcentaje */}
                <div className="w-20">
                  <label className="mb-0.5 block text-[11px] font-medium text-zinc-600">%</label>
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    step="0.01"
                    value={line.percentage}
                    onChange={(e) => handleLineChange(i, "percentage", e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm"
                    required
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveLine(i)}
                  className="mb-0.5 text-zinc-400 hover:text-red-500 text-lg font-bold"
                  aria-label="Quitar línea"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddLine}
            className="text-xs text-zinc-500 hover:text-zinc-900 underline"
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
            <p className="text-sm text-red-600">{describeError(submitError)}</p>
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
