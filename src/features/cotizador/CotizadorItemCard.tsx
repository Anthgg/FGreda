import { useState } from "react";

import { ProductSelectField, SelectField, TextField } from "@/components/form";
import type { SelectOption } from "@/components/form";
import { formatDecimalString } from "@/features/firings/labels";
import { useConfirmedFiringLines } from "@/features/firings/useFirings";
import { NuevaPiezaModal } from "@/features/masters/NuevaPiezaModal";
import { RecipeSelectField } from "@/features/quotations/RecipeSelectField";
import { useAdditionals, useOtherCosts, useTechniques } from "@/features/quotations/useQuotations";
import type { CotizadorItemDraft } from "@/features/cotizador/draft";
import { GlazeEstimator } from "@/features/cotizador/GlazeEstimator";
import { itemFromProduct } from "@/features/cotizador/draft";
import type { KilnOut } from "@/types/firings";
import type { QuotationBuilderItemOut } from "@/types/quotationBuilder";

export type CotizadorItemMode = "PIECES" | "PRODUCTION" | "COSTS" | "MARGIN" | "SUMMARY";

const money = (value: string | null | undefined, symbol = "S/") =>
  `${symbol} ${formatDecimalString(value, 2)}`;

const DIMENSIONS = [
  ["width", "Ancho (cm)"],
  ["height", "Alto (cm)"],
  ["length", "Largo (cm)"],
  ["depth", "Profundidad (cm)"],
] as const;

/** Una dimension solo es valida si es un numero estrictamente mayor que 0. */
const isPositive = (value: string) => {
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0;
};

const snapshotDecimal = (snapshot: Record<string, unknown>, key: string) => {
  const value = snapshot[key];
  return value === null || value === undefined ? "—" : formatDecimalString(String(value), 2);
};

/** Plan de una quema concreta, leido del preview que devuelve el backend. */
interface FiringPlanEntry {
  batches: number;
  costPerBatch: number;
  totalCost: number;
  /**
   * Fase 009C: la duracion NO se calcula aqui. Cada horno tiene la suya
   * (`kilns.firing_days_per_batch`: el pequeno 3 dias, el grande 4), asi que
   * multiplicar por una constante en el navegador daria un numero distinto
   * del que el backend congela al confirmar.
   */
  daysPerBatch: number;
  days: number;
  capacity: string | null;
  occupancy: string | null;
}

function FiringToggle({
  label,
  selected,
  onToggle,
  kilnValue,
  kilnOptions,
  onKilnChange,
  disabled,
  plan,
  currencySymbol,
}: {
  label: string;
  selected: boolean;
  onToggle: (value: boolean) => void;
  kilnValue: string;
  kilnOptions: SelectOption[];
  onKilnChange: (value: string) => void;
  disabled: boolean;
  plan: FiringPlanEntry | null;
  currencySymbol: string | undefined;
}) {
  return (
    <div
      className={[
        "rounded-2xl border p-3 transition-colors",
        selected ? "border-orange-200 bg-orange-50/40" : "border-zinc-200 bg-white",
      ].join(" ")}
    >
      <label className="flex items-center gap-2 text-xs font-semibold text-zinc-900">
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onToggle(event.target.checked)}
          disabled={disabled}
          className="h-4 w-4 accent-orange-600"
        />
        {label}
      </label>

      {selected ? (
        <div className="mt-3 space-y-2">
          <SelectField
            label={`Horno de ${label.toLowerCase()}`}
            requirement="required"
            value={kilnValue}
            options={kilnOptions}
            onChange={onKilnChange}
            disabled={disabled}
            placeholder="Elegir horno…"
          />
          {plan ? (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-zinc-600">
              {/* La capacidad del sistema es VOLUMEN en cm3, no un conteo de
                  piezas: se muestra tal cual en vez de inventar una
                  conversion a piezas que el backend no calcula. */}
              <dt>Capacidad</dt>
              <dd className="text-right tabular-nums">{plan.capacity ?? "—"} cm³</dd>
              <dt>Ocupación</dt>
              <dd className="text-right tabular-nums">
                {plan.occupancy ? `${formatDecimalString(plan.occupancy, 1)} %` : "—"}
              </dd>
              <dt>Hornadas necesarias</dt>
              <dd className="text-right font-semibold tabular-nums text-zinc-900">{plan.batches}</dd>
              <dt>Costo / hornada</dt>
              <dd className="text-right tabular-nums">
                {money(String(plan.costPerBatch), currencySymbol)}
              </dd>
              <dt>Total de la quema</dt>
              <dd className="text-right font-semibold tabular-nums text-zinc-900">
                {money(String(plan.totalCost), currencySymbol)}
              </dd>
              <dt>Días / hornada</dt>
              <dd className="text-right tabular-nums">{plan.daysPerBatch}</dd>
              <dt>Tiempo</dt>
              <dd className="text-right font-semibold tabular-nums text-zinc-900">
                {plan.days} días
              </dd>
            </dl>
          ) : (
            <p className="text-[11px] text-zinc-400">
              El plan de hornadas aparece al completar cantidad y medidas.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SelectionChips({
  ids,
  labels,
  disabled,
  onRemove,
}: {
  ids: string[];
  labels: Map<string, string>;
  disabled: boolean;
  onRemove: (id: string) => void;
}) {
  if (!ids.length) return <p className="text-xs text-zinc-400">Ninguno seleccionado.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {ids.map((id) => (
        <span key={id} className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs text-orange-950">
          {labels.get(id) ?? `#${id}`}
          {!disabled ? (
            <button type="button" onClick={() => onRemove(id)} aria-label={`Quitar ${labels.get(id) ?? id}`} className="font-bold text-orange-700 hover:text-orange-950">
              ×
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}

export function CotizadorItemCard({
  item,
  index,
  mode,
  preview,
  currencySymbol = "S/",
  productionSummary,
  headerKilnId = "",
  kilns = [],
  disabled,
  excludedProductIds,
  onChange,
  onRemove,
}: {
  item: CotizadorItemDraft;
  index: number;
  mode: CotizadorItemMode;
  preview?: QuotationBuilderItemOut | undefined;
  currencySymbol?: string | undefined;
  /** production_summary del preview: las hornadas viven por SESION, no por item. */
  productionSummary?: Record<string, unknown> | undefined;
  /** Horno de cabecera de la cotizacion, que una linea puede heredar. */
  headerKilnId?: string | undefined;
  kilns?: KilnOut[] | undefined;
  disabled: boolean;
  excludedProductIds: number[];
  onChange: (item: CotizadorItemDraft) => void;
  onRemove: () => void;
}) {
  const [creatingProduct, setCreatingProduct] = useState<string | null>(null);
  const [techniqueToAdd, setTechniqueToAdd] = useState("");
  const [additionalToAdd, setAdditionalToAdd] = useState("");
  const [otherCostToAdd, setOtherCostToAdd] = useState("");
  const techniques = useTechniques(true);
  const additionals = useAdditionals(true);
  const otherCosts = useOtherCosts(true);
  const productId = /^[1-9]\d*$/.test(item.productId) ? Number(item.productId) : null;
  const firingLines = useConfirmedFiringLines({
    ...(productId ? { product_id: productId } : {}),
    limit: 100,
  });
  const visibleWarnings = preview?.warnings.filter(
    (code) => code !== "DISCOUNT_RULE_BLOCKED_BY_SOURCE",
  ) ?? [];
  const manualPriceOverridesMargin = item.commercialSaleUnitPrice.trim() !== "";

  const patch = (values: Partial<CotizadorItemDraft>) => onChange({ ...item, ...values });

  // Plan de hornadas por tipo de quema, leido del preview. El backend es la
  // autoridad: aqui no se recalcula nada, solo se muestra lo que devolvio.
  const firingPlan = ((): {
    LOW: FiringPlanEntry | null;
    HIGH: FiringPlanEntry | null;
    totalBatches: number;
    totalDays: number;
    totalCost: number;
  } => {
    const sessions = Array.isArray(productionSummary?.["sessions"])
      ? (productionSummary["sessions"] as Array<Record<string, unknown>>)
      : [];
    const entryFor = (
      firingType: "LOW" | "HIGH",
      selected: boolean,
      kilnId: string,
    ): FiringPlanEntry | null => {
      if (!selected) return null;
      // El horno EFECTIVO: el propio de la linea o, si la hereda, el de
      // cabecera. Sin esto, una linea que hereda aceptaria cualquier sesion
      // de ese tipo de quema y podria mostrar las hornadas, la ocupacion y el
      // costo del horno de OTRO producto de la misma cotizacion.
      const effectiveKilnId = kilnId || headerKilnId;
      const session = sessions.find(
        (value) =>
          value["firing_type"] === firingType &&
          (!effectiveKilnId || String(value["kiln_id"]) === effectiveKilnId),
      );
      if (!session) return null;
      const batches = Number(session["batches"] ?? 1);
      const total = Number(session["subtotal"] ?? 0);
      return {
        batches,
        // El subtotal ya viene multiplicado por las hornadas; el costo de una
        // sola es el que interesa mostrar junto al multiplicador.
        costPerBatch: batches > 0 ? total / batches : total,
        totalCost: total,
        daysPerBatch: Number(session["days_per_batch"] ?? 0),
        days: Number(session["days"] ?? 0),
        capacity: session["capacity_snapshot"] == null ? null : String(session["capacity_snapshot"]),
        occupancy:
          session["physical_occupancy_percentage"] == null
            ? null
            : String(session["physical_occupancy_percentage"]),
      };
    };
    const low = entryFor("LOW", item.lowKilnSelected, item.lowKilnId);
    const high = entryFor("HIGH", item.highKilnSelected, item.highKilnId);
    const totalBatches = (low?.batches ?? 0) + (high?.batches ?? 0);
    // Se suman los dias de cada quema, no el total de hornadas por una
    // duracion comun: baja y alta pueden ir en hornos que tardan distinto.
    const totalDays = (low?.days ?? 0) + (high?.days ?? 0);
    return {
      LOW: low,
      HIGH: high,
      totalBatches,
      totalDays,
      totalCost: (low?.totalCost ?? 0) + (high?.totalCost ?? 0),
    };
  })();

  // `name` unico por linea: sin esto, dos productos en la misma cotizacion
  // compartirian el grupo de radios y elegir el modo en uno desmarcaria el otro.
  const dimensionsModeName = `dimensions-mode-${item.id ?? `pos-${index}`}`;
  const standardSummary =
    DIMENSIONS.filter(([field]) => item.standardDimensions[field].trim())
      .map(([field, label]) => `${label.replace(" (cm)", "")} ${item.standardDimensions[field]}`)
      .join(" · ") || "sin medidas registradas";

  const setDimensionsMode = (custom: boolean) => {
    if (custom === item.dimensionsOverridden) return;
    patch({
      dimensionsOverridden: custom,
      // Al personalizar se parte de la medida estandar (si existe) para que el
      // usuario ajuste solo lo necesario; al volver a estandar se restaura
      // exactamente el maestro. Un campo que el maestro no tiene conserva lo
      // ya escrito: es el CASO C (completar un producto sin medidas) y
      // borrarlo obligaria a reescribirlo.
      dimensions: Object.fromEntries(
        DIMENSIONS.map(([field]) => {
          const master = item.standardDimensions[field];
          if (custom) return [field, item.dimensions[field] || master];
          return [field, master || item.dimensions[field]];
        }),
      ) as CotizadorItemDraft["dimensions"],
    });
  };

  const techniqueLabels = new Map((techniques.data?.items ?? []).map((value) => [String(value.id), value.name]));
  const additionalLabels = new Map((additionals.data?.items ?? []).map((value) => [String(value.id), value.name]));
  const otherCostLabels = new Map((otherCosts.data?.items ?? []).map((value) => [String(value.id), value.name]));
  const lowKilnOptions = kilns
    .filter((kiln) => kiln.current_low_rate !== null)
    .map((kiln) => ({ value: String(kiln.id), label: `${kiln.code} · ${kiln.name}` }));
  const highKilnOptions = kilns
    .filter((kiln) => kiln.current_high_rate !== null)
    .map((kiln) => ({ value: String(kiln.id), label: `${kiln.code} · ${kiln.name}` }));
  const factorKilnOptions = kilns.map((kiln) => ({
    value: String(kiln.id),
    label: `${kiln.code} · ${kiln.name}`,
  }));
  const firingLineOptions = [
    { value: "", label: "Simulación integrada" },
    ...(firingLines.data?.items ?? []).map((line) => ({
      value: String(line.id),
      label: `${line.firing_code} · ${line.firing_date ?? "Sin fecha"} · ${money(line.allocated_cost, currencySymbol)}`,
    })),
  ];

  const addSelection = (
    id: string,
    key: "techniqueIds" | "additionalIds" | "otherCostIds",
    reset: (value: string) => void,
  ) => {
    if (id && !item[key].includes(id)) patch({ [key]: [...item[key], id] });
    reset("");
  };

  const addTechnique = (id: string) => {
    if (id && !item.techniqueIds.includes(id)) {
      patch({
        techniqueIds: [...item.techniqueIds, id],
        techniqueQuantities: {
          ...item.techniqueQuantities,
          [id]: item.quantity || "1",
        },
      });
    }
    setTechniqueToAdd("");
  };

  const addAdditional = (id: string) => {
    if (id && !item.additionalIds.includes(id)) {
      patch({
        additionalIds: [...item.additionalIds, id],
        additionalQuantities: {
          ...item.additionalQuantities,
          [id]: "1",
        },
      });
    }
    setAdditionalToAdd("");
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50/80 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-700">Producto {index + 1}</p>
          <h3 className="truncate text-sm font-semibold text-zinc-950">{item.productLabel || "Seleccione una pieza"}</h3>
        </div>
        {!disabled && mode === "PIECES" ? (
          <button type="button" onClick={onRemove} className="rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50">
            Quitar
          </button>
        ) : null}
      </header>

      {mode === "PIECES" ? (
        <div className="space-y-5 p-4 sm:p-5">
          <div>
            <ProductSelectField
              label="Pieza terminada"
              requirement="required"
              value={item.productId}
              selectedLabel={item.productLabel}
              productType="FINISHED_PRODUCT"
              excludeIds={excludedProductIds}
              disabled={disabled}
              allowCreate={!disabled}
              onCreateRequested={setCreatingProduct}
              createLabel={(text) => `+ Crear pieza «${text}»`}
              onChange={(_value, product) => product && onChange(itemFromProduct(product))}
            />
          </div>

          {item.productId ? (
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-zinc-800">Dimensiones técnicas</p>
                <span
                  className={[
                    "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                    item.dimensionsOverridden
                      ? "bg-orange-100 text-orange-900"
                      : "bg-zinc-100 text-zinc-600",
                  ].join(" ")}
                >
                  {item.dimensionsOverridden ? "Medidas personalizadas" : "Medidas estándar"}
                </span>
              </div>

              <p className="mb-2 text-[11px] text-zinc-500">
                Estándar del maestro:{" "}
                <span className="font-medium tabular-nums text-zinc-700">
                  {standardSummary}
                </span>
              </p>

              {/* Radiogroup real (no divs con onClick): navegable con teclado
                  y anunciado por lectores de pantalla. */}
              <fieldset
                className="mb-3 flex flex-wrap gap-4 border-0 p-0"
                disabled={disabled}
              >
                <legend className="sr-only">Modo de medidas para esta pieza</legend>
                <label className="inline-flex items-center gap-2 text-xs text-zinc-700">
                  <input
                    type="radio"
                    name={dimensionsModeName}
                    value="STANDARD"
                    checked={!item.dimensionsOverridden}
                    onChange={() => setDimensionsMode(false)}
                    disabled={disabled}
                    className="h-4 w-4 accent-zinc-900"
                  />
                  Usar medidas estándar
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-zinc-700">
                  <input
                    type="radio"
                    name={dimensionsModeName}
                    value="CUSTOM"
                    checked={item.dimensionsOverridden}
                    onChange={() => setDimensionsMode(true)}
                    disabled={disabled}
                    className="h-4 w-4 accent-orange-600"
                  />
                  Personalizar medidas
                </label>
              </fieldset>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {DIMENSIONS.map(([field, label]) => {
                  // Personalizado: todo editable. Estandar: solo lo que el
                  // maestro no tiene (completar un producto sin medidas).
                  const editable =
                    item.dimensionsOverridden || item.editableDimensions.includes(field);
                  const requiredForProduction = field !== "depth";
                  const value = item.dimensions[field];
                  const invalid =
                    editable && requiredForProduction && value.trim() !== "" && !isPositive(value);
                  return (
                    <TextField
                      key={field}
                      label={label}
                      requirement={
                        editable
                          ? (requiredForProduction ? "required" : "optional")
                          : "automatic"
                      }
                      value={value}
                      onChange={(next) => patch({ dimensions: { ...item.dimensions, [field]: next } })}
                      disabled={disabled || !editable}
                      readOnly={!editable}
                      inputMode="decimal"
                      {...(invalid ? { error: "Debe ser mayor que 0." } : {})}
                      hint={
                        item.dimensionsOverridden
                          ? "Sólo para esta cotización; el maestro no cambia."
                          : editable
                            ? requiredForProduction
                              ? "El maestro no tiene esta medida."
                              : "El Excel no usa esta medida para la quema."
                            : "Protegido por el maestro."
                      }
                    />
                  );
                })}
              </div>
            </div>
          ) : null}

        </div>
      ) : null}

      {mode === "PRODUCTION" ? (
        <div className="space-y-5 p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-4">
            <TextField
              label="Cantidad a producir"
              requirement="required"
              value={item.quantity}
              onChange={(quantity) => patch({ quantity })}
              disabled={disabled}
              inputMode="numeric"
              placeholder="Ej. 24"
              error={item.quantity && !/^[1-9]\d*$/.test(item.quantity) ? "Use un entero mayor que cero." : undefined}
            />
            <TextField
              label="Costo de materiales aplicado"
              requirement={item.materialsApplied ? "required" : "optional"}
              value={item.materialsApplied}
              onChange={(materialsApplied) => patch({ materialsApplied })}
              disabled={disabled}
              inputMode="decimal"
              placeholder="Ej. 11.58"
              hint="Si el Excel ya fija el costo, reemplaza receta y gramos."
            />
            <RecipeSelectField
              label="Receta"
              requirement={item.materialsApplied ? "optional" : "automatic"}
              value={item.recipeId}
              selectedLabel={item.recipeLabel}
              disabled={disabled || !item.productId}
              hint="El backend selecciona automáticamente cuando existe una única versión activa."
              onChange={(recipeId, recipe) => patch({
                recipeId,
                recipeLabel: recipe ? `${recipe.product_internal_reference} · ${recipe.name}` : "",
                recipeVersionId: recipe?.current_version_id ? String(recipe.current_version_id) : "",
              })}
            />
            <TextField
              label="Gramos de receta por pieza"
              requirement={item.materialsApplied ? "optional" : "required"}
              value={item.materialGramsPerPiece}
              onChange={(materialGramsPerPiece) => patch({ materialGramsPerPiece })}
              disabled={disabled}
              inputMode="decimal"
              placeholder="Ej. 450"
            />
          </div>
          <GlazeEstimator
            glazes={item.glazes}
            glazeUnit={item.glazeUnit}
            plan={preview?.glaze_plan ?? null}
            warnings={preview?.warnings ?? []}
            disabled={disabled}
            currencySymbol={currencySymbol}
            onChange={patch}
          />
          <div className="rounded-2xl border border-orange-100 bg-orange-50/50 p-4">
            <div className="mb-3">
              <p className="text-xs font-semibold text-orange-950">Ruta de quema de esta pieza</p>
              <p className="text-[11px] text-orange-800">Use una línea confirmada para trasladar el costo real del lote, o simule aquí.</p>
            </div>
            <SelectField
              label="Fuente del costo de quema"
              requirement="required"
              value={item.firingLineId}
              options={firingLineOptions}
              onChange={(firingLineId) => {
                const selected = (firingLines.data?.items ?? []).find(
                  (line) => String(line.id) === firingLineId,
                );
                patch({
                  firingLineId,
                  firingLineLabel: selected
                    ? `${selected.firing_code} · ${selected.description}`
                    : "",
                  ...(selected ? { quantity: String(selected.quantity) } : {}),
                });
              }}
              disabled={disabled || !productId || firingLines.isPending}
              hint="Sólo aparecen líneas confirmadas del mismo producto; al elegir una se usa su cantidad real."
            />
            {!item.firingLineId ? <div className="mt-4 space-y-4">
              {/* Fase 009C: baja y alta son independientes. Checkboxes reales,
                  no radios: no son mutuamente excluyentes. */}
              <div className="grid gap-4 lg:grid-cols-2">
                <FiringToggle
                  label="Quema baja"
                  selected={item.lowKilnSelected}
                  onToggle={(lowKilnSelected) => patch({ lowKilnSelected })}
                  kilnValue={item.lowKilnId}
                  kilnOptions={lowKilnOptions}
                  onKilnChange={(lowKilnId) => patch({ lowKilnId })}
                  disabled={disabled}
                  plan={firingPlan.LOW}
                  currencySymbol={currencySymbol}
                />
                <FiringToggle
                  label="Quema alta"
                  selected={item.highKilnSelected}
                  onToggle={(highKilnSelected) => patch({ highKilnSelected })}
                  kilnValue={item.highKilnId}
                  kilnOptions={highKilnOptions}
                  onKilnChange={(highKilnId) => patch({ highKilnId })}
                  disabled={disabled}
                  plan={firingPlan.HIGH}
                  currencySymbol={currencySymbol}
                />
              </div>
              {!item.lowKilnSelected && !item.highKilnSelected ? (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  Seleccione al menos una quema para poder cotizar la pieza.
                </p>
              ) : null}
              {firingPlan.totalBatches > 1 ? (
                <div className="rounded-xl border border-orange-100 bg-orange-50/60 px-3 py-2 text-xs text-orange-950">
                  <span className="font-semibold">Total {firingPlan.totalBatches} hornadas</span>
                  {" · "}
                  <span className="tabular-nums">{firingPlan.totalDays} días</span>
                  {" · "}
                  <span className="tabular-nums">{money(String(firingPlan.totalCost), currencySymbol)}</span>
                </div>
              ) : null}
              <SelectField
                label="Ocupación medida en"
                requirement="automatic"
                value={item.factorKilnId}
                options={factorKilnOptions}
                onChange={(factorKilnId) => patch({ factorKilnId })}
                disabled={disabled}
                placeholder="Automático"
                hint="Horno cuya capacidad determina el tramo y factor."
              />
            </div> : (
              <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                {item.firingLineLabel || "Línea de quema confirmada"}. El costo queda trazado a esa hoja.
              </p>
            )}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <TextField label="Ajuste de días" value={item.daysAdjustment} onChange={(daysAdjustment) => patch({ daysAdjustment })} disabled={disabled} inputMode="numeric" />
            <TextField label="Días de espera" value={item.waitingDays} onChange={(waitingDays) => patch({ waitingDays })} disabled={disabled} inputMode="numeric" />
            <div className="rounded-xl bg-zinc-50 p-3"><p className="text-[11px] text-zinc-500">Dimensiones resueltas</p><p className="mt-1 text-sm font-semibold tabular-nums">{item.dimensions.width || "—"} × {item.dimensions.length || "—"} × {item.dimensions.height || "—"} cm</p><p className="text-[10px] text-zinc-400">Sólo lectura en Producción</p></div>
          </div>
          <div className="space-y-3">
            <SelectField label="Agregar técnica productiva" value={techniqueToAdd} options={(techniques.data?.items ?? []).filter((x) => !item.techniqueIds.includes(String(x.id))).map((x) => ({ value: String(x.id), label: x.name }))} onChange={addTechnique} disabled={disabled} placeholder="Elegir técnica…" />
            <SelectionChips ids={item.techniqueIds} labels={techniqueLabels} disabled={disabled} onRemove={(id) => patch({ techniqueIds: item.techniqueIds.filter((value) => value !== id) })} />
            {item.techniqueIds.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {item.techniqueIds.map((id) => (
                <TextField
                  key={id}
                  label={`${techniqueLabels.get(id) ?? `Técnica ${id}`} · cantidad`}
                  requirement="required"
                  value={(item.techniqueQuantities[id] ?? item.quantity) || "1"}
                  onChange={(value) => patch({
                    techniqueQuantities: { ...item.techniqueQuantities, [id]: value },
                  })}
                  disabled={disabled}
                  inputMode="numeric"
                />
              ))}
            </div> : null}
          </div>
          {preview?.production_snapshot && Object.keys(preview.production_snapshot).length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-zinc-50 p-3"><p className="text-[10px] uppercase text-zinc-400">Volumen</p><p className="font-semibold tabular-nums">{snapshotDecimal(preview.production_snapshot, "total_volume_cm3")} cm³</p></div>
              <div className="rounded-xl bg-zinc-50 p-3"><p className="text-[10px] uppercase text-zinc-400">Ocupación</p><p className="font-semibold tabular-nums">{snapshotDecimal(preview.production_snapshot, "occupancy_percentage")}%</p></div>
              <div className="rounded-xl bg-zinc-50 p-3"><p className="text-[10px] uppercase text-zinc-400">Días totales</p><p className="font-semibold tabular-nums">{preview.total_days}</p></div>
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-3"><p className="text-[10px] uppercase text-orange-700">Quema asignada</p><p className="font-semibold tabular-nums text-orange-950">{money(preview.firing_cost, currencySymbol)}</p></div>
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === "COSTS" ? (
        <div className="space-y-6 p-4 sm:p-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-3">
              <SelectField label="Agregar adicional" value={additionalToAdd} options={(additionals.data?.items ?? []).filter((x) => !item.additionalIds.includes(String(x.id))).map((x) => ({ value: String(x.id), label: x.name }))} onChange={addAdditional} disabled={disabled} placeholder="Elegir adicional…" />
              <SelectionChips ids={item.additionalIds} labels={additionalLabels} disabled={disabled} onRemove={(id) => patch({ additionalIds: item.additionalIds.filter((value) => value !== id) })} />
              {item.additionalIds.map((id) => (
                <TextField
                  key={id}
                  label={`${additionalLabels.get(id) ?? `Adicional ${id}`} · cantidad`}
                  requirement="automatic"
                  value={item.additionalQuantities[id] ?? "1"}
                  onChange={(value) => patch({
                    additionalQuantities: { ...item.additionalQuantities, [id]: value },
                  })}
                  disabled={disabled}
                  inputMode="decimal"
                  hint="El Excel usa 0.5 para número de moldes y 1 para cada vidriado."
                />
              ))}
            </div>
            <div className="space-y-3">
              <SelectField label="Agregar otro gasto" value={otherCostToAdd} options={(otherCosts.data?.items ?? []).filter((x) => !item.otherCostIds.includes(String(x.id))).map((x) => ({ value: String(x.id), label: x.name }))} onChange={(id) => addSelection(id, "otherCostIds", setOtherCostToAdd)} disabled={disabled} placeholder="Elegir gasto…" />
              <SelectionChips ids={item.otherCostIds} labels={otherCostLabels} disabled={disabled} onRemove={(id) => patch({ otherCostIds: item.otherCostIds.filter((value) => value !== id) })} />
            </div>
          </div>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
            <div className="rounded-xl bg-zinc-50 p-3"><p className="text-[11px] text-zinc-500">Material</p><p className="mt-1 text-sm font-bold tabular-nums">{money(preview?.materials_applied, currencySymbol)}</p></div>
            <div className="rounded-xl bg-zinc-50 p-3"><p className="text-[11px] text-zinc-500">Quema</p><p className="mt-1 text-sm font-bold tabular-nums">{money(preview?.firing_cost, currencySymbol)}</p></div>
            <div className="rounded-xl bg-zinc-50 p-3"><p className="text-[11px] text-zinc-500">Mano de obra</p><p className="mt-1 text-sm font-bold tabular-nums">{money(preview?.labor_cost, currencySymbol)}</p></div>
            <div className="rounded-xl bg-zinc-50 p-3"><p className="text-[11px] text-zinc-500">Otros gastos</p><p className="mt-1 text-sm font-bold tabular-nums">{money(preview?.space_cost, currencySymbol)}</p></div>
            <div className="rounded-xl bg-zinc-50 p-3"><p className="text-[11px] text-zinc-500">Costo unitario backend</p><p className="mt-1 text-base font-bold tabular-nums">{money(preview?.final_unit_cost, currencySymbol)}</p></div>
            <div className="rounded-xl bg-zinc-50 p-3"><p className="text-[11px] text-zinc-500">Costo total backend</p><p className="mt-1 text-base font-bold tabular-nums">{money(preview?.final_total_cost, currencySymbol)}</p></div>
          </div>
          {preview?.additionals.length ? (
            <div className="rounded-xl border border-zinc-200 p-3"><p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-zinc-400">Adicionales calculados por BGreda</p>{preview.additionals.map((line, lineIndex) => <p key={lineIndex} className="flex justify-between gap-3 text-xs"><span>{String(line.name_snapshot ?? `Adicional ${lineIndex + 1}`)}</span><span className="font-semibold tabular-nums">{money(String(line.applied_cost ?? "0"), currencySymbol)}</span></p>)}</div>
          ) : null}
        </div>
      ) : null}

      {mode === "MARGIN" ? (
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-5">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3"><p className="text-[11px] text-zinc-500">Cantidad de piezas</p><p className="mt-1 text-base font-bold tabular-nums">{preview?.quantity ?? (item.quantity || "—")}</p></div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3"><p className="text-[11px] text-zinc-500">Costo unitario sin IGV</p><p className="mt-1 text-base font-bold tabular-nums">{money(preview?.final_unit_cost, currencySymbol)}</p><p className="mt-1 text-[10px] text-zinc-500">Incluye la parte proporcional de la quema.</p></div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3"><p className="text-[11px] text-zinc-500">Costo total del lote sin IGV</p><p className="mt-1 text-base font-bold tabular-nums">{money(preview?.final_total_cost, currencySymbol)}</p><p className="mt-1 text-[10px] text-zinc-500">Material, quema, mano de obra y otros gastos.</p></div>
          <TextField label="Markup (%)" requirement="required" value={item.markupPercent} onChange={(markupPercent) => patch({ markupPercent })} disabled={disabled} inputMode="decimal" />
          <TextField label="Precio comercial unitario" requirement="optional" value={item.commercialSaleUnitPrice} onChange={(commercialSaleUnitPrice) => patch({ commercialSaleUnitPrice })} disabled={disabled} inputMode="decimal" hint="Vacío: usa la sugerencia del backend." />
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-3"><p className="text-[11px] text-orange-800">Sugerido unitario sin IGV</p><p className="mt-1 text-base font-bold tabular-nums text-orange-950">{money(preview?.suggested_commercial_unit_price, currencySymbol)}</p></div>
          <div className="rounded-xl bg-zinc-950 p-3 text-white"><p className="text-[11px] text-zinc-400">Aplicado unitario sin IGV</p><p className="mt-1 text-base font-bold tabular-nums">{money(preview?.commercial_sale_unit_price, currencySymbol)}</p><p className="text-[10px] text-zinc-400">Utilidad del lote: {money(preview?.effective_profit_total, currencySymbol)}</p></div>
          <div className="rounded-xl border border-zinc-200 bg-white p-3"><p className="text-[11px] text-zinc-500">Precio unitario con IGV</p><p className="mt-1 text-base font-bold tabular-nums">{money(preview?.commercial_unit_price_with_tax, currencySymbol)}</p></div>
          <div className="rounded-xl border border-zinc-200 bg-white p-3"><p className="text-[11px] text-zinc-500">Subtotal del lote sin IGV</p><p className="mt-1 text-base font-bold tabular-nums">{money(preview?.commercial_subtotal, currencySymbol)}</p></div>
          <div className="rounded-xl border border-zinc-200 bg-white p-3"><p className="text-[11px] text-zinc-500">IGV del lote</p><p className="mt-1 text-base font-bold tabular-nums">{money(preview?.tax_amount, currencySymbol)}</p></div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-[11px] text-emerald-800">Total del lote con IGV</p><p className="mt-1 text-base font-bold tabular-nums text-emerald-950">{money(preview?.commercial_total, currencySymbol)}</p></div>
          {manualPriceOverridesMargin ? (
            <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 sm:col-span-2 lg:col-span-5">
              <p className="text-xs text-amber-950">El precio manual {money(item.commercialSaleUnitPrice, currencySymbol)} reemplaza el precio calculado con margen.</p>
              {!disabled ? <button type="button" className="min-h-10 rounded-lg bg-amber-900 px-4 text-xs font-semibold text-white hover:bg-amber-950" onClick={() => patch({ commercialSaleUnitPrice: "" })}>Usar precio con margen</button> : null}
            </div>
          ) : (
            <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 sm:col-span-2 lg:col-span-5">El margen se aplica automáticamente sobre el costo unitario sin IGV; el IGV se agrega después.</p>
          )}
        </div>
      ) : null}

      {mode === "SUMMARY" ? (
        <div className="space-y-4 p-4 sm:p-5">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div><dt className="text-[10px] uppercase text-zinc-400">Cantidad</dt><dd className="font-semibold tabular-nums">{preview?.quantity ?? (item.quantity || "—")}</dd></div>
            <div><dt className="text-[10px] uppercase text-zinc-400">Costo unit.</dt><dd className="font-semibold tabular-nums">{money(preview?.final_unit_cost, currencySymbol)}</dd></div>
            <div><dt className="text-[10px] uppercase text-zinc-400">Quema</dt><dd className="font-semibold tabular-nums">{money(preview?.firing_cost, currencySymbol)}</dd></div>
            <div><dt className="text-[10px] uppercase text-zinc-400">Precio unit. sin IGV</dt><dd className="font-semibold tabular-nums">{money(preview?.commercial_sale_unit_price, currencySymbol)}</dd></div>
            <div><dt className="text-[10px] uppercase text-zinc-400">Precio unit. con IGV</dt><dd className="font-semibold tabular-nums">{money(preview?.commercial_unit_price_with_tax, currencySymbol)}</dd></div>
            <div><dt className="text-[10px] uppercase text-zinc-400">Subtotal</dt><dd className="font-semibold tabular-nums">{money(preview?.commercial_subtotal, currencySymbol)}</dd></div>
            <div><dt className="text-[10px] uppercase text-zinc-400">IGV</dt><dd className="font-semibold tabular-nums">{money(preview?.tax_amount, currencySymbol)}</dd></div>
          </dl>
          {visibleWarnings.length ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{visibleWarnings.join(" · ")}</p> : null}
          {preview?.production_snapshot && Object.keys(preview.production_snapshot).length ? (
            <p className="text-[11px] text-zinc-500">Volumen {snapshotDecimal(preview.production_snapshot, "total_volume_cm3")} cm³ · Ocupación {snapshotDecimal(preview.production_snapshot, "occupancy_percentage")}%</p>
          ) : null}
        </div>
      ) : null}

      {creatingProduct !== null ? (
        <NuevaPiezaModal initialName={creatingProduct} onClose={() => setCreatingProduct(null)} onCreated={(product) => { onChange(itemFromProduct(product)); setCreatingProduct(null); }} />
      ) : null}
    </article>
  );
}
