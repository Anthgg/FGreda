/**
 * Detalle de una receta productiva.
 *
 * Sustituye al modal anterior por un panel lateral permanente: seleccionar una
 * receta en la lista muestra su composición sin abrir ni cerrar ventanas.
 *
 * Muestra únicamente información del catálogo productivo. Los términos del
 * importador —origen de clasificación, estado de revisión— pertenecen al
 * proceso de staging y viven en su propia pestaña.
 */

import { useMemo, useState } from "react";

import { PrimaryButton, SecondaryButton } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { describeError } from "@/features/settings/messages";
import { addDecimalStrings, formatDecimal } from "@/features/recipes/formatDecimal";
import { ComponentBadge, Metric, VersionStatusBadge } from "@/features/recipes/RecipeBadges";
import { useActivateVersion, useRecipe, useRecipeCalc } from "@/features/recipes/useRecipes";
import type { RecipeLine, RecipeOut, RecipeVersionOut } from "@/types/recipes";

type DetailTab = "estructura" | "versiones" | "costos";

const TABS: readonly { id: DetailTab; label: string }[] = [
  { id: "estructura", label: "Estructura" },
  { id: "versiones", label: "Versiones" },
  { id: "costos", label: "Costos" },
];

/**
 * Porcentaje acumulado de la base.
 *
 * Solo las líneas BASE acumulan hasta el 100 %: colorantes y aditivos se
 * calculan por encima de esa base y por eso no entran en la suma.
 * Opera estrictamente con strings decimales sin conversión IEEE-754.
 */
function cumulativeBase(lines: RecipeLine[]): Map<number, string> {
  const acumulado = new Map<number, string>();
  let total = "0";
  for (const line of lines) {
    if (line.component_type !== "BASE") continue;
    total = addDecimalStrings(total, line.percentage, 6);
    acumulado.set(line.id, formatDecimal(total, 2));
  }
  return acumulado;
}

function sortLines(lines: RecipeLine[]): RecipeLine[] {
  return [...lines].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

// ---------------------------------------------------------------------------
// Estructura
// ---------------------------------------------------------------------------
function StructureTab({ lines }: { lines: RecipeLine[] }) {
  const ordered = useMemo(() => sortLines(lines), [lines]);
  const acumulado = useMemo(() => cumulativeBase(ordered), [ordered]);

  if (!ordered.length) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        Esta versión todavía no tiene componentes.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-zinc-200">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-semibold">#</th>
              <th className="px-3 py-2 font-semibold">Componente</th>
              <th className="px-3 py-2 font-semibold">Tipo</th>
              <th className="px-3 py-2 text-right font-semibold">%</th>
              <th className="px-3 py-2 text-right font-semibold">Acumulado base</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {ordered.map((line, index) => (
              <tr key={line.id} className="hover:bg-zinc-50/70">
                <td className="px-3 py-2 text-zinc-400 tabular-nums">{index + 1}</td>
                <td className="px-3 py-2">
                  <span className="font-medium text-zinc-900">{line.component_name}</span>
                  <span className="ml-2 font-mono text-[10px] text-zinc-400">
                    {line.component_internal_reference}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <ComponentBadge type={line.component_type} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-zinc-900">
                  {formatDecimal(line.percentage, 2)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                  {acumulado.get(line.id) ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-400" />
          Base: acumula hasta el 100 %
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-violet-400" />
          Colorantes y aditivos: se añaden sobre la base
        </span>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Versiones
// ---------------------------------------------------------------------------
function VersionsTab({
  recipe,
  canEdit,
  onSimulateVersion,
}: {
  recipe: RecipeOut;
  canEdit: boolean;
  onSimulateVersion: (version: RecipeVersionOut) => void;
}) {
  const activate = useActivateVersion(recipe.id);
  const versions = useMemo(() => {
    if (recipe.versions && recipe.versions.length) {
      return [...recipe.versions].sort((a, b) => b.version_number - a.version_number);
    }
    return recipe.current_version ? [recipe.current_version] : [];
  }, [recipe.versions, recipe.current_version]);

  if (!versions.length) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        Esta receta todavía no tiene ninguna versión.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {versions.map((version) => (
        <div
          key={version.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-3.5 py-3 shadow-2xs transition-colors hover:border-zinc-300"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-sm font-semibold text-zinc-900">
              V{version.version_number}
            </span>
            <VersionStatusBadge status={version.status} />
            <span className="text-xs text-zinc-500">
              {new Date(version.created_at).toLocaleDateString()}
            </span>
            <span className="text-xs text-zinc-400">
              ({version.lines.length} {version.lines.length === 1 ? "componente" : "componentes"})
            </span>
            {version.notes ? (
              <span className="text-xs italic text-zinc-500">
                — {version.notes}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs tabular-nums text-zinc-500 mr-1">
              ×{formatDecimal(version.yield_factor, 4)}
            </span>
            <SecondaryButton onClick={() => onSimulateVersion(version)}>
              Simular
            </SecondaryButton>
            {canEdit && version.status !== "ACTIVE" ? (
              <SecondaryButton
                disabled={activate.isPending}
                onClick={() => activate.mutate(version.id)}
              >
                {activate.isPending ? "Activando…" : "Activar"}
              </SecondaryButton>
            ) : null}
          </div>
        </div>
      ))}

      {activate.isError ? (
        <p role="alert" className="text-xs text-red-600">
          {describeError(activate.error)}
        </p>
      ) : null}

      <p className="text-[11px] text-zinc-400 pt-1">
        {versions.length === 1
          ? "Mostrando la única versión registrada."
          : `Historial completo: ${versions.length} versiones registradas.`}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Costos
// ---------------------------------------------------------------------------
function CostsTab({ recipe }: { recipe: RecipeOut }) {
  const version = recipe.current_version;
  // Se pide el cálculo sobre una base de 1000 g: es la referencia habitual del
  // taller y permite leer el costo por gramo sin ambigüedad.
  const calc = useRecipeCalc(
    version ? { recipe_version_id: version.id, target_base_quantity: "1000" } : null,
  );

  if (!version) {
    return <p className="py-8 text-center text-sm text-zinc-500">Sin versión activa.</p>;
  }
  if (calc.isPending) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        <Spinner className="size-4" label="Calculando costos…" />
      </p>
    );
  }
  if (calc.isError) {
    return (
      <p role="alert" className="py-8 text-center text-sm text-red-600">
        {describeError(calc.error)}
      </p>
    );
  }

  const data = calc.data;
  return (
    <div className="space-y-4">
      <p className="text-[11px] text-zinc-400">
        Calculado por el servidor sobre una base de 1 000 g. No modifica inventario.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Costo base" value={formatDecimal(data.base_cost, 4)} tone="base" />
        <Metric
          label="Colorantes"
          value={formatDecimal(data.colorant_cost, 4)}
          tone="additional"
        />
        <Metric label="Aditivos" value={formatDecimal(data.additive_cost, 4)} />
        <Metric label="Costo total" value={formatDecimal(data.total_material_cost, 4)} />
      </div>
      <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 px-3 py-2.5 text-sm">
        <span className="text-zinc-500">Costo por unidad real: </span>
        <strong className="tabular-nums text-zinc-900">
          {formatDecimal(data.cost_per_real_unit, 6)}
        </strong>
        <span className="ml-2 text-xs text-zinc-400">
          salida real {formatDecimal(data.real_output_quantity, 2)} {data.target_uom}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------
interface RecipeDetailPanelProps {
  recipeId: number;
  canEdit: boolean;
  onNewVersion: () => void;
  onSimulate: (versionId?: number) => void;
  onBack?: (() => void) | undefined;
}

export function RecipeDetailPanel({
  recipeId,
  canEdit,
  onNewVersion,
  onSimulate,
  onBack,
}: RecipeDetailPanelProps) {
  const [tab, setTab] = useState<DetailTab>("estructura");
  const query = useRecipe(recipeId);

  if (query.isPending) {
    return (
      <div className="flex h-full items-center justify-center py-16">
        <Spinner className="size-5" label="Cargando receta…" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <p role="alert" className="py-16 text-center text-sm text-red-600">
        {describeError(query.error)}
      </p>
    );
  }

  const recipe = query.data;
  const version = recipe.current_version;

  return (
    <div className="flex h-full flex-col">
      {/* Cabecera */}
      <header className="border-b border-zinc-200 pb-4">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 xl:hidden"
          >
            ← Volver al listado
          </button>
        ) : null}

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-zinc-900">{recipe.name}</h2>
              {version ? <VersionStatusBadge status={version.status} /> : null}
            </div>
            <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
              <div>
                <dt className="inline text-zinc-400">Referencia: </dt>
                <dd className="inline font-mono text-zinc-700">
                  {recipe.product_internal_reference}
                </dd>
              </div>
              <div>
                <dt className="inline text-zinc-400">Producto: </dt>
                <dd className="inline text-zinc-700">{recipe.product_name}</dd>
              </div>
              {version ? (
                <div>
                  <dt className="inline text-zinc-400">Versión: </dt>
                  <dd className="inline text-zinc-700">V{version.version_number}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          <div className="flex shrink-0 gap-2">
            <SecondaryButton onClick={() => onSimulate(version?.id)} disabled={!version}>
              Simular
            </SecondaryButton>
            {canEdit ? <PrimaryButton onClick={onNewVersion}>Nueva versión</PrimaryButton> : null}
          </div>
        </div>
      </header>

      {/* Métricas */}
      {version ? (
        <div className="grid grid-cols-2 gap-3 py-4 sm:grid-cols-4">
          <Metric label="Base" value={`${formatDecimal(version.base_total, 2)} %`} tone="base" />
          <Metric
            label="Adicionales"
            value={`${formatDecimal(version.additional_total, 2)} %`}
            tone="additional"
          />
          <Metric
            label="Total fórmula"
            value={`${formatDecimal(
              addDecimalStrings(version.base_total, version.additional_total, 6),
              2,
            )} %`}
          />
          <Metric label="Rendimiento" value={`×${formatDecimal(version.yield_factor, 4)}`} />
        </div>
      ) : (
        <p className="py-6 text-sm text-zinc-500">
          Esta receta no tiene una versión activa. Cree una nueva versión para definir su fórmula.
        </p>
      )}

      {/* Sub-pestañas */}
      {version ? (
        <>
          <div className="border-b border-zinc-200">
            <nav role="tablist" aria-label="Detalle de la receta" className="-mb-px flex gap-5">
              {TABS.map((item) => {
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(item.id)}
                    className={[
                      "whitespace-nowrap border-b-2 pb-2 text-xs font-medium transition-colors",
                      active
                        ? "border-zinc-900 text-zinc-900"
                        : "border-transparent text-zinc-400 hover:text-zinc-700",
                    ].join(" ")}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pt-4">
            {tab === "estructura" ? <StructureTab lines={version.lines} /> : null}
            {tab === "versiones" ? (
              <VersionsTab
                recipe={recipe}
                canEdit={canEdit}
                onSimulateVersion={(v) => onSimulate(v.id)}
              />
            ) : null}
            {tab === "costos" ? <CostsTab recipe={recipe} /> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
