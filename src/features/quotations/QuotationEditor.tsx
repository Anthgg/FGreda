import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import {
  DatePickerField,
  ProductSelectField,
  SelectField,
  TextField,
} from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { useConfirmedFiringLines } from "@/features/firings/useFirings";
import { formatDecimalString } from "@/features/firings/labels";
import { describeError } from "@/features/settings/messages";
import { useRecipe } from "@/features/recipes/useRecipes";
import {
  useAdditionals,
  useOtherCosts,
  useQuotationPreview,
  useTechniques,
} from "@/features/quotations/useQuotations";
import { RecipeSelectField } from "@/features/quotations/RecipeSelectField";
import { NuevoMaestroModal } from "@/features/quotations/NuevoMaestroModal";
import { NuevaPiezaModal } from "@/features/masters/NuevaPiezaModal";
import { useSession } from "@/features/auth/useSession";
import { draftToPayload, type QuotationDraft } from "@/features/quotations/draft";
import type { AdditionalCalculationOut, TechniqueCalculationOut } from "@/types/quotations";

const money = (value: string | null | undefined) => `S/ ${formatDecimalString(value, 2)}`;

function SummaryMetric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "border-t border-zinc-200 pt-3" : ""}>
      <dt className="text-[11px] text-zinc-500">{label}</dt>
      <dd className={strong ? "text-xl font-bold tabular-nums text-zinc-950" : "text-sm font-semibold tabular-nums text-zinc-900"}>
        {value}
      </dd>
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
      label: `Versión ${item.version_number} · ${item.status === "ACTIVE" ? "Activa" : item.status}`,
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
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="min-w-0 space-y-6">
        <section aria-labelledby="quote-main" className="rounded-2xl border border-zinc-200 bg-white/80 p-5">
          <div className="mb-4">
            <h2 id="quote-main" className="text-sm font-semibold text-zinc-950">Datos principales</h2>
            <p className="mt-1 text-xs text-zinc-500">El código CTZ y todos los importes los determina el backend.</p>
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
              label="Cantidad"
              requirement="required"
              value={value.quantity}
              onChange={(quantity) => update({ quantity })}
              inputMode="numeric"
              placeholder="Ej. 19"
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
              label="Precio vigente"
              requirement="automatic"
              value={preview.data?.current_sale_price_snapshot ?? null}
              onChange={() => undefined}
              readOnly
              disabled={!preview.data}
            />
          </div>
        </section>

        <section aria-labelledby="quote-materials" className="rounded-2xl border border-zinc-200 bg-white/80 p-5">
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
                  : "Gramos de receta que lleva una pieza. Vacío usa 1 g."
              }
            />
            <TextField
              label="Costo de materiales calculado"
              requirement="automatic"
              value={preview.data?.materials_calculated ?? null}
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
                {preview.data.materials_without_cost.map((material) => (
                  <li key={material}>{material}</li>
                ))}
              </ul>
              <p className="mt-2">
                Ponles el costo en{" "}
                <Link to="/productos" className="font-medium underline underline-offset-2">
                  Productos
                </Link>{" "}
                y vuelve a calcular.
              </p>
            </div>
          ) : null}
          {preview.data?.warnings.includes("RECIPE_REQUIRED") ? (
            <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              RECIPE_REQUIRED: elija una receta y su versión. Puede guardar un borrador, pero no confirmarlo.
            </p>
          ) : null}
          {preview.data?.warnings.includes("MATERIAL_GRAMS_PER_PIECE_REQUIRED") ? (
            <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Indique cuántos gramos de receta lleva una pieza: sin ese dato el costo de
              materiales no se puede calcular y la cotización no se podrá confirmar.
            </p>
          ) : null}
        </section>

        <section aria-labelledby="quote-firing" className="rounded-2xl border border-zinc-200 bg-white/80 p-5">
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

        <section aria-labelledby="quote-techniques" className="rounded-2xl border border-zinc-200 bg-white/80 p-5">
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
                className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-40"
                disabled={!techniqueToAdd}
                onClick={() => {
                  update({
                    techniques: [...value.techniques, { techniqueId: techniqueToAdd, quantity: value.quantity || "1", appliedCost: "", appliedDays: "" }],
                  });
                  setTechniqueToAdd("");
                }}
              >
                Añadir
              </button>
            </div>
          </div>
          {value.techniques.length === 0 ? (
            <p className="mt-5 rounded-xl bg-zinc-50 px-4 py-6 text-center text-xs text-zinc-500">No se añadieron técnicas.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {value.techniques.map((line, index) => {
                const master = techniques.data?.items.find((item) => String(item.id) === line.techniqueId);
                const calculated = techniquePreview.get(Number(line.techniqueId));
                return (
                  <TechniqueRow
                    key={line.techniqueId}
                    name={master?.name ?? calculated?.name_snapshot ?? "Técnica"}
                    line={line}
                    calculated={calculated}
                    onChange={(next) => update({ techniques: value.techniques.map((item, position) => position === index ? next : item) })}
                    onRemove={() => update({ techniques: value.techniques.filter((_, position) => position !== index) })}
                  />
                );
              })}
            </div>
          )}
        </section>

        <section aria-labelledby="quote-additionals" className="rounded-2xl border border-zinc-200 bg-white/80 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="quote-additionals" className="text-sm font-semibold text-zinc-950">Adicionales y vidriado</h2>
              <p className="mt-1 text-xs text-zinc-500">Cada línea explica la fórmula aplicada en lenguaje del taller.</p>
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
                className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-40"
                disabled={!additionalToAdd}
                onClick={() => {
                  update({ additionals: [...value.additionals, { additionalId: additionalToAdd, additionalQuantity: "", appliedCost: "" }] });
                  setAdditionalToAdd("");
                }}
              >
                Añadir
              </button>
            </div>
          </div>
          {value.additionals.length === 0 ? (
            <p className="mt-5 rounded-xl bg-zinc-50 px-4 py-6 text-center text-xs text-zinc-500">No se añadieron adicionales.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {value.additionals.map((line, index) => {
                const master = additionals.data?.items.find((item) => String(item.id) === line.additionalId);
                const calculated = additionalPreview.get(Number(line.additionalId));
                return (
                  <AdditionalRow
                    key={line.additionalId}
                    name={master?.name ?? calculated?.name_snapshot ?? "Adicional"}
                    line={line}
                    calculated={calculated}
                    onChange={(next) => update({ additionals: value.additionals.map((item, position) => position === index ? next : item) })}
                    onRemove={() => update({ additionals: value.additionals.filter((_, position) => position !== index) })}
                  />
                );
              })}
            </div>
          )}
        </section>

        <section aria-labelledby="quote-days" className="rounded-2xl border border-zinc-200 bg-white/80 p-5">
          <h2 id="quote-days" className="text-sm font-semibold text-zinc-950">Días y otros gastos</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TextField label="Días calculados" requirement="automatic" value={preview.data ? String(preview.data.calculated_days) : null} onChange={() => undefined} readOnly />
            <TextField label="Ajuste" value={value.daysAdjustment} onChange={(daysAdjustment) => update({ daysAdjustment })} inputMode="numeric" />
            <TextField label="Espera" value={value.waitingDays} onChange={(waitingDays) => update({ waitingDays })} inputMode="numeric" />
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
                  onChange={(appliedUnitPrice) => update({ otherCosts: value.otherCosts.map((item, position) => position === index ? { ...item, appliedUnitPrice } : item) })}
                  inputMode="decimal"
                  placeholder={master?.unit_price ?? calculated?.unit_price_snapshot ?? "0"}
                  hint={`Valor maestro: ${money(master?.unit_price ?? calculated?.unit_price_snapshot)} · Aplicado: ${money(calculated?.applied_cost)}`}
                />
              );
            })}
          </div>
          <div className="mt-5 max-w-xs">
            <TextField
              label="Factor comercial"
              value={value.commercialFactor}
              onChange={(commercialFactor) => update({ commercialFactor })}
              inputMode="decimal"
              placeholder={preview.data?.commercial_factor_default_snapshot ?? "2"}
              hint="Vacío utiliza el valor comercial configurado."
            />
          </div>
        </section>
      </div>

      <aside aria-label="Resumen de la cotización" className="xl:sticky xl:top-0 xl:self-start">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-950 p-5 text-white shadow-lg">
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
                <SummaryMetric label="Subtotal base" value={money(preview.data.base_commercial_cost)} />
                <SummaryMetric label="Factor comercial" value={preview.data.commercial_factor} />
                <SummaryMetric label="Costo espacio" value={money(preview.data.space_cost)} />
                <SummaryMetric label="Precio total sin IGV" value={money(preview.data.calculated_total)} strong />
                <SummaryMetric label="Precio unitario sin IGV" value={money(preview.data.calculated_unit_price)} strong />
                <SummaryMetric
                  label={`IGV (${formatDecimalString(preview.data.tax_percentage, 2)} %)`}
                  value={money(preview.data.tax_amount)}
                />
                <SummaryMetric label="Precio total con IGV" value={money(preview.data.total_with_tax)} strong />
                <SummaryMetric label="Precio unitario con IGV" value={money(preview.data.unit_price_with_tax)} strong />
              </dl>
              {preview.data.warnings.length > 0 ? (
                <div className="mt-5 rounded-xl border border-amber-700/50 bg-amber-950/30 p-3 text-xs text-amber-200">
                  {preview.data.warnings.join(" · ")}
                </div>
              ) : null}
              <div className="mt-4 text-[10px] leading-4 text-zinc-500">
                El precio se negocia sin IGV; el impuesto se muestra aparte para el documento
                que se entrega. No hay regla de descuento definida.
              </div>
            </>
          ) : null}
        </div>
      </aside>

      {/* Altas rápidas: lo creado se selecciona solo, para no perder el hilo. */}
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
