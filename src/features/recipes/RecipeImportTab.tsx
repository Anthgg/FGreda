/**
 * Pestaña del importador de recetas.
 *
 * Muestra las métricas reales del lote en preparación —nunca números fijos— y
 * abre el revisor existente para resolver fila a fila.
 *
 * Este es el único lugar donde aparece el vocabulario del staging. El catálogo
 * productivo no habla de lotes ni de revisiones.
 */

import { useState } from "react";

import { PrimaryButton } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { describeError } from "@/features/settings/messages";
import { formatDecimal } from "@/features/recipes/formatDecimal";
import { Metric } from "@/features/recipes/RecipeBadges";
import { humanize } from "@/features/recipes/labels";
import { RecipeImportModal } from "@/features/recipes/RecipeImportModal";
import { useLatestRecipeBatch, useRecipeImportPreview } from "@/features/recipes/useRecipes";

function EstadoLote({ status }: { status: "READY" | "REVIEW_REQUIRED" | "ERROR" }) {
  const tones = {
    READY: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    REVIEW_REQUIRED: "bg-amber-50 text-amber-700 ring-amber-200",
    ERROR: "bg-red-50 text-red-700 ring-red-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${tones[status]}`}
    >
      {humanize(status)}
    </span>
  );
}

export function RecipeImportTab({ canEdit }: { canEdit: boolean }) {
  const [reviewing, setReviewing] = useState(false);
  const batch = useLatestRecipeBatch();
  const preview = useRecipeImportPreview(batch.data?.batch_id ?? null);

  if (batch.isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-5" label="Buscando lote…" />
      </div>
    );
  }
  if (batch.isError) {
    return (
      <p role="alert" className="py-16 text-center text-sm text-red-600">
        {describeError(batch.error)}
      </p>
    );
  }
  if (!batch.data?.batch_id) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-zinc-600">No hay ningún lote de importación pendiente.</p>
        <p className="mt-1 text-xs text-zinc-400">
          Los lotes se generan al cargar el maestro de recetas desde el importador de datos.
        </p>
      </div>
    );
  }

  if (preview.isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-5" label="Analizando el lote…" />
      </div>
    );
  }
  if (preview.isError) {
    return (
      <p role="alert" className="py-16 text-center text-sm text-red-600">
        {describeError(preview.error)}
      </p>
    );
  }

  const data = preview.data;
  const adicionales = data.recipes.reduce(
    (total, group) => total + group.lines.filter((l) => l.component_type !== "BASE").length,
    0,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Lote #{data.batch_id}</h2>
          <p className="text-xs text-zinc-500">
            Datos en preparación. Nada llega al catálogo hasta confirmar el lote.
          </p>
        </div>
        {canEdit ? (
          <PrimaryButton onClick={() => setReviewing(true)}>Revisar y confirmar</PrimaryButton>
        ) : null}
      </div>

      {/* Métricas reales del lote */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Recetas detectadas" value={data.recipes_detected} />
        <Metric label="Listas" value={data.ready_count} tone="base" />
        <Metric label="Requieren revisión" value={data.review_required_count} tone="additional" />
        <Metric label="Con error" value={data.error_count} />
        <Metric label="Líneas" value={data.lines_detected} />
        <Metric label="Adicionales" value={adicionales} hint="Posteriores al 100 %" />
      </div>

      {/* Resumen por receta */}
      <div className="overflow-x-auto rounded-2xl border border-zinc-200">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Referencia</th>
              <th className="px-3 py-2 font-semibold">Receta</th>
              <th className="px-3 py-2 text-right font-semibold">Base</th>
              <th className="px-3 py-2 text-right font-semibold">Adicionales</th>
              <th className="px-3 py-2 text-right font-semibold">Rendim.</th>
              <th className="px-3 py-2 font-semibold">Estado</th>
              <th className="px-3 py-2 font-semibold">Avisos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {data.recipes.slice(0, 40).map((group) => (
              <tr key={group.target_product_id} className="hover:bg-zinc-50/60">
                <td className="px-3 py-2 font-mono text-[11px] text-zinc-500">
                  {group.target_internal_reference}
                </td>
                <td className="px-3 py-2 font-medium text-zinc-900">{group.recipe_name}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatDecimal(group.base_total, 2)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                  {formatDecimal(group.additional_total, 2)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                  ×{formatDecimal(group.yield_factor, 4)}
                </td>
                <td className="px-3 py-2">
                  <EstadoLote status={group.status} />
                </td>
                <td className="px-3 py-2 text-[11px] text-zinc-500">
                  {group.warnings.length ? `${group.warnings.length} aviso(s)` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.recipes.length > 40 ? (
        <p className="text-[11px] text-zinc-400">
          Se muestran las primeras 40 de {data.recipes.length}. El revisor permite recorrerlas todas.
        </p>
      ) : null}

      {reviewing && canEdit ? <RecipeImportModal onClose={() => setReviewing(false)} /> : null}
    </div>
  );
}
