/**
 * Estimador de esmalte del Cotizador (Fase 009D).
 *
 * Responde a una pregunta concreta: si la pieza pesa 500 g y se hacen 20,
 * ¿cuánto esmalte hace falta? La respuesta la da el backend
 * (`/recipe-preparations/glaze-estimate`) y aquí no se multiplica nada.
 *
 * Tres cosas que este componente NO hace, y son deliberadas:
 *
 * 1. **No conoce el porcentaje.** El 15 % vive en la configuración comercial.
 *    Escribirlo aquí haría que cambiarlo en Configuración no cambiase nada.
 * 2. **No convierte gramos a mililitros.** El factor depende de cuánta agua
 *    lleva el lote concreto: 1500 g son 7500 ml de un esmalte y 15000 de otro
 *    más aguado. Ese número es del lote, no de la unidad.
 * 3. **No consume inventario.** Estimar es prever. El descuento real al vender
 *    es otra fase.
 *
 * Con varios esmaltes el total se REPARTE. Usar dos no gasta el doble: gasta
 * lo mismo, en dos baldes.
 *
 * Lo estimado no se guarda en la cotización: el estimador rellena «gramos de
 * receta por pieza», que es el campo que la cotización sí persiste.
 */

import { useMemo, useState } from "react";

import { SecondaryButton, SelectField, TextField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { formatDecimal } from "@/features/recipes/formatDecimal";
import { usePreparations, useGlazeEstimate } from "@/features/recipes/useRecipes";
import { describeError } from "@/features/settings/messages";
import type { GlazeSelectionIn } from "@/types/recipes";

const POSITIVE_DECIMAL = /^\d+(\.\d+)?$/;
const POSITIVE_INT = /^[1-9]\d*$/;

function isPositiveDecimal(value: string): boolean {
  const trimmed = value.trim();
  return POSITIVE_DECIMAL.test(trimmed) && !/^0+(\.0+)?$/.test(trimmed);
}

interface GlazeEstimatorProps {
  /** Cantidad de piezas de la línea. Se lee de la cotización, no se reescribe. */
  quantity: string;
  disabled: boolean;
  currencySymbol: string;
  /** Rellena «gramos de receta por pieza» con lo estimado. */
  onApplyGramsPerPiece: (grams: string) => void;
}

export function GlazeEstimator({
  quantity,
  disabled,
  currencySymbol,
  onApplyGramsPerPiece,
}: GlazeEstimatorProps) {
  const [open, setOpen] = useState(false);
  const [pieceWeight, setPieceWeight] = useState("");
  const [glazes, setGlazes] = useState<GlazeSelectionIn[]>([]);

  const batches = usePreparations({ limit: 50, offset: 0 });

  const quantityValid = POSITIVE_INT.test(quantity.trim());
  const weightValid = isPositiveDecimal(pieceWeight);
  const sharesValid = glazes.every((glaze) => isPositiveDecimal(glaze.share ?? "1"));

  const payload = useMemo(
    () =>
      open && weightValid && quantityValid && sharesValid
        ? {
            piece_weight_g: pieceWeight.trim(),
            quantity: Number(quantity.trim()),
            glazes: glazes.map((glaze) => ({
              preparation_id: glaze.preparation_id,
              share: (glaze.share ?? "1").trim(),
            })),
          }
        : null,
    [open, weightValid, quantityValid, sharesValid, pieceWeight, quantity, glazes],
  );
  const estimate = useGlazeEstimate(payload);

  const chosen = new Set(glazes.map((glaze) => glaze.preparation_id));
  const batchOptions = [
    { value: "", label: "Añadir esmalte preparado…" },
    ...(batches.data?.items ?? [])
      .filter((batch) => !chosen.has(batch.id))
      .map((batch) => ({
        value: String(batch.id),
        label: `${batch.code} · ${batch.prepared_product_name}`,
      })),
  ];

  const labelFor = (preparationId: number) => {
    const batch = batches.data?.items.find((item) => item.id === preparationId);
    return batch ? `${batch.code} · ${batch.prepared_product_name}` : `#${preparationId}`;
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-sky-700 underline-offset-2 hover:underline"
      >
        Estimar esmalte a partir del peso de la pieza
      </button>
    );
  }

  return (
    <section
      aria-label="Estimador de esmalte"
      className="space-y-4 rounded-2xl border border-sky-100 bg-sky-50/50 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-sky-950">Esmalte estimado</p>
          <p className="text-[11px] text-sky-800">
            El porcentaje lo fija Configuración → Comercial. Estimar no descuenta inventario.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[11px] font-medium text-sky-700 underline-offset-2 hover:underline"
        >
          Cerrar
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Peso de la pieza (g)"
          requirement="required"
          value={pieceWeight}
          onChange={setPieceWeight}
          disabled={disabled}
          inputMode="decimal"
          placeholder="Ej. 500"
          hint="Peso en crudo de una sola pieza."
          error={
            pieceWeight.trim() !== "" && !weightValid ? "Debe ser mayor que cero." : undefined
          }
        />
        <SelectField
          label="Esmaltes de la pieza"
          requirement="optional"
          value=""
          options={batchOptions}
          onChange={(value) => {
            if (!value) return;
            setGlazes((current) => [
              ...current,
              { preparation_id: Number(value), share: "1" },
            ]);
          }}
          disabled={disabled || batches.isPending}
          hint="Varios esmaltes reparten el total; no lo multiplican."
        />
      </div>

      {glazes.length > 0 ? (
        <ul className="space-y-2">
          {glazes.map((glaze) => (
            <li
              key={glaze.preparation_id}
              className="flex flex-wrap items-end gap-3 rounded-xl border border-sky-100 bg-white/70 px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-xs text-zinc-800">
                {labelFor(glaze.preparation_id)}
              </span>
              <div className="w-28">
                <TextField
                  label="Reparto"
                  value={glaze.share ?? "1"}
                  onChange={(share) =>
                    setGlazes((current) =>
                      current.map((item) =>
                        item.preparation_id === glaze.preparation_id ? { ...item, share } : item,
                      ),
                    )
                  }
                  disabled={disabled}
                  inputMode="decimal"
                  hint="Peso relativo"
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  setGlazes((current) =>
                    current.filter((item) => item.preparation_id !== glaze.preparation_id),
                  )
                }
                disabled={disabled}
                className="pb-2 text-[11px] font-medium text-red-600 underline-offset-2 hover:underline disabled:opacity-50"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {!quantityValid ? (
        <p className="text-[11px] text-sky-800">
          Indique primero la cantidad a producir para poder estimar el total.
        </p>
      ) : null}

      {estimate.isPending && payload ? (
        <div className="flex justify-center py-4">
          <Spinner className="size-4" label="Estimando…" />
        </div>
      ) : estimate.isError ? (
        <p role="alert" className="text-xs text-red-600">
          {describeError(estimate.error)}
        </p>
      ) : estimate.data ? (
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-sky-100 bg-white/70 px-3 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                Porcentaje
              </dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">
                {formatDecimal(estimate.data.estimated_glaze_percent, 4)} %
              </dd>
            </div>
            <div className="rounded-xl border border-sky-100 bg-white/70 px-3 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                Por pieza
              </dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">
                {formatDecimal(estimate.data.grams_per_piece, 4)} g
              </dd>
            </div>
            <div className="rounded-xl border border-sky-100 bg-white/70 px-3 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                Total del lote
              </dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">
                {formatDecimal(estimate.data.total_estimated_grams, 4)} g
              </dd>
            </div>
          </dl>

          {estimate.data.allocations.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-sky-100 bg-white/70">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-sky-50/80 text-[10px] uppercase tracking-wide text-sky-700">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Esmalte</th>
                    <th className="px-3 py-2 text-right font-semibold">Gramos</th>
                    <th className="px-3 py-2 text-right font-semibold">g/ml</th>
                    <th className="px-3 py-2 text-right font-semibold">Mililitros</th>
                    <th className="px-3 py-2 text-right font-semibold">Costo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-50">
                  {estimate.data.allocations.map((allocation) => (
                    <tr key={allocation.preparation_id}>
                      <td className="px-3 py-2">
                        <span className="font-mono text-[10px] text-zinc-500">
                          {allocation.preparation_code}
                        </span>
                        <span className="ml-2 text-zinc-800">
                          {allocation.prepared_product_name}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-900">
                        {formatDecimal(allocation.grams, 4)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                        {formatDecimal(allocation.solids_g_per_ml, 6)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-900">
                        {formatDecimal(allocation.millilitres, 4)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                        {currencySymbol} {formatDecimal(allocation.estimated_cost, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[11px] text-sky-800">
              Añada un esmalte preparado para ver los mililitros y el costo. Sin él sólo se
              puede decir cuántos gramos harán falta.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-sky-800">
              Lo estimado no se guarda en la cotización. Al aplicarlo se rellena «gramos de
              receta por pieza», que es el campo que sí se persiste.
            </p>
            <SecondaryButton
              type="button"
              onClick={() => onApplyGramsPerPiece(estimate.data.grams_per_piece)}
              disabled={disabled}
            >
              Usar {formatDecimal(estimate.data.grams_per_piece, 4)} g por pieza
            </SecondaryButton>
          </div>
        </div>
      ) : null}
    </section>
  );
}
