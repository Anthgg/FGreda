/**
 * Plan de esmaltes de una línea del Cotizador (Fase 009D).
 *
 * El usuario elige **qué esmaltes** lleva la pieza y **con qué reparto**. Eso
 * es todo lo que este componente decide, y es lo único que viaja al backend.
 *
 * Cuatro cosas que NO hace, y son deliberadas:
 *
 * 1. **No conoce el porcentaje.** El 15 % vive en Configuración → Comercial.
 *    Escribirlo aquí haría que cambiarlo allí no cambiase nada.
 * 2. **No conoce el peso de la pieza.** Sale de `Product.grammage`, el mismo
 *    dato del maestro con el que se calcula todo lo demás de la pieza. Tenerlo
 *    en dos sitios lo haría divergir.
 * 3. **No convierte gramos a mililitros.** El factor depende de cuánta agua
 *    lleva el lote concreto: los mismos gramos son 18750 ml de un esmalte y
 *    37500 de otro más aguado. Ese número es del lote, no de la unidad.
 * 4. **No consume inventario.** Estimar es prever. El descuento real al vender
 *    pertenece a 009H.
 *
 * `share` es un **peso relativo, no un porcentaje**: 1 y 1 es mitad y mitad,
 * 2 y 1 son dos tercios y un tercio. El porcentaje resuelto lo devuelve el
 * backend en `allocation_percent`. Con varios esmaltes el total se REPARTE:
 * usar dos no gasta el doble, gasta lo mismo en dos baldes.
 *
 * Todo lo que se muestra bajo el formulario viene del backend y se recalcula al
 * guardar; en una cotización confirmada es el snapshot congelado.
 */

import { SelectField, TextField } from "@/components/form";
import type { GlazeDraft } from "@/features/cotizador/draft";
import { formatDecimal } from "@/features/recipes/formatDecimal";
import { usePreparations } from "@/features/recipes/useRecipes";
import type { GlazePlanOut, GlazeUnit } from "@/types/quotationBuilder";

const UNIT_OPTIONS = [
  { value: "g", label: "Gramos de sólidos (g)" },
  { value: "ml", label: "Mililitros de preparado (ml)" },
];

interface GlazeEstimatorProps {
  glazes: GlazeDraft[];
  glazeUnit: GlazeUnit;
  /** Plan ya resuelto por el backend para esta línea. */
  plan: GlazePlanOut | null;
  /** Avisos de la línea; los del esmalte se explican aquí. */
  warnings: string[];
  disabled: boolean;
  currencySymbol: string;
  onChange: (change: { glazes?: GlazeDraft[]; glazeUnit?: GlazeUnit }) => void;
}

export function GlazeEstimator({
  glazes,
  glazeUnit,
  plan,
  warnings,
  disabled,
  currencySymbol,
  onChange,
}: GlazeEstimatorProps) {
  const batches = usePreparations({ limit: 50, offset: 0 }, !disabled);

  const chosen = new Set(
    glazes.map((glaze) => glaze.preparationId).filter((value) => value !== ""),
  );
  const batchOptions = [
    { value: "", label: "Añadir esmalte preparado…" },
    ...(batches.data?.items ?? [])
      .filter((batch) => !chosen.has(String(batch.id)))
      .map((batch) => ({
        value: String(batch.id),
        label: `${batch.code} · ${batch.prepared_product_name}`,
      })),
  ];

  const labelFor = (glaze: GlazeDraft) => {
    const allocation = plan?.allocations.find(
      (entry) => String(entry.preparation_id) === glaze.preparationId,
    );
    if (allocation) {
      return `${allocation.preparation_code ?? ""} · ${allocation.prepared_product_name ?? ""}`;
    }
    const batch = batches.data?.items.find((item) => String(item.id) === glaze.preparationId);
    return batch ? `${batch.code} · ${batch.prepared_product_name}` : `#${glaze.preparationId}`;
  };

  const setShare = (preparationId: string, share: string) =>
    onChange({
      glazes: glazes.map((glaze) =>
        glaze.preparationId === preparationId ? { ...glaze, share } : glaze,
      ),
    });

  const remove = (preparationId: string) =>
    onChange({ glazes: glazes.filter((glaze) => glaze.preparationId !== preparationId) });

  const add = (preparationId: string) => {
    if (!preparationId) return;
    const batch = batches.data?.items.find((item) => String(item.id) === preparationId);
    onChange({
      glazes: [
        ...glazes,
        {
          preparationId,
          preparedProductId: batch ? String(batch.prepared_product_id) : "",
          share: "1",
        },
      ],
    });
  };

  const missingWeight = warnings.includes("GLAZE_PIECE_WEIGHT_REQUIRED");
  const missingBatch = warnings.includes("GLAZE_ML_REQUIRES_PREPARATION");

  return (
    <section
      aria-label="Plan de esmaltes"
      className="space-y-4 rounded-2xl border border-sky-100 bg-sky-50/50 p-4"
    >
      <div>
        <p className="text-xs font-semibold text-sky-950">Esmaltes de la pieza</p>
        <p className="text-[11px] text-sky-800">
          El porcentaje lo fija Configuración → Comercial y el peso de la pieza sale del maestro.
          Estimar no descuenta inventario.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Añadir esmalte"
          requirement="optional"
          value=""
          options={batchOptions}
          onChange={add}
          disabled={disabled || batches.isPending}
          hint="Varios esmaltes reparten el total; no lo multiplican."
        />
        <SelectField
          label="Expresar el plan en"
          requirement="optional"
          value={glazeUnit}
          options={UNIT_OPTIONS}
          onChange={(value) => onChange({ glazeUnit: value as GlazeUnit })}
          disabled={disabled}
          {...(missingBatch
            ? { error: "Elija un lote preparado: sin concentración no hay mililitros." }
            : {})}
        />
      </div>

      {glazes.length > 0 ? (
        <ul className="space-y-2">
          {glazes.map((glaze) => (
            <li
              key={glaze.preparationId}
              className="flex flex-wrap items-end gap-3 rounded-xl border border-sky-100 bg-white/70 px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-xs text-zinc-800">
                {labelFor(glaze)}
              </span>
              <div className="w-28">
                <TextField
                  label="Reparto"
                  value={glaze.share}
                  onChange={(share) => setShare(glaze.preparationId, share)}
                  disabled={disabled}
                  inputMode="decimal"
                  hint="Peso relativo"
                />
              </div>
              <button
                type="button"
                onClick={() => remove(glaze.preparationId)}
                disabled={disabled}
                className="pb-2 text-[11px] font-medium text-red-600 underline-offset-2 hover:underline disabled:opacity-50"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-sky-800">
          Sin esmaltes elegidos esta línea no lleva plan. Añada uno para ver cuánto hará falta.
        </p>
      )}

      {missingWeight ? (
        <p role="alert" className="text-xs text-red-600">
          El producto no tiene gramaje en el maestro: sin el peso de la pieza no se puede estimar
          el esmalte.
        </p>
      ) : null}

      {plan ? (
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-sky-100 bg-white/70 px-3 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                Porcentaje
              </dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">
                {formatDecimal(plan.estimated_glaze_percent_snapshot, 4)} %
              </dd>
            </div>
            <div className="rounded-xl border border-sky-100 bg-white/70 px-3 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                Por pieza
              </dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">
                {formatDecimal(plan.grams_per_piece, 4)} g
              </dd>
            </div>
            <div className="rounded-xl border border-sky-100 bg-white/70 px-3 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                Total del lote
              </dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">
                {formatDecimal(plan.total_estimated_solids_g, 4)} g
              </dd>
            </div>
          </dl>

          {plan.allocations.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-sky-100 bg-white/70">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-sky-50/80 text-[10px] uppercase tracking-wide text-sky-700">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Esmalte</th>
                    <th className="px-3 py-2 text-right font-semibold">Reparto</th>
                    <th className="px-3 py-2 text-right font-semibold">Gramos</th>
                    <th className="px-3 py-2 text-right font-semibold">g/ml</th>
                    <th className="px-3 py-2 text-right font-semibold">Mililitros</th>
                    <th className="px-3 py-2 text-right font-semibold">Costo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-50">
                  {plan.allocations.map((allocation) => (
                    <tr key={`${allocation.preparation_id}-${allocation.prepared_product_id}`}>
                      <td className="px-3 py-2">
                        <span className="font-mono text-[10px] text-zinc-500">
                          {allocation.preparation_code ?? "—"}
                        </span>
                        <span className="ml-2 text-zinc-800">
                          {allocation.prepared_product_name}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                        {formatDecimal(allocation.allocation_percent, 4)} %
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-900">
                        {formatDecimal(allocation.grams, 4)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                        {formatDecimal(allocation.solids_g_per_ml_snapshot, 6)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-900">
                        {formatDecimal(allocation.millilitres, 4)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                        {allocation.estimated_cost === null
                          ? "—"
                          : `${currencySymbol} ${formatDecimal(allocation.estimated_cost, 2)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <p className="text-[11px] text-sky-800">
            Gramos, mililitros, concentración y costo los calcula el backend. Al confirmar la
            cotización quedan congelados: cambiar después el porcentaje, la receta o el lote no
            los mueve.
          </p>
        </div>
      ) : null}
    </section>
  );
}
