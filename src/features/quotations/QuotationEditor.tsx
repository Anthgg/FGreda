import { useEffect, useMemo, useRef, useState } from "react";

import {
  DatePickerField,
  ProductSelectField,
  SelectField,
  TextField,
} from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { useConfirmedFiringLines } from "@/features/firings/useFirings";
import { formatDecimalString } from "@/features/firings/labels";
import { describeWarnings } from "@/features/quotations/domainWarnings";
import { describeError } from "@/features/settings/messages";
import { useRecipe } from "@/features/recipes/useRecipes";
import {
  useAdditionals,
  useOtherCosts,
  useQuotationPreview,
  useTechniques,
} from "@/features/quotations/useQuotations";
import { VERSION_STATUS_LABEL } from "@/features/recipes/labels";
import { RecipeSelectField } from "@/features/quotations/RecipeSelectField";
import { NuevoMaestroModal } from "@/features/quotations/NuevoMaestroModal";
import { NuevaPiezaModal } from "@/features/masters/NuevaPiezaModal";
import { CustomerSelectField } from "@/features/quotations/CustomerSelectField";
import { useSession } from "@/features/auth/useSession";
import { draftToPayload, type QuotationDraft } from "@/features/quotations/draft";
import type { AdditionalCalculationOut, TechniqueCalculationOut } from "@/types/quotations";
import { formatMoney } from "@/features/quotations/money";

/** Via heredada: siempre en soles, que es la moneda base del sistema. */
const money = (value: string | null | undefined) => formatMoney(value, "PEN");

function SummaryMetric({
  label,
  value,
  strong = false,
  subtitle,
}: {
  label: string;
  value: string;
  strong?: boolean | undefined;
  subtitle?: string | undefined;
}) {
  return (
    <div className={strong ? "border-t border-zinc-700/60 pt-3" : ""}>
      <dt className="text-[11px] text-zinc-400">{label}</dt>
      <dd className={strong ? "text-xl font-bold tabular-nums text-white" : "text-sm font-semibold tabular-nums text-zinc-100"}>
        {value}
      </dd>
      {subtitle ? <p className="text-[10px] text-zinc-500 tabular-nums">{subtitle}</p> : null}
    </div>
  );
}

export function QuotationEditor({
  value,
  onChange,
}: {
  value: QuotationDraft;
  onChange: (draft: QuotationDraft) => void;
}) {
  const productId = /^[1-9]\d*$/.test(value.productId) ? Number(value.productId) : null;
  const recipeId = /^[1-9]\d*$/.test(value.recipeId) ? Number(value.recipeId) : null;
  const recipe = useRecipe(recipeId);
  const firingLines = useConfirmedFiringLines({
    ...(productId ? { product_id: productId } : {}),
    limit: 100,
  });
  const techniques = useTechniques(true);
  const additionals = useAdditionals(true);
  const otherCosts = useOtherCosts(true);
  const otherCostsInitialized = useRef(value.otherCosts.length > 0);
  const { data: sessionUser } = useSession();
  const isAdmin = sessionUser?.role === "ADMIN";
  const [creandoPieza, setCreandoPieza] = useState<string | null>(null);
  const [creandoMaestro, setCreandoMaestro] = useState<
    { tipo: "technique" | "additional"; nombre: string } | null
  >(null);
  const [techniqueToAdd, setTechniqueToAdd] = useState("");
  const [additionalToAdd, setAdditionalToAdd] = useState("");

  useEffect(() => {
    if (!otherCosts.data || otherCostsInitialized.current) return;
    otherCostsInitialized.current = true;
    if (otherCosts.data.items.length === 0) return;
    onChange({
      ...value,
      otherCosts: otherCosts.data.items.map((item) => ({
        otherCostId: String(item.id),
        appliedUnitPrice: "",
      })),
    });
  }, [onChange, otherCosts.data, value]);

  const versionRows = recipe.data?.versions ??
    (recipe.data?.current_version ? [recipe.data.current_version] : []);
  const versionOptions = versionRows
    .filter((item) => item.status === "ACTIVE")
    .map((item) => ({
      value: String(item.id),
      // El catalogo central, no un ternario: la rama `else` enseñaba el
      // codigo crudo (`ARCHIVED`) si alguien aflojaba el filtro de arriba.
      label: `Versión ${item.version_number} · ${VERSION_STATUS_LABEL[item.status]}`,
    }));
  const firingLineOptions = (firingLines.data?.items ?? []).map((line) => ({
    value: String(line.id),
    label: `${line.firing_code} · ${line.firing_date ?? "Sin fecha"} · ${line.description} · ${money(line.allocated_cost)}`,
  }));

  const immediatePayload = useMemo(() => draftToPayload(value), [value]);
  const [previewPayload, setPreviewPayload] = useState(immediatePayload);
  useEffect(() => {
    const timer = window.setTimeout(() => setPreviewPayload(immediatePayload), 350);
    return () => window.clearTimeout(timer);
  }, [immediatePayload]);
  const preview = useQuotationPreview(previewPayload);

  const update = (patch: Partial<QuotationDraft>) => onChange({ ...value, ...patch });
  const techniquePreview = new Map(
    (preview.data?.techniques ?? []).map((line) => [line.technique_id, line]),
  );
  const additionalPreview = new Map(
    (preview.data?.additionals ?? []).map((line) => [line.additional_id, line]),
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        {/* SECCION 1: Cliente y Datos Principales */}
        <section aria-labelledby="quote-client" className="rounded-2xl border border-zinc-200 bg-white/80 p-5 shadow-xs">
          <div className="mb-4">
            <h2 id="quote-client" className="text-sm font-semibold text-zinc-950">Cliente y datos generales</h2>
            <p className="mt-1 text-xs text-zinc-500">Asigne el cliente y el nombre o referencia de la cotización.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <CustomerSelectField
              value={value.customerId}
              labelValue={value.customerLabel}
              onChange={(customerId, customerLabel) => update({ customerId, customerLabel })}
            />
            <TextField
              label="Nombre / Referencia de la cotización"
              requirement="optional"
              value={value.name}
              onChange={(name) => update({ name })}
              placeholder="Ej: Pedido Especial Restaurante Lima"
            />
          </div>
        </section>

        {/* SECCION 2: Pieza y Dimensiones Tecnicas */}
        <section aria-labelledby="quote-main" className="rounded-2xl border border-zinc-200 bg-white/80 p-5 shadow-xs">
          <div className="mb-4">
            <h2 id="quote-main" className="text-sm font-semibold text-zinc-950">Pieza y dimensiones</h2>
            <p className="mt-1 text-xs text-zinc-500">Seleccione la pieza terminada. Sus dimensiones técnicas se cargan automáticamente.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ProductSelectField
              label="Producto"
              requirement="required"
              value={value.productId}
              selectedLabel={value.productLabel}
              productType="FINISHED_PRODUCT"
              placeholder="Buscar producto terminado…"
              allowCreate={isAdmin}
              onCreateRequested={(texto) => setCreandoPieza(texto)}
              createLabel={(texto) => `+ Crear pieza «${texto}»`}
              onChange={(next, product) =>
                update({
                  productId: next,
                  productLabel: product ? `${product.internal_reference} · ${product.name}` : "",
                  recipeId: "",
                  recipeVersionId: "",
                  firingLineId: "",
                })
              }
            />
            <TextField
              label="Cantidad a cotizar"
              requirement="required"
              value={value.quantity}
              onChange={(quantity) => update({ quantity })}
              inputMode="numeric"
              placeholder="Ej. 20"
              error={value.quantity && !/^[1-9]\d*$/.test(value.quantity) ? "Ingrese un entero mayor que cero." : undefined}
            />
            <DatePickerField
              label="Fecha"
              requirement="automatic"
              value={value.displayDate}
              onChange={(displayDate) => update({ displayDate })}
              disabled
              hint="Se registra automáticamente al guardar la cotización."
            />
            <TextField
              label="Precio vigente de lista"
              requirement="automatic"
              value={preview.data?.current_sale_price_snapshot ? money(preview.data.current_sale_price_snapshot) : "Sin precio previo"}
              onChange={() => undefined}
              readOnly
              disabled={!preview.data}
            />
          </div>

          {/* Tarjeta de Dimensiones Tecnicas (Solo Lectura) */}
          {preview.data ? (
            <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50/80 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-zinc-900">Especificaciones técnicas de la pieza</span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 bg-zinc-200/60 px-2 py-0.5 rounded">Solo lectura</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-zinc-600">
                <div>
                  <span className="block text-[10px] text-zinc-400">Material / Pasta:</span>
                  <span className="font-medium text-zinc-900">{preview.data.product_material_snapshot || "No especificado"}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-zinc-400">Gramaje:</span>
                  <span className="font-medium text-zinc-900">{preview.data.product_grammage_snapshot ? `${preview.data.product_grammage_snapshot} g` : "—"}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="block text-[10px] text-zinc-400">Dimensiones (Ancho × Alto × Largo × Prof.):</span>
                  <span className="font-medium text-zinc-900">
                    {preview.data.product_width_snapshot ?? "0"} × {preview.data.product_height_snapshot ?? "0"} × {preview.data.product_length_snapshot ?? "0"} × {preview.data.product_depth_snapshot ?? "0"} cm
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {/* SECCION 3: Variables Productivas y Quema */}
        <section aria-labelledby="quote-materials" className="rounded-2xl border border-zinc-200 bg-white/80 p-5 shadow-xs">
          <h2 id="quote-materials" className="text-sm font-semibold text-zinc-950">Materiales y receta</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <RecipeSelectField
              label="Receta"
              requirement="required"
              value={value.recipeId}
              selectedLabel={value.recipeLabel}
              onChange={(recipeId, recipe) =>
                update({
                  recipeId,
                  recipeLabel: recipe ? `${recipe.product_internal_reference} · ${recipe.name}` : "",
                  recipeVersionId: "",
                })
              }
              hint="Receta del material con el que se hace la pieza."
            />
            <SelectField
              label="Versión"
              requirement="required"
              value={value.recipeVersionId}
              options={versionOptions}
              onChange={(recipeVersionId) => update({ recipeVersionId })}
              disabled={!recipeId || recipe.isPending}
              placeholder="Elegir versión activa"
            />
            <TextField
              label="Material por pieza (g)"
              value={value.materialGramsPerPiece}
              onChange={(materialGramsPerPiece) => update({ materialGramsPerPiece })}
              inputMode="decimal"
              placeholder="1"
              hint={
                preview.data
                  ? `${preview.data.quantity} piezas × ${formatDecimalString(preview.data.material_grams_per_piece, 2)} g = ${formatDecimalString(preview.data.material_total_grams, 2)} g de receta.`
                  : value.recipeId
                    ? "Obligatorio para calcular el costo de materiales."
                    : "Peso de material de receta utilizado por cada pieza."
              }
            />
            <TextField
              label="Costo de materiales calculado"
              requirement="automatic"
              value={money(preview.data?.materials_calculated)}
              onChange={() => undefined}
              readOnly
              hint="Lo que cuesta esa cantidad de receta."
            />
            <TextField
              label="Costo de materiales a usar en el precio"
              requirement="optional"
              value={value.materialsApplied}
              onChange={(materialsApplied) => update({ materialsApplied })}
              inputMode="decimal"
              placeholder={preview.data?.materials_calculated ?? "Calculado por receta"}
              hint={value.materialsApplied ? "Ajustado a mano: se conservan el calculado y el aplicado." : "Vacío usa el costo calculado de arriba."}
            />
          </div>
          {preview.data && preview.data.materials_without_cost.length > 0 ? (
            <div role="alert" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-xs text-amber-900">
              <p className="font-medium">
                Estos materiales de la receta no tienen precio, así que suman cero al costo:
              </p>
              <ul className="mt-1 list-disc pl-5">
                {preview.data.materials_without_cost.map((mat) => (
                  <li key={mat}>{mat}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {preview.data?.warnings.includes("RECIPE_REQUIRED") ? (
            <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              RECIPE_REQUIRED: elija una receta y su versión. Puede guardar un borrador, pero no confirmarlo.
            </p>
          ) : null}
          {preview.data?.warnings.includes("MATERIAL_GRAMS_PER_PIECE_REQUIRED") ? (
            <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Indique cuántos gramos de receta lleva una pieza: sin ese dato el costo de materiales no se puede calcular.
            </p>
          ) : null}
        </section>

        {/* Quema */}
        <section aria-labelledby="quote-firing" className="rounded-2xl border border-zinc-200 bg-white/80 p-5 shadow-xs">
          <h2 id="quote-firing" className="text-sm font-semibold text-zinc-950">Quema confirmada</h2>
          <div className="mt-4">
            <SelectField
              label="Línea de quema"
              requirement="required"
              value={value.firingLineId}
              options={firingLineOptions}
              onChange={(firingLineId) => update({ firingLineId })}
              disabled={!productId || firingLines.isPending}
              placeholder="Elegir línea compatible"
              hint="Solo se muestran líneas confirmadas del producto seleccionado."
            />
          </div>
          {productId && !firingLines.isPending && firingLineOptions.length === 0 ? (
            <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              FIRING_LINE_REQUIRED: no hay una línea confirmada compatible. El borrador no podrá confirmarse.
            </p>
          ) : null}
        </section>

        {/* Tecnicas */}
        <section aria-labelledby="quote-techniques" className="rounded-2xl border border-zinc-200 bg-white/80 p-5 shadow-xs">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="quote-techniques" className="text-sm font-semibold text-zinc-950">Técnicas</h2>
              <p className="mt-1 text-xs text-zinc-500">Los días y costos propuestos vienen del simulador del backend.</p>
            </div>
            <div className="flex min-w-[18rem] items-end gap-2">
              <SelectField
                label="Añadir técnica"
                value={techniqueToAdd}
                options={(techniques.data?.items ?? [])
                  .filter((item) => !value.techniques.some((line) => line.techniqueId === String(item.id)))
                  .map((item) => ({ value: String(item.id), label: item.name }))}
                onChange={setTechniqueToAdd}
                allowCreate={isAdmin}
                onCreateRequested={(nombre) => setCreandoMaestro({ tipo: "technique", nombre })}
                createLabel={(nombre) => `+ Crear técnica «${nombre}»`}
                className="min-w-0 flex-1"
              />
              <button
                type="button"
                className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-40 hover:bg-zinc-800 transition-colors"
                disabled={!techniqueToAdd}
                onClick={() => {
                  if (!techniqueToAdd) return;
                  update({
                    techniques: [
                      ...value.techniques,
                      { techniqueId: techniqueToAdd, quantity: value.quantity || "1", appliedDays: "", appliedCost: "" },
                    ],
                  });
                  setTechniqueToAdd("");
                }}
              >
                Añadir
              </button>
            </div>
          </div>
          {value.techniques.length === 0 ? (
            <p className="mt-4 text-xs text-zinc-400">Sin técnicas añadidas a esta cotización.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {value.techniques.map((line, index) => {
                const master = techniques.data?.items.find((item) => String(item.id) === line.techniqueId);
                const calculated = techniquePreview.get(Number(line.techniqueId));
                return (
                  <TechniqueRow
                    key={line.techniqueId}
                    name={master?.name ?? calculated?.name_snapshot ?? `Técnica #${line.techniqueId}`}
                    line={line}
                    calculated={calculated}
                    onChange={(updatedLine) =>
                      update({
                        techniques: value.techniques.map((item, pos) => (pos === index ? updatedLine : item)),
                      })
                    }
                    onRemove={() => update({ techniques: value.techniques.filter((_, pos) => pos !== index) })}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* Adicionales */}
        <section aria-labelledby="quote-additionals" className="rounded-2xl border border-zinc-200 bg-white/80 p-5 shadow-xs">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="quote-additionals" className="text-sm font-semibold text-zinc-950">Adicionales</h2>
              <p className="mt-1 text-xs text-zinc-500">Mano de obra y acabados adicionales.</p>
            </div>
            <div className="flex min-w-[18rem] items-end gap-2">
              <SelectField
                label="Añadir adicional"
                value={additionalToAdd}
                options={(additionals.data?.items ?? [])
                  .filter((item) => !value.additionals.some((line) => line.additionalId === String(item.id)))
                  .map((item) => ({ value: String(item.id), label: item.name }))}
                onChange={setAdditionalToAdd}
                allowCreate={isAdmin}
                onCreateRequested={(nombre) => setCreandoMaestro({ tipo: "additional", nombre })}
                createLabel={(nombre) => `+ Crear adicional «${nombre}»`}
                className="min-w-0 flex-1"
              />
              <button
                type="button"
                className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-40 hover:bg-zinc-800 transition-colors"
                disabled={!additionalToAdd}
                onClick={() => {
                  if (!additionalToAdd) return;
                  update({
                    additionals: [
                      ...value.additionals,
                      { additionalId: additionalToAdd, additionalQuantity: "", appliedCost: "" },
                    ],
                  });
                  setAdditionalToAdd("");
                }}
              >
                Añadir
              </button>
            </div>
          </div>
          {value.additionals.length === 0 ? (
            <p className="mt-4 text-xs text-zinc-400">Sin adicionales añadidos a esta cotización.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {value.additionals.map((line, index) => {
                const master = additionals.data?.items.find((item) => String(item.id) === line.additionalId);
                const calculated = additionalPreview.get(Number(line.additionalId));
                return (
                  <AdditionalRow
                    key={line.additionalId}
                    name={master?.name ?? calculated?.name_snapshot ?? `Adicional #${line.additionalId}`}
                    line={line}
                    calculated={calculated}
                    onChange={(updatedLine) =>
                      update({
                        additionals: value.additionals.map((item, pos) => (pos === index ? updatedLine : item)),
                      })
                    }
                    onRemove={() => update({ additionals: value.additionals.filter((_, pos) => pos !== index) })}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* Dias y Otros Gastos */}
        <section aria-labelledby="quote-days" className="rounded-2xl border border-zinc-200 bg-white/80 p-5 shadow-xs">
          <h2 id="quote-days" className="text-sm font-semibold text-zinc-950">Días y otros gastos de espacio</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TextField label="Días calculados" requirement="automatic" value={preview.data ? String(preview.data.calculated_days) : null} onChange={() => undefined} readOnly />
            <TextField label="Ajuste de días" value={value.daysAdjustment} onChange={(daysAdjustment) => update({ daysAdjustment })} inputMode="numeric" />
            <TextField label="Días de espera" value={value.waitingDays} onChange={(waitingDays) => update({ waitingDays })} inputMode="numeric" />
            <TextField label="Días totales" requirement="automatic" value={preview.data ? String(preview.data.total_days) : null} onChange={() => undefined} readOnly />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {value.otherCosts.map((line, index) => {
              const master = otherCosts.data?.items.find((item) => String(item.id) === line.otherCostId);
              const calculated = preview.data?.other_costs.find((item) => String(item.other_cost_id) === line.otherCostId);
              return (
                <TextField
                  key={line.otherCostId}
                  label={master?.name ?? calculated?.name_snapshot ?? "Otro gasto"}
                  value={line.appliedUnitPrice}
                  onChange={(appliedUnitPrice) => update({ otherCosts: value.otherCosts.map((item, pos) => pos === index ? { ...item, appliedUnitPrice } : item) })}
                  inputMode="decimal"
                  placeholder={master?.unit_price ?? calculated?.unit_price_snapshot ?? "0"}
                  hint={`Valor maestro: ${money(master?.unit_price ?? calculated?.unit_price_snapshot)} · Aplicado: ${money(calculated?.applied_cost)}`}
                />
              );
            })}
          </div>
        </section>

        {/* SECCION 4: Costeo, Ganancia y Precio Comercial */}
        <section aria-labelledby="quote-pricing" className="rounded-2xl border border-zinc-200 bg-white/80 p-5 shadow-xs">
          <div className="mb-4">
            <h2 id="quote-pricing" className="text-sm font-semibold text-zinc-950">Costeo interno, ganancia y precio comercial</h2>
            <p className="mt-1 text-xs text-zinc-500">Defina el margen objetivo y el precio de venta comercial.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Costo interno */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3.5">
              <span className="text-[11px] font-medium text-zinc-500 block">Costo interno total</span>
              <span className="text-base font-bold text-zinc-900 tabular-nums">{money(preview.data?.final_total_cost)}</span>
              <p className="text-[10px] text-zinc-400 mt-0.5">Unitario: {money(preview.data?.final_unit_cost)}</p>
            </div>

            {/* Margen deseado % */}
            <TextField
              label="Ganancia deseada (%)"
              requirement="optional"
              value={value.markupPercent}
              onChange={(markupPercent) => update({ markupPercent })}
              inputMode="decimal"
              placeholder="100"
              hint={preview.data ? `Ganancia objetivo: ${money(preview.data.target_profit_unit)} / u` : "Por omisión 100% sobre costo."}
            />

            {/* Precio sugerido */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3.5">
              <span className="text-[11px] font-medium text-zinc-500 block">Precio comercial sugerido (a 0.50)</span>
              <span className="text-base font-bold text-zinc-900 tabular-nums">{money(preview.data?.suggested_commercial_unit_price)}</span>
              <p className="text-[10px] text-zinc-400 mt-0.5">Calculado: {money(preview.data?.calculated_sale_unit_price)}</p>
            </div>

            {/* Precio comercial editable */}
            <div className="sm:col-span-2 lg:col-span-3">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Precio comercial unitario final (S/)"
                  requirement="optional"
                  value={value.commercialSaleUnitPrice}
                  onChange={(commercialSaleUnitPrice) => update({ commercialSaleUnitPrice })}
                  inputMode="decimal"
                  placeholder={preview.data?.suggested_commercial_unit_price ?? "Sugerido"}
                  hint={value.commercialSaleUnitPrice ? "Precio personalizado fijado por el usuario." : "Vacío utiliza el precio sugerido redondeado a S/ 0.50."}
                />

                {/* Ganancia efectiva en tiempo real */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 flex flex-col justify-center">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-950">Ganancia efectiva real</span>
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                      {formatDecimalString(preview.data?.effective_markup_percent, 2)} % margen
                    </span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-lg font-bold text-emerald-900 tabular-nums">
                      {money(preview.data?.effective_profit_unit)}
                    </span>
                    <span className="text-xs text-emerald-700">/ pieza ({money(preview.data?.effective_profit_total)} total)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* BARRA LATERAL DE RESUMEN COMERCIAL */}
      <aside aria-label="Resumen de la cotización" className="xl:sticky xl:top-0 xl:self-start">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-white shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Resumen</h2>
            {preview.isFetching ? <Spinner className="size-4 text-white" label="Calculando…" /> : null}
          </div>
          {!previewPayload ? (
            <p className="mt-5 text-xs leading-5 text-zinc-400">Complete producto, cantidad y valores enteros para obtener la vista previa.</p>
          ) : preview.isError ? (
            <p role="alert" className="mt-5 rounded-xl bg-red-950/50 p-3 text-xs text-red-200">{describeError(preview.error)}</p>
          ) : preview.data ? (
            <>
              <dl className="mt-5 grid grid-cols-2 gap-4">
                <SummaryMetric label="Materiales" value={money(preview.data.materials_applied)} />
                <SummaryMetric label="Quema" value={money(preview.data.firing_cost)} />
                <SummaryMetric label="Mano de obra" value={money(preview.data.labor_cost)} />
                <SummaryMetric label="Costo espacio" value={money(preview.data.space_cost)} />
                <SummaryMetric
                  label="Costo unitario interno"
                  value={money(preview.data.final_unit_cost || preview.data.base_commercial_cost)}
                  subtitle={`Total: ${money(preview.data.final_total_cost || preview.data.base_commercial_cost)}`}
                />
                <SummaryMetric
                  label="Margen sobre costo"
                  value={`${formatDecimalString(preview.data.effective_markup_percent ?? preview.data.markup_percent ?? "100", 2)} %`}
                  subtitle={preview.data.markup_percent ? `Obj: ${formatDecimalString(preview.data.markup_percent, 2)} %` : undefined}
                />
                <SummaryMetric
                  label="Precio unitario neto"
                  value={money(preview.data.commercial_sale_unit_price || preview.data.calculated_unit_price)}
                  strong
                />
                <SummaryMetric
                  label="Subtotal comercial"
                  value={money(preview.data.subtotal)}
                  strong
                />
                <SummaryMetric
                  label={`IGV (${formatDecimalString(preview.data.tax_percentage, 2)} %)`}
                  value={money(preview.data.tax_amount)}
                />
                <SummaryMetric
                  label="Ganancia efectiva total"
                  value={money(preview.data.effective_profit_total || "0")}
                  subtitle={preview.data.effective_profit_unit ? `Unit: ${money(preview.data.effective_profit_unit)}` : undefined}
                />
                <div className="col-span-2">
                  <SummaryMetric
                    label="TOTAL COMERCIAL CON IGV"
                    value={money(preview.data.total)}
                    strong
                    subtitle={`Unitario con IGV: ${money(preview.data.commercial_unit_price_with_tax || preview.data.unit_price_with_tax)}`}
                  />
                </div>
              </dl>
              {describeWarnings(preview.data.warnings).length > 0 ? (
                <ul className="mt-5 space-y-1 rounded-xl border border-amber-700/50 bg-amber-950/30 p-3 text-xs text-amber-200">
                  {describeWarnings(preview.data.warnings).map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-4 text-[10px] leading-4 text-zinc-500">
                La cotización se emite sobre el precio comercial acordado con el cliente. El IGV se detalla para el comprobante de pago.
              </div>
            </>
          ) : null}
        </div>
      </aside>

      {/* Modales de alta rapida */}
      {creandoPieza !== null ? (
        <NuevaPiezaModal
          initialName={creandoPieza}
          onClose={() => setCreandoPieza(null)}
          onCreated={(product) => {
            update({
              productId: String(product.id),
              productLabel: `${product.internal_reference} · ${product.name}`,
              recipeId: "",
              recipeVersionId: "",
              firingLineId: "",
            });
            setCreandoPieza(null);
          }}
        />
      ) : null}

      {creandoMaestro !== null ? (
        <NuevoMaestroModal
          tipo={creandoMaestro.tipo}
          initialName={creandoMaestro.nombre}
          onClose={() => setCreandoMaestro(null)}
          onCreated={(item) => {
            if (creandoMaestro.tipo === "technique") {
              onChange({
                ...value,
                techniques: [
                  ...value.techniques,
                  { techniqueId: String(item.id), quantity: value.quantity, appliedDays: "", appliedCost: "" },
                ],
              });
            } else {
              onChange({
                ...value,
                additionals: [
                  ...value.additionals,
                  { additionalId: String(item.id), additionalQuantity: "", appliedCost: "" },
                ],
              });
            }
            setCreandoMaestro(null);
          }}
        />
      ) : null}
    </div>
  );
}

function TechniqueRow({
  name,
  line,
  calculated,
  onChange,
  onRemove,
}: {
  name: string;
  line: QuotationDraft["techniques"][number];
  calculated: TechniqueCalculationOut | undefined;
  onChange: (line: QuotationDraft["techniques"][number]) => void;
  onRemove: () => void;
}) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-900">{name}</h3>
        <button type="button" onClick={onRemove} className="text-xs font-medium text-red-600 hover:text-red-800">Quitar</button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextField label="Cantidad" value={line.quantity} onChange={(quantity) => onChange({ ...line, quantity })} inputMode="numeric" />
        <TextField label="Días aplicados" value={line.appliedDays} onChange={(appliedDays) => onChange({ ...line, appliedDays })} inputMode="numeric" placeholder={calculated ? String(calculated.proposed_days) : "Propuesto"} />
        <TextField label="Costo aplicado" value={line.appliedCost} onChange={(appliedCost) => onChange({ ...line, appliedCost })} inputMode="decimal" placeholder={calculated?.proposed_cost ?? "Propuesto"} />
        <div className="rounded-xl bg-white px-3 py-2 text-xs text-zinc-600">
          <div>Precio {money(calculated?.unit_price_snapshot)}</div>
          <div>Factores {calculated?.factor_1_snapshot ?? "—"}{calculated?.factor_2_snapshot ? ` / ${calculated.factor_2_snapshot}` : ""}</div>
          <div>Propuesto {calculated?.proposed_days ?? "—"} días · {money(calculated?.proposed_cost)}</div>
        </div>
      </div>
    </article>
  );
}

function AdditionalRow({
  name,
  line,
  calculated,
  onChange,
  onRemove,
}: {
  name: string;
  line: QuotationDraft["additionals"][number];
  calculated: AdditionalCalculationOut | undefined;
  onChange: (line: QuotationDraft["additionals"][number]) => void;
  onRemove: () => void;
}) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">{name}</h3>
          <p className="mt-0.5 text-xs text-zinc-500">{calculated?.formula_explanation ?? "El backend mostrará la fórmula al calcular."}</p>
        </div>
        <button type="button" onClick={onRemove} className="text-xs font-medium text-red-600 hover:text-red-800">Quitar</button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <TextField label="Cantidad adicional" value={line.additionalQuantity} onChange={(additionalQuantity) => onChange({ ...line, additionalQuantity })} inputMode="decimal" />
        <TextField label="Costo aplicado" value={line.appliedCost} onChange={(appliedCost) => onChange({ ...line, appliedCost })} inputMode="decimal" placeholder={calculated?.proposed_cost ?? "Propuesto"} />
        <div className="rounded-xl bg-white px-3 py-2 text-xs text-zinc-600">
          <div>Precio {money(calculated?.unit_price_snapshot)}</div>
          <div>Factor {calculated?.factor_1_snapshot ?? "—"}</div>
          <div>Propuesto {money(calculated?.proposed_cost)}</div>
        </div>
      </div>
    </article>
  );
}
