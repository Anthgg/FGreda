/**
 * Preparaciones: convertir una receta en material preparado de verdad.
 *
 * A diferencia del simulador, esto **sí** toca el inventario. Confirmar
 * descuenta la materia prima y da de alta el preparado, todo en una sola
 * transacción del backend. Por eso el botón dice «Confirmar preparación» y no
 * «Calcular», y por eso cada envío lleva una clave de idempotencia: un doble
 * clic o un reintento del navegador descontaría dos veces la misma mezcla.
 *
 * Aquí no se calcula nada de negocio. El reparto de gramos y el costo salen de
 * `/recipes/calculate`; la concentración y el costo por mililitro los emite el
 * backend al confirmar. El navegador nunca divide peso seco entre rendimiento:
 * ese número es el puente g ↔ ml de todo el sistema y no puede tener dos
 * autores.
 */

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { PrimaryButton, SecondaryButton, SelectField, TextField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { SearchInput } from "@/features/masters/MasterTable";
import { useLocations, useStock } from "@/features/masters/useMasters";
import { formatDecimal } from "@/features/recipes/formatDecimal";
import { Metric } from "@/features/recipes/RecipeBadges";
import {
  useCreatePreparation,
  usePreparations,
  useRecipeCalc,
  useRecipes,
} from "@/features/recipes/useRecipes";
import { describeError } from "@/features/settings/messages";
import type { RecipeOut, RecipePreparationOut } from "@/types/recipes";

const SEARCH_DEBOUNCE_MS = 300;
/** Saldos que se traen de la ubicación elegida para contrastar existencias. */
const STOCK_PAGE = 200;

const POSITIVE = /^\d+(\.\d+)?$/;

function isPositive(value: string): boolean {
  const trimmed = value.trim();
  return POSITIVE.test(trimmed) && !/^0+(\.0+)?$/.test(trimmed);
}

function isZeroOrMore(value: string): boolean {
  return POSITIVE.test(value.trim());
}

/**
 * Clave de idempotencia de ESTE intento.
 *
 * No identifica el lote —el código lo emite el backend—, identifica el envío:
 * si la respuesta se pierde y el usuario reintenta, el backend reconoce la
 * clave y devuelve la preparación que ya hizo en vez de repetir el descuento.
 * `crypto.randomUUID` está disponible en todo navegador que soporte esta
 * aplicación.
 */
function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

function PreparationResult({ batch }: { batch: RecipePreparationOut }) {
  return (
    <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-emerald-900">
          Preparación {batch.code} registrada
        </p>
        <p className="font-mono text-[10px] text-emerald-700">
          {batch.prepared_product_internal_reference} · {batch.prepared_product_name}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Peso seco" value={`${formatDecimal(batch.total_dry_weight_g, 2)} g`} />
        <Metric label="Rendimiento" value={`${formatDecimal(batch.final_yield_ml, 2)} ml`} />
        <Metric
          label="Concentración"
          value={`${formatDecimal(batch.solids_g_per_ml, 6)} g/ml`}
          tone="base"
        />
        <Metric label="Costo del lote" value={formatDecimal(batch.batch_total_cost, 4)} />
      </div>
      <p className="text-[11px] text-emerald-800">
        Costo por mililitro: {formatDecimal(batch.unit_cost_per_ml, 6)}. El agua aumenta el
        rendimiento, no el costo de los sólidos.
      </p>
    </div>
  );
}

export function RecipePreparationsTab({ canEdit }: { canEdit: boolean }) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<RecipeOut | null>(null);
  const [versionId, setVersionId] = useState<number | null>(null);
  const [locationId, setLocationId] = useState<string>("");
  const [dryWeight, setDryWeight] = useState("1000");
  const [water, setWater] = useState("0");
  const [yieldMl, setYieldMl] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [lastBatch, setLastBatch] = useState<RecipePreparationOut | null>(null);

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
  const locations = useLocations();
  const create = useCreatePreparation();
  const history = usePreparations({ limit: 10, offset: 0 });

  const effectiveVersionId = versionId ?? selected?.current_version_id ?? null;

  // El desglose por componente y el costo salen del backend. Se pide con el
  // peso seco declarado, que es exactamente lo que se va a consumir.
  const calcPayload = useMemo(
    () =>
      effectiveVersionId && isPositive(dryWeight)
        ? {
            recipe_version_id: effectiveVersionId,
            target_base_quantity: dryWeight.trim(),
            target_uom: "g" as const,
          }
        : null,
    [effectiveVersionId, dryWeight],
  );
  const calc = useRecipeCalc(calcPayload);

  // Sin ubicacion no hay saldos que contrastar, y la consulta se apaga entera:
  // `limit: 0` no es "ninguno" para el backend, es un valor fuera de rango que
  // devuelve 422 en cada render de la pestana.
  const stock = useStock({ location_id: Number(locationId), limit: STOCK_PAGE }, Boolean(locationId));
  const available = useMemo(() => {
    const map = new Map<number, string>();
    for (const balance of stock.data?.items ?? []) map.set(balance.product_id, balance.quantity);
    return map;
  }, [stock.data]);

  const errors: Record<string, string | undefined> = {};
  if (!isPositive(dryWeight)) errors.dryWeight = "Indique un peso seco mayor que cero.";
  if (!isZeroOrMore(water)) errors.water = "Indique una cantidad de agua válida (puede ser 0).";
  if (!isPositive(yieldMl)) errors.yieldMl = "Indique el rendimiento medido, mayor que cero.";
  if (!locationId) errors.locationId = "Elija la ubicación de donde sale la materia prima.";

  const hasErrors = Object.values(errors).some(Boolean);
  const ready = canEdit && effectiveVersionId !== null && !hasErrors && !create.isPending;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ready || effectiveVersionId === null) return;
    create.mutate(
      {
        recipe_version_id: effectiveVersionId,
        location_id: Number(locationId),
        total_dry_weight_g: dryWeight.trim(),
        water_amount_ml: water.trim(),
        final_yield_ml: yieldMl.trim(),
        idempotency_key: idempotencyKey,
      },
      {
        onSuccess: (batch) => {
          setLastBatch(batch);
          // Clave nueva: el siguiente envío es otra preparación física, no un
          // reintento de esta.
          setIdempotencyKey(newIdempotencyKey());
        },
      },
    );
  };

  const locationOptions = [
    { value: "", label: "Seleccionar ubicación…" },
    ...(locations.data ?? []).map((location) => ({
      value: String(location.id),
      label: location.name,
    })),
  ];

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      {/* Receta y versión */}
      <section className="space-y-3 xl:col-span-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar receta…"
          label="Buscar receta a preparar"
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
                      onClick={() => {
                        setSelected(recipe);
                        setVersionId(recipe.current_version_id ?? null);
                        setLastBatch(null);
                      }}
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
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-8 text-center text-xs text-zinc-500">Sin coincidencias.</p>
          )}
        </div>

        {selected && selected.versions && selected.versions.length > 1 ? (
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-zinc-100 p-1">
            {selected.versions.map((version) => {
              const isSelected = version.id === effectiveVersionId;
              return (
                <button
                  key={version.id}
                  type="button"
                  onClick={() => setVersionId(version.id)}
                  className={[
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    isSelected
                      ? "bg-white font-semibold text-zinc-900 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-900",
                  ].join(" ")}
                >
                  V{version.version_number}
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      {/* Formulario y resultado */}
      <section className="space-y-4 xl:col-span-8">
        {!selected ? (
          <p className="py-16 text-center text-sm text-zinc-500">
            Seleccione una receta para preparar un lote.
          </p>
        ) : effectiveVersionId === null ? (
          <p className="py-16 text-center text-sm text-zinc-500">
            «{selected.name}» no tiene una versión que preparar.
          </p>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SelectField
                label="Ubicación"
                requirement="required"
                value={locationId}
                options={locationOptions}
                onChange={setLocationId}
                disabled={!canEdit || create.isPending}
                error={errors.locationId}
              />
              <TextField
                label="Peso seco (g)"
                requirement="required"
                value={dryWeight}
                onChange={setDryWeight}
                disabled={!canEdit || create.isPending}
                inputMode="decimal"
                hint="Total de sólidos del lote. La receta reparte este peso."
                error={errors.dryWeight}
              />
              <TextField
                label="Agua (ml)"
                requirement="required"
                value={water}
                onChange={setWater}
                disabled={!canEdit || create.isPending}
                inputMode="decimal"
                hint="No encarece el lote: aumenta el rendimiento."
                error={errors.water}
              />
              <TextField
                label="Rendimiento final (ml)"
                requirement="required"
                value={yieldMl}
                onChange={setYieldMl}
                disabled={!canEdit || create.isPending}
                inputMode="decimal"
                placeholder="Medido en el balde"
                hint="Volumen REAL medido, no peso seco + agua."
                error={errors.yieldMl}
              />
            </div>

            {calc.isPending && calcPayload ? (
              <div className="flex justify-center py-8">
                <Spinner className="size-4" label="Calculando consumo…" />
              </div>
            ) : calc.data ? (
              <div className="space-y-2">
                <div className="overflow-x-auto rounded-2xl border border-zinc-200">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Insumo</th>
                        <th className="px-3 py-2 text-right font-semibold">Necesario</th>
                        <th className="px-3 py-2 text-right font-semibold">Disponible</th>
                        <th className="px-3 py-2 text-right font-semibold">Costo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {calc.data.components.map((line) => {
                        const saldo = available.get(line.component_product_id);
                        return (
                          <tr key={line.component_product_id} className="hover:bg-zinc-50/60">
                            <td className="px-3 py-2">
                              <span className="font-medium text-zinc-900">
                                {line.component_name}
                              </span>
                              <span className="ml-2 font-mono text-[10px] text-zinc-400">
                                {line.component_internal_reference}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-zinc-900">
                              {formatDecimal(line.required_quantity, 2)} {line.uom}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                              {locationId ? formatDecimal(saldo, 2) : "—"}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                              {formatDecimal(line.component_cost, 4)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-right text-xs text-zinc-600">
                  Costo estimado del lote:{" "}
                  <strong className="tabular-nums text-zinc-900">
                    {formatDecimal(calc.data.total_material_cost, 4)}
                  </strong>
                </p>
                <p className="text-[11px] text-zinc-500">
                  El «disponible» es orientativo: quien decide si alcanza es el backend, que
                  bloquea los saldos al confirmar. La concentración (g/ml) y el costo por
                  mililitro se emiten en ese mismo momento.
                </p>
              </div>
            ) : null}

            {create.isError ? (
              <p role="alert" className="text-sm text-red-600">
                {describeError(create.error)}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-2">
              <SecondaryButton
                type="button"
                onClick={() => {
                  setDryWeight("1000");
                  setWater("0");
                  setYieldMl("");
                  setLastBatch(null);
                }}
                disabled={create.isPending}
              >
                Limpiar
              </SecondaryButton>
              <PrimaryButton type="submit" disabled={!ready}>
                {create.isPending ? "Preparando…" : "Confirmar preparación"}
              </PrimaryButton>
            </div>
            {!canEdit ? (
              <p className="text-right text-[11px] text-zinc-500">
                Solo un administrador puede registrar preparaciones.
              </p>
            ) : null}
          </form>
        )}

        {lastBatch ? <PreparationResult batch={lastBatch} /> : null}

        {/* Historial */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Últimas preparaciones
          </h3>
          {history.isPending ? (
            <div className="flex justify-center py-6">
              <Spinner className="size-4" label="Cargando…" />
            </div>
          ) : history.data?.items.length ? (
            <div className="overflow-x-auto rounded-2xl border border-zinc-200">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Lote</th>
                    <th className="px-3 py-2 font-semibold">Preparado</th>
                    <th className="px-3 py-2 text-right font-semibold">Seco (g)</th>
                    <th className="px-3 py-2 text-right font-semibold">Rendimiento (ml)</th>
                    <th className="px-3 py-2 text-right font-semibold">g/ml</th>
                    <th className="px-3 py-2 text-right font-semibold">Costo/ml</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {history.data.items.map((batch) => (
                    <tr key={batch.id} className="hover:bg-zinc-50/60">
                      <td className="px-3 py-2 font-mono text-[11px] text-zinc-900">
                        {batch.code}
                      </td>
                      <td className="px-3 py-2 text-zinc-700">{batch.prepared_product_name}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-600">
                        {formatDecimal(batch.total_dry_weight_g, 2)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-600">
                        {formatDecimal(batch.final_yield_ml, 2)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-900">
                        {formatDecimal(batch.solids_g_per_ml, 6)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-600">
                        {formatDecimal(batch.unit_cost_per_ml, 6)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-6 text-center text-xs text-zinc-500">
              Todavía no se ha preparado ningún lote.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
