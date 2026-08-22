/**
 * Modal de simulacion de batch.
 *
 * El usuario ingresa la cantidad de base objetivo en gramos; el backend
 * calcula las cantidades reales, el rendimiento y el costo sin mutar inventario.
 * Utiliza formateo decimal basado en string sin conversiones IEEE-754.
 */

import { useState } from "react";

import { Field } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { describeError } from "@/features/settings/messages";
import { Badge } from "@/features/masters/MasterTable";
import { formatDecimal } from "@/features/recipes/formatDecimal";
import { useRecipeCalc, useRecipeVersion } from "@/features/recipes/useRecipes";

interface Props {
  versionId: number;
  onClose: () => void;
}

function componentTypeTone(t: string) {
  if (t === "COLORANT") return "warning" as const;
  if (t === "ADDITIVE") return "neutral" as const;
  return "positive" as const;
}

export function RecipeCalculatorModal({ versionId, onClose }: Props) {
  const [targetGrams, setTargetGrams] = useState("1000");

  const version = useRecipeVersion(versionId);
  const calc = useRecipeCalc(
    targetGrams.trim() !== ""
      ? { recipe_version_id: versionId, target_base_quantity: targetGrams.trim() }
      : null,
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16"
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

        <h2 className="mb-1 text-lg font-semibold text-zinc-900">Simulador de batch</h2>
        {version.data && (
          <p className="mb-4 text-xs text-zinc-500">
            Versión {version.data.version_number} — Factor rendimiento: ×
            {formatDecimal(version.data.yield_factor, 4)}
          </p>
        )}

        {/* Input */}
        <Field label="Base objetivo (gramos)" requirement="required">
          {(id) => (
            <input
              id={id}
              type="text"
              inputMode="decimal"
              value={targetGrams}
              onChange={(e) => setTargetGrams(e.target.value)}
              className="w-full h-10 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none font-mono"
            />
          )}
        </Field>

        {/* Resultados */}
        <div className="mt-5">
          {calc.isLoading && (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          )}

          {calc.isError && (
            <p className="text-sm text-red-600">{describeError(calc.error)}</p>
          )}

          {calc.data && (
            <>
              {/* Resumen */}
              <div className="mb-4 grid grid-cols-3 gap-3">
                <SummaryCard
                  label="Base objetivo"
                  value={`${formatDecimal(calc.data.target_base_quantity, 2)} g`}
                />
                <SummaryCard
                  label="Salida real"
                  value={`${formatDecimal(calc.data.real_output_quantity, 2)} g`}
                  highlight
                />
                <SummaryCard
                  label="Costo total"
                  value={calc.data.total_material_cost ? `S/ ${formatDecimal(calc.data.total_material_cost, 4)}` : "—"}
                />
              </div>

              {/* Desglose por componente */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr>
                      <th className="pb-1 pr-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Tipo</th>
                      <th className="pb-1 pr-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Componente</th>
                      <th className="pb-1 pr-3 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-500">%</th>
                      <th className="pb-1 pr-3 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Gramos</th>
                      <th className="pb-1 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calc.data.components.map((line, i) => (
                      <tr key={i} className="border-b border-zinc-100">
                        <td className="py-1 pr-3">
                          <Badge tone={componentTypeTone(line.component_type)}>
                            {line.component_type === "BASE"
                              ? "Base"
                              : line.component_type === "COLORANT"
                              ? "Colorante"
                              : "Aditivo"}
                          </Badge>
                        </td>
                        <td className="py-1 pr-3 text-zinc-800">{line.component_name}</td>
                        <td className="py-1 pr-3 text-right font-mono text-zinc-600">
                          {formatDecimal(line.percentage, 2)}%
                        </td>
                        <td className="py-1 pr-3 text-right font-mono text-zinc-700">
                          {formatDecimal(line.required_quantity, 2)} g
                        </td>
                        <td className="py-1 text-right font-mono text-zinc-700">
                          {line.component_cost ? `S/ ${formatDecimal(line.component_cost, 4)}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {calc.data.cost_per_real_unit && (
                <p className="mt-3 text-right text-xs text-zinc-500">
                  Costo por gramo: <span className="font-mono font-semibold text-zinc-800">S/ {formatDecimal(calc.data.cost_per_real_unit, 6)}</span>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 text-center ${
        highlight
          ? "border-emerald-200 bg-emerald-50"
          : "border-zinc-200 bg-zinc-50"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p
        className={`mt-1 text-base font-bold ${
          highlight ? "text-emerald-800" : "text-zinc-800"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
