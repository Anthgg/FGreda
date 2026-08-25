import { useState } from "react";

import { ProductSelectField, SelectField, TextField } from "@/components/form";
import { formatDecimalString } from "@/features/firings/labels";
import { NuevaPiezaModal } from "@/features/masters/NuevaPiezaModal";
import { RecipeSelectField } from "@/features/quotations/RecipeSelectField";
import { useAdditionals, useOtherCosts, useTechniques } from "@/features/quotations/useQuotations";
import type { CotizadorItemDraft } from "@/features/cotizador/draft";
import { itemFromProduct } from "@/features/cotizador/draft";
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

const snapshotText = (snapshot: Record<string, unknown>, key: string) => {
  const value = snapshot[key];
  return value === null || value === undefined ? "—" : String(value);
};

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

  const patch = (values: Partial<CotizadorItemDraft>) => onChange({ ...item, ...values });
  const techniqueLabels = new Map((techniques.data?.items ?? []).map((value) => [String(value.id), value.name]));
  const additionalLabels = new Map((additionals.data?.items ?? []).map((value) => [String(value.id), value.name]));
  const otherCostLabels = new Map((otherCosts.data?.items ?? []).map((value) => [String(value.id), value.name]));

  const addSelection = (
    id: string,
    key: "techniqueIds" | "additionalIds" | "otherCostIds",
    reset: (value: string) => void,
  ) => {
    if (id && !item[key].includes(id)) patch({ [key]: [...item[key], id] });
    reset("");
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
                <p className="text-[11px] text-zinc-500">Sólo se habilitan datos ausentes en el maestro.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {DIMENSIONS.map(([field, label]) => {
                  const editable = item.editableDimensions.includes(field);
                  return (
                    <TextField
                      key={field}
                      label={label}
                      requirement={editable ? "required" : "automatic"}
                      value={item.dimensions[field]}
                      onChange={(value) => patch({ dimensions: { ...item.dimensions, [field]: value } })}
                      disabled={disabled || !editable}
                      readOnly={!editable}
                      inputMode="decimal"
                      hint={editable ? "Se completará una sola vez en Productos." : "Protegido por el maestro."}
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
          <div className="grid gap-4 lg:grid-cols-3">
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
            <RecipeSelectField
              label="Receta"
              requirement="automatic"
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
              requirement="required"
              value={item.materialGramsPerPiece}
              onChange={(materialGramsPerPiece) => patch({ materialGramsPerPiece })}
              disabled={disabled}
              inputMode="decimal"
              placeholder="Ej. 450"
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <TextField label="Ajuste de días" value={item.daysAdjustment} onChange={(daysAdjustment) => patch({ daysAdjustment })} disabled={disabled} inputMode="numeric" />
            <TextField label="Días de espera" value={item.waitingDays} onChange={(waitingDays) => patch({ waitingDays })} disabled={disabled} inputMode="numeric" />
            <div className="rounded-xl bg-zinc-50 p-3"><p className="text-[11px] text-zinc-500">Dimensiones resueltas</p><p className="mt-1 text-sm font-semibold tabular-nums">{item.dimensions.width || "—"} × {item.dimensions.length || "—"} × {item.dimensions.height || "—"} cm</p><p className="text-[10px] text-zinc-400">Sólo lectura en Producción</p></div>
          </div>
          <div className="space-y-3">
            <SelectField label="Agregar técnica productiva" value={techniqueToAdd} options={(techniques.data?.items ?? []).filter((x) => !item.techniqueIds.includes(String(x.id))).map((x) => ({ value: String(x.id), label: x.name }))} onChange={(id) => addSelection(id, "techniqueIds", setTechniqueToAdd)} disabled={disabled} placeholder="Elegir técnica…" />
            <SelectionChips ids={item.techniqueIds} labels={techniqueLabels} disabled={disabled} onRemove={(id) => patch({ techniqueIds: item.techniqueIds.filter((value) => value !== id) })} />
          </div>
          {preview?.production_snapshot && Object.keys(preview.production_snapshot).length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-zinc-50 p-3"><p className="text-[10px] uppercase text-zinc-400">Volumen</p><p className="font-semibold tabular-nums">{snapshotText(preview.production_snapshot, "total_volume_cm3")} cm³</p></div>
              <div className="rounded-xl bg-zinc-50 p-3"><p className="text-[10px] uppercase text-zinc-400">Ocupación</p><p className="font-semibold tabular-nums">{snapshotText(preview.production_snapshot, "occupancy_percentage")}%</p></div>
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
              <SelectField label="Agregar adicional" value={additionalToAdd} options={(additionals.data?.items ?? []).filter((x) => !item.additionalIds.includes(String(x.id))).map((x) => ({ value: String(x.id), label: x.name }))} onChange={(id) => addSelection(id, "additionalIds", setAdditionalToAdd)} disabled={disabled} placeholder="Elegir adicional…" />
              <SelectionChips ids={item.additionalIds} labels={additionalLabels} disabled={disabled} onRemove={(id) => patch({ additionalIds: item.additionalIds.filter((value) => value !== id) })} />
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
            <div className="rounded-xl bg-zinc-50 p-3"><p className="text-[11px] text-zinc-500">Espacio</p><p className="mt-1 text-sm font-bold tabular-nums">{money(preview?.space_cost, currencySymbol)}</p></div>
            <div className="rounded-xl bg-zinc-50 p-3"><p className="text-[11px] text-zinc-500">Costo unitario backend</p><p className="mt-1 text-base font-bold tabular-nums">{money(preview?.final_unit_cost, currencySymbol)}</p></div>
            <div className="rounded-xl bg-zinc-50 p-3"><p className="text-[11px] text-zinc-500">Costo total backend</p><p className="mt-1 text-base font-bold tabular-nums">{money(preview?.final_total_cost, currencySymbol)}</p></div>
          </div>
          {preview?.additionals.length ? (
            <div className="rounded-xl border border-zinc-200 p-3"><p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-zinc-400">Adicionales calculados por BGreda</p>{preview.additionals.map((line, lineIndex) => <p key={lineIndex} className="flex justify-between gap-3 text-xs"><span>{String(line.name_snapshot ?? `Adicional ${lineIndex + 1}`)}</span><span className="font-semibold tabular-nums">{money(String(line.applied_cost ?? "0"), currencySymbol)}</span></p>)}</div>
          ) : null}
        </div>
      ) : null}

      {mode === "MARGIN" ? (
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
          <TextField label="Markup (%)" requirement="required" value={item.markupPercent} onChange={(markupPercent) => patch({ markupPercent })} disabled={disabled} inputMode="decimal" />
          <TextField label="Precio comercial unitario" requirement="optional" value={item.commercialSaleUnitPrice} onChange={(commercialSaleUnitPrice) => patch({ commercialSaleUnitPrice })} disabled={disabled} inputMode="decimal" hint="Vacío: usa la sugerencia del backend." />
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-3"><p className="text-[11px] text-orange-800">Precio sugerido</p><p className="mt-1 text-base font-bold tabular-nums text-orange-950">{money(preview?.suggested_commercial_unit_price, currencySymbol)}</p></div>
          <div className="rounded-xl bg-zinc-950 p-3 text-white"><p className="text-[11px] text-zinc-400">Precio aplicado</p><p className="mt-1 text-base font-bold tabular-nums">{money(preview?.commercial_sale_unit_price, currencySymbol)}</p><p className="text-[10px] text-zinc-400">Utilidad: {money(preview?.effective_profit_total, currencySymbol)}</p></div>
        </div>
      ) : null}

      {mode === "SUMMARY" ? (
        <div className="space-y-4 p-4 sm:p-5">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div><dt className="text-[10px] uppercase text-zinc-400">Cantidad</dt><dd className="font-semibold tabular-nums">{preview?.quantity ?? (item.quantity || "—")}</dd></div>
            <div><dt className="text-[10px] uppercase text-zinc-400">Costo unit.</dt><dd className="font-semibold tabular-nums">{money(preview?.final_unit_cost, currencySymbol)}</dd></div>
            <div><dt className="text-[10px] uppercase text-zinc-400">Quema</dt><dd className="font-semibold tabular-nums">{money(preview?.firing_cost, currencySymbol)}</dd></div>
            <div><dt className="text-[10px] uppercase text-zinc-400">Precio unit.</dt><dd className="font-semibold tabular-nums">{money(preview?.commercial_sale_unit_price, currencySymbol)}</dd></div>
            <div><dt className="text-[10px] uppercase text-zinc-400">Subtotal</dt><dd className="font-semibold tabular-nums">{money(preview?.commercial_subtotal, currencySymbol)}</dd></div>
            <div><dt className="text-[10px] uppercase text-zinc-400">IGV</dt><dd className="font-semibold tabular-nums">{money(preview?.tax_amount, currencySymbol)}</dd></div>
          </dl>
          {preview?.warnings.length ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Pendiente: {preview.warnings.join(" · ")}</p> : null}
          {preview?.production_snapshot && Object.keys(preview.production_snapshot).length ? (
            <p className="text-[11px] text-zinc-500">Volumen {snapshotText(preview.production_snapshot, "total_volume_cm3")} cm³ · Ocupación {snapshotText(preview.production_snapshot, "occupancy_percentage")}%</p>
          ) : null}
        </div>
      ) : null}

      {creatingProduct !== null ? (
        <NuevaPiezaModal initialName={creatingProduct} onClose={() => setCreatingProduct(null)} onCreated={(product) => { onChange(itemFromProduct(product)); setCreatingProduct(null); }} />
      ) : null}
    </article>
  );
}
