/**
 * Simulador de batch.
 *
 * Todo el cálculo lo hace el servidor en `/recipes/calculate`: aquí no se
 * multiplica ni se redondea nada. Los importes viajan como texto decimal para
 * no perder precisión al pasar por JavaScript, y simular no toca el inventario.
 */

import { useEffect, useMemo, useState } from "react";

import { TextField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { SearchInput } from "@/features/masters/MasterTable";
import { describeError } from "@/features/settings/messages";
import { formatDecimal } from "@/features/recipes/formatDecimal";
import { ComponentBadge, Metric } from "@/features/recipes/RecipeBadges";
import { useRecipeCalc, useRecipes } from "@/features/recipes/useRecipes";
import type { RecipeOut } from "@/types/recipes";

const SEARCH_DEBOUNCE_MS = 300;

interface RecipeSimulatorTabProps {
  /** Receta preseleccionada al llegar desde el detalle. */
  initialRecipe?: RecipeOut | null;
  /** Versión específica a simular (si se seleccionó una versión concreta). */
  initialVersionId?: number | null;
}

export function RecipeSimulatorTab({
  initialRecipe = null,
  initialVersionId = null,
}: RecipeSimulatorTabProps) {
  const [selected, setSelected] = useState<RecipeOut | null>(initialRecipe);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(
    initialVersionId ?? initialRecipe?.current_version_id ?? null,
  );
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [target, setTarget] = useState("1000");

  useEffect(() => {
    setSelected(initialRecipe);
    setSelectedVersionId(initialVersionId ?? initialRecipe?.current_version_id ?? null);
  }, [initialRecipe, initialVersionId]);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const results = useRecipes({
    ...(debounced.trim() ? { search: debounced.trim() } : {}),
    active: true as const,
    limit: 8,
    offset: 0,
  });

  const versionId = selectedVersionId ?? selected?.current_version_id ?? null;
  // Solo se pide el cálculo con una cantidad positiva: enviar vacío o cero
  // provocaría un 422 en cada pulsación de tecla.
  const cantidad = target.trim();
  const valida = /^\d+(\.\d+)?$/.test(cantidad) && !/^0+(\.0+)?$/.test(cantidad);

  const payload = useMemo(
    () =>
      versionId && valida
        ? { recipe_version_id: versionId, target_base_quantity: cantidad, target_uom: "g" as const }
        : null,
    [versionId, valida, cantidad],
  );
  const calc = useRecipeCalc(payload);

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      {/* Selección */}
      <section className="xl:col-span-4 space-y-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar receta…"
          label="Buscar receta a simular"
        />

        <div className="rounded-2xl border border-zinc-200 bg-white/70">
          {results.isPending ? (
            <div className="flex justify-center py-8">
              <Spinner className="size-4" label="Buscando…" />
            </div>
          ) : results.data?.items.length ? (
            <ul className="divide-y divide-zinc-100">
              {results.data.items.map((recipe) => {
                const active = recipe.id === selected?.id;
                return (
                  <li key={recipe.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(recipe)}
                      aria-pressed={active}
                      className={[
                        "flex w-full items-center justify-between gap-2 border-l-[3px] px-3 py-2 text-left text-xs transition-colors",
                        active
                          ? "border-l-zinc-900 bg-zinc-50"
                          : "border-l-transparent hover:bg-zinc-50/60",
                      ].join(" ")}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-zinc-900">
                          {recipe.name}
                        </span>
                        <span className="font-mono text-[10px] text-zinc-400">
                          {recipe.product_internal_reference}
                        </span>
                      </span>
                      {recipe.current_version ? (
                        <span className="shrink-0 tabular-nums text-[10px] text-zinc-500">
                          ×{formatDecimal(recipe.current_version.yield_factor, 4)}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-8 text-center text-xs text-zinc-500">Sin coincidencias.</p>
          )}
        </div>

        <TextField
          label="Base objetivo (g)"
          value={target}
          onChange={setTarget}
          inputMode="decimal"
          error={cantidad && !valida ? "Introduzca una cantidad mayor que cero." : undefined}
          hint="El servidor aplica el factor de rendimiento sobre esta base."
        />
      </section>

      {/* Resultado */}
      <section className="xl:col-span-8">
        {!selected ? (
          <p className="py-16 text-center text-sm text-zinc-500">
            Seleccione una receta para simular un batch.
          </p>
        ) : !versionId ? (
          <p className="py-16 text-center text-sm text-zinc-500">
            «{selected.name}» no tiene una versión activa que simular.
          </p>
        ) : calc.isPending ? (
          <div className="flex justify-center py-16">
            <Spinner className="size-5" label="Calculando…" />
          </div>
        ) : calc.isError ? (
          <p role="alert" className="py-16 text-center text-sm text-red-600">
            {describeError(calc.error)}
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-zinc-900">{selected.name}</h2>
                {selected.versions && selected.versions.length > 1 ? (
                  <div className="flex flex-wrap items-center gap-1 rounded-lg bg-zinc-100 p-1">
                    {selected.versions.map((v) => {
                      const isVerSelected = v.id === versionId;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSelectedVersionId(v.id)}
                          className={[
                            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                            isVerSelected
                              ? "bg-white font-semibold text-zinc-900 shadow-xs"
                              : "text-zinc-500 hover:text-zinc-900",
                          ].join(" ")}
                        >
                          V{v.version_number} ({v.status === "ACTIVE" ? "Activa" : v.status === "DRAFT" ? "Borrador" : "Archivada"})
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Versión simulada · rendimiento ×{formatDecimal(calc.data.yield_factor, 4)}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Metric
                label="Base objetivo"
                value={`${formatDecimal(calc.data.target_base_quantity, 2)} ${calc.data.target_uom}`}
              />
              <Metric
                label="Salida real"
                value={`${formatDecimal(calc.data.real_output_quantity, 2)} ${calc.data.target_uom}`}
                tone="base"
              />
              <Metric
                label="Costo total"
                value={formatDecimal(calc.data.total_material_cost, 4)}
              />
            </div>

            <div className="overflow-x-auto rounded-2xl border border-zinc-200">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Tipo</th>
                    <th className="px-3 py-2 font-semibold">Componente</th>
                    <th className="px-3 py-2 text-right font-semibold">%</th>
                    <th className="px-3 py-2 text-right font-semibold">Cantidad</th>
                    <th className="px-3 py-2 text-right font-semibold">Costo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {calc.data.components.map((line) => (
                    <tr key={line.component_product_id} className="hover:bg-zinc-50/60">
                      <td className="px-3 py-2">
                        <ComponentBadge type={line.component_type} />
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-medium text-zinc-900">{line.component_name}</span>
                        <span className="ml-2 font-mono text-[10px] text-zinc-400">
                          {line.component_internal_reference}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                        {formatDecimal(line.percentage, 2)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-900">
                        {formatDecimal(line.required_quantity, 2)} {line.uom}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                        {formatDecimal(line.component_cost, 4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-right text-sm text-zinc-600">
              Costo por unidad real:{" "}
              <strong className="tabular-nums text-zinc-900">
                {formatDecimal(calc.data.cost_per_real_unit, 6)}
              </strong>
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
