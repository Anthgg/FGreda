/**
 * Cotizador de Prototipos.
 *
 * Hermano del Cotizador principal, no una aplicación aparte: reutiliza su
 * stepper, su cabecera, su pie de navegación, sus campos y sus insignias. Un
 * segundo sistema de diseño obligaría a mantener dos, y el día que cambie uno
 * el otro se quedaría atrás.
 *
 * **La pantalla no calcula dinero.** Ni un importe, ni el IGV, ni el
 * redondeo, ni el plazo salen de aquí: todo llega del `preview` del backend y
 * esta pantalla lo presenta. Por eso el desglose es texto ya formateado y no
 * hay una sola operación aritmética sobre importes.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { SelectField } from "@/components/SelectField";
import { Spinner } from "@/components/Spinner";
import { TypewriterTitle } from "@/components/TypewriterTitle";
import { PrimaryButton, SecondaryButton, TextAreaField, TextField } from "@/components/form";
import { CustomerSelectField } from "@/features/quotations/CustomerSelectField";
import { useKilns } from "@/features/firings/useFirings";
import { useConsumableProducts, useProducts } from "@/features/masters/useMasters";
import { Badge } from "@/features/masters/MasterTable";
import { prototypeQuotationPdfUrl } from "@/api/prototypeQuotations";
import {
  useConfirmPrototypeQuotation,
  useCreatePrototypeQuotation,
  useMarkPrototypeQuotationPaid,
  usePrototypeQuotation,
  usePrototypeQuotationPreview,
  useUpdatePrototypeQuotation,
} from "@/features/prototypeQuotations/usePrototypeQuotations";
import { describeError } from "@/features/settings/messages";
import { formatMoney } from "@/features/quotations/money";
import type {
  FiringType,
  PrototypeCostBreakdown,
  PrototypeQuotationDraftInput,
} from "@/types/prototypeQuotations";

const STEPS = [
  { label: "Datos", hint: "Cliente y moneda" },
  { label: "Prototipo", hint: "Producto o concepto nuevo" },
  { label: "Trabajo", hint: "Diseño, artista y matricero" },
  { label: "Materiales", hint: "Insumos y cantidades" },
  { label: "Quema", hint: "Horno, hornadas y espera" },
  { label: "Costeo", hint: "Cálculo del backend" },
  { label: "Resumen", hint: "Revisar y emitir" },
] as const;

const STATUS_LABEL = { DRAFT: "Borrador", CONFIRMED: "Emitida", CANCELLED: "Anulada" } as const;
const STATUS_TONE = { DRAFT: "warning", CONFIRMED: "positive", CANCELLED: "neutral" } as const;

const FIRING_OPTIONS = [
  { value: "LOW", label: "Baja" },
  { value: "HIGH", label: "Alta" },
];

interface MaterialRow {
  product_id: number;
  quantity_per_prototype: string;
  is_body_material: boolean;
}

function emptyDraft(): PrototypeQuotationDraftInput {
  return {
    customer_id: null,
    product_id: null,
    description: "",
    quantity: 1,
    design_days: "0",
    artist_days: "0",
    mold_maker_days: "0",
    firing_batches: 0,
    drying_days: "0",
    adjustment_days: "0",
    materials: [],
  };
}

/** Vacío significa «usa la tarifa de la casa», y por eso no se rellena solo. */
function orNull(value: string): string | null {
  return value.trim() ? value.trim() : null;
}

export function PrototypeQuoterPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const quotationId = id ? Number(id) : null;

  const query = usePrototypeQuotation(quotationId);
  const persisted = query.data ?? null;

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<PrototypeQuotationDraftInput>(emptyDraft);
  const [customerLabel, setCustomerLabel] = useState("");
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [costing, setCosting] = useState<PrototypeCostBreakdown | null>(null);

  const preview = usePrototypeQuotationPreview();
  const create = useCreatePrototypeQuotation();
  const update = useUpdatePrototypeQuotation(quotationId ?? 0);
  const confirm = useConfirmPrototypeQuotation(quotationId ?? 0);
  const markPaid = useMarkPrototypeQuotationPaid(quotationId ?? 0);

  const kilns = useKilns();
  const products = useProducts({ active: true, limit: 200 });
  const consumables = useConsumableProducts().items;

  const readOnly = persisted !== null && persisted.status !== "DRAFT";
  const busy =
    create.isPending || update.isPending || confirm.isPending || markPaid.isPending;
  const error = create.error ?? update.error ?? confirm.error ?? markPaid.error ?? preview.error;

  // Al abrir una guardada, el formulario se rellena con lo que hay en el
  // servidor. Nunca al revés: la pantalla no es la fuente de nada.
  useEffect(() => {
    if (!persisted) return;
    setDraft({
      customer_id: persisted.customer_id,
      product_id: persisted.product_id,
      description: persisted.description,
      quantity: persisted.quantity,
      width_cm: persisted.width_cm,
      length_cm: persisted.length_cm,
      height_cm: persisted.height_cm,
      depth_cm: persisted.depth_cm,
      notes: persisted.notes,
      design_days: persisted.design_days,
      design_rate_override: persisted.design_rate_override,
      artist_days: persisted.artist_days,
      artist_rate_override: persisted.artist_rate_override,
      mold_maker_price_override: persisted.mold_maker_price_override,
      mold_maker_days: persisted.mold_maker_days,
      kiln_id: persisted.kiln_id,
      firing_type: persisted.firing_type,
      firing_batches: persisted.firing_batches,
      drying_days: persisted.drying_days,
      adjustment_days: persisted.adjustment_days,
      fixed_cost_override: persisted.fixed_cost_override,
      materials: [],
    });
    setCustomerLabel(persisted.customer_name ?? "");
    setMaterials(
      (persisted.costing?.materials ?? []).map((line) => ({
        product_id: line.product_id,
        quantity_per_prototype: line.quantity_per_prototype,
        is_body_material: line.is_body_material,
      })),
    );
    setCosting(persisted.costing);
  }, [persisted]);

  const payload = useMemo(
    (): PrototypeQuotationDraftInput => ({ ...draft, materials }),
    [draft, materials],
  );

  const currency = persisted?.currency_code ?? "PEN";
  const money = (value: string | null | undefined) => formatMoney(value, currency);

  const datosListos = Boolean(draft.customer_id);
  const prototipoListo = Boolean(draft.description.trim()) && draft.quantity > 0;

  // Al entrar en Costeo se pide el cálculo al backend. Es el único sitio donde
  // aparecen importes, y ninguno se ha tocado por el camino.
  useEffect(() => {
    if (step !== 5 || !prototipoListo) return;
    preview.mutate(payload, { onSuccess: (fila) => setCosting(fila.costing) });
    // Sólo al llegar al paso: recalcular en cada tecla dispararía una petición
    // por pulsación y mostraría precios a medio escribir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const guardar = () => {
    if (quotationId) {
      update.mutate(
        { ...payload, expected_updated_at: persisted?.updated_at ?? null },
        { onSuccess: (fila) => setCosting(fila.costing) },
      );
      return;
    }
    create.mutate(payload, {
      onSuccess: (fila) => navigate(`/prototipos/cotizador/${fila.id}`),
    });
  };

  if (quotationId && query.isPending) return <Spinner />;

  const status = persisted?.status ?? "DRAFT";

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 pb-36 sm:pb-24">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <TypewriterTitle
              text={persisted?.code ?? "Cotizador de prototipo."}
              className="text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl"
            />
            <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
            {persisted && persisted.status === "CONFIRMED" ? (
              <Badge tone={persisted.payment_status === "PAID" ? "positive" : "warning"}>
                {persisted.payment_status === "PAID" ? "Pagada" : "Pendiente de cobro"}
              </Badge>
            ) : null}
            {persisted?.prototype_code ? (
              <Link
                to={`/prototipos/${persisted.prototype_id}`}
                className="text-[11px] text-zinc-500 hover:underline"
              >
                Muestra: <span className="font-mono">{persisted.prototype_code}</span>
              </Link>
            ) : null}
          </div>
          <p className="mt-1 max-w-2xl text-xs text-zinc-500 sm:text-sm">
            Cuánto cuesta y cuánto tarda desarrollar una muestra. El costo, el impuesto y el
            plazo los calcula BGreda.
          </p>
        </div>
        <Link
          to="/prototipos"
          className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-xs hover:bg-zinc-50"
        >
          Volver al tablero
        </Link>
      </header>

      <nav
        aria-label="Etapas del cotizador de prototipos"
        className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white p-2 shadow-xs"
      >
        <ol className="flex min-w-max gap-1">
          {STEPS.map((item, index) => (
            <li key={item.label}>
              <button
                type="button"
                onClick={() => setStep(index)}
                aria-current={step === index ? "step" : undefined}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors sm:px-4 ${
                  step === index
                    ? "bg-orange-700 text-white"
                    : index < step
                      ? "bg-orange-50 text-orange-900"
                      : "text-zinc-500 hover:bg-zinc-50"
                }`}
              >
                <span
                  className={`flex size-5 items-center justify-center rounded-full text-[10px] ${
                    step === index ? "bg-white/20" : "bg-zinc-100"
                  }`}
                >
                  {index + 1}
                </span>
                {item.label}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {step === 0 ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs sm:p-6">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-zinc-950">Datos generales</h2>
            <p className="text-xs text-zinc-500">
              A quién se le cotiza. La moneda y el impuesto salen de Configuración.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <CustomerSelectField
              value={draft.customer_id ? String(draft.customer_id) : ""}
              labelValue={customerLabel}
              requirement="required"
              disabled={readOnly}
              onChange={(customerId, label) => {
                setDraft({ ...draft, customer_id: customerId ? Number(customerId) : null });
                setCustomerLabel(label);
              }}
            />
            <TextField
              label="Moneda"
              requirement="optional"
              value={persisted?.currency_code ?? "PEN"}
              onChange={() => undefined}
              disabled
              hint="La fija Configuración; no se elige por cotización."
            />
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs sm:p-6">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-zinc-950">La pieza</h2>
            <p className="text-xs text-zinc-500">
              Un producto del catálogo o un concepto nuevo. Las medidas son de esta muestra: no
              tocan el maestro.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <TextField
              label="Descripción"
              requirement="required"
              value={draft.description}
              onChange={(description) => setDraft({ ...draft, description })}
              disabled={readOnly}
              placeholder="Ej. Taza personalizada"
            />
            <TextField
              label="Cantidad de muestras"
              requirement="required"
              type="number"
              inputMode="numeric"
              value={String(draft.quantity)}
              onChange={(value) => setDraft({ ...draft, quantity: Number(value) || 0 })}
              disabled={readOnly}
            />
            <SelectField
              label="Producto del catálogo"
              requirement="optional"
              placeholder="Concepto nuevo, sin producto"
              value={draft.product_id ? String(draft.product_id) : ""}
              disabled={readOnly}
              options={(products.data?.items ?? []).map((item) => ({
                value: String(item.id),
                label: `${item.internal_reference} · ${item.name}`,
              }))}
              onChange={(value) =>
                setDraft({ ...draft, product_id: value ? Number(value) : null })
              }
            />
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {(["width_cm", "length_cm", "height_cm", "depth_cm"] as const).map((campo, indice) => (
              <TextField
                key={campo}
                label={["Ancho cm", "Largo cm", "Alto cm", "Profundidad cm"][indice]!}
                requirement="optional"
                type="number"
                inputMode="decimal"
                value={draft[campo] ?? ""}
                onChange={(value) => setDraft({ ...draft, [campo]: orNull(value) })}
                disabled={readOnly}
              />
            ))}
          </div>
          <div className="mt-5">
            <TextAreaField
              label="Observaciones"
              requirement="optional"
              value={draft.notes ?? ""}
              onChange={(notes) => setDraft({ ...draft, notes: orNull(notes) })}
              disabled={readOnly}
              rows={3}
            />
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs sm:p-6">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-zinc-950">Trabajo</h2>
            <p className="text-xs text-zinc-500">
              La variable principal del precio son los días. Dejar una tarifa vacía usa la de
              Configuración.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <TextField
              label="Días de diseño"
              requirement="required"
              type="number"
              inputMode="decimal"
              value={draft.design_days}
              onChange={(design_days) => setDraft({ ...draft, design_days })}
              disabled={readOnly}
            />
            <TextField
              label="Tarifa de diseño por día"
              requirement="optional"
              type="number"
              inputMode="decimal"
              value={draft.design_rate_override ?? ""}
              onChange={(value) => setDraft({ ...draft, design_rate_override: orNull(value) })}
              disabled={readOnly}
              hint={
                costing
                  ? `Vacío = la de Configuración (${money(costing.design_rate)} / día)`
                  : "Vacío = la de Configuración"
              }
            />
            <TextField
              label="Días de artista"
              requirement="required"
              type="number"
              inputMode="decimal"
              value={draft.artist_days}
              onChange={(artist_days) => setDraft({ ...draft, artist_days })}
              disabled={readOnly}
            />
            <TextField
              label="Tarifa de artista por día"
              requirement="optional"
              type="number"
              inputMode="decimal"
              value={draft.artist_rate_override ?? ""}
              onChange={(value) => setDraft({ ...draft, artist_rate_override: orNull(value) })}
              disabled={readOnly}
              hint={
                costing
                  ? `Vacío = la de Configuración (${money(costing.artist_rate)} / día)`
                  : "Vacío = la de Configuración"
              }
            />
            <TextField
              label="Precio del matricero"
              requirement="optional"
              type="number"
              inputMode="decimal"
              value={draft.mold_maker_price_override ?? ""}
              onChange={(value) =>
                setDraft({ ...draft, mold_maker_price_override: orNull(value) })
              }
              disabled={readOnly}
              hint="Precio fijo. Sus días alargan el plazo, no multiplican el importe."
            />
            <TextField
              label="Días del matricero"
              requirement="optional"
              type="number"
              inputMode="decimal"
              value={draft.mold_maker_days}
              onChange={(mold_maker_days) => setDraft({ ...draft, mold_maker_days })}
              disabled={readOnly}
            />
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs sm:p-6">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-zinc-950">Materiales</h2>
            <p className="text-xs text-zinc-500">
              Cantidad por muestra. La unidad y el costo los pone el catálogo.
            </p>
          </div>
          <div className="space-y-3">
            {materials.map((line, index) => {
              const catalogo = consumables.find((item) => item.id === line.product_id);
              const costeada = costing?.materials.find(
                (item) => item.product_id === line.product_id,
              );
              return (
                <div
                  key={`material-${index}`}
                  className="grid gap-3 rounded-2xl border border-zinc-200 bg-white/70 p-4 sm:grid-cols-[1fr_170px_150px_auto]"
                >
                  <SelectField
                    label="Material"
                    value={line.product_id ? String(line.product_id) : ""}
                    placeholder="Seleccione del catálogo"
                    disabled={readOnly}
                    options={consumables.map((item) => ({
                      value: String(item.id),
                      label: `${item.internal_reference} · ${item.name}`,
                    }))}
                    onChange={(value) =>
                      setMaterials((rows) =>
                        rows.map((row, i) =>
                          i === index ? { ...row, product_id: Number(value) } : row,
                        ),
                      )
                    }
                  />
                  <TextField
                    label={`Cantidad por muestra${catalogo?.base_uom_code ? ` (${catalogo.base_uom_code})` : ""}`}
                    requirement="required"
                    type="number"
                    inputMode="decimal"
                    value={line.quantity_per_prototype}
                    disabled={readOnly}
                    onChange={(value) =>
                      setMaterials((rows) =>
                        rows.map((row, i) =>
                          i === index ? { ...row, quantity_per_prototype: value } : row,
                        ),
                      )
                    }
                  />
                  {/* El costo llega del backend. Aquí no se multiplica nada. */}
                  <div className="self-end text-xs text-zinc-600">
                    <span className="block text-[11px] font-medium text-zinc-500">Costo</span>
                    {costeada ? money(costeada.cost) : "Se calcula en Costeo"}
                  </div>
                  {!readOnly ? (
                    <SecondaryButton
                      className="self-end"
                      onClick={() => setMaterials((rows) => rows.filter((_, i) => i !== index))}
                    >
                      Quitar
                    </SecondaryButton>
                  ) : null}
                </div>
              );
            })}
          </div>
          {!readOnly ? (
            <SecondaryButton
              type="button"
              className="mt-4"
              onClick={() =>
                setMaterials((rows) => [
                  ...rows,
                  { product_id: 0, quantity_per_prototype: "1", is_body_material: rows.length === 0 },
                ])
              }
            >
              Añadir material
            </SecondaryButton>
          ) : null}
        </section>
      ) : null}

      {step === 4 ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs sm:p-6">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-zinc-950">Quema y espera</h2>
            <p className="text-xs text-zinc-500">
              La tarifa y los días por hornada salen del horno. El secado y el ajuste alargan el
              plazo sin costar dinero.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <SelectField
              label="Horno"
              requirement="optional"
              placeholder="Sin quema"
              value={draft.kiln_id ? String(draft.kiln_id) : ""}
              disabled={readOnly}
              options={(kilns.data?.items ?? []).map((kiln) => ({
                value: String(kiln.id),
                label: kiln.name,
              }))}
              onChange={(value) => setDraft({ ...draft, kiln_id: value ? Number(value) : null })}
            />
            <SelectField
              label="Tipo de quema"
              requirement="optional"
              placeholder="Seleccione"
              value={draft.firing_type ?? ""}
              disabled={readOnly}
              options={FIRING_OPTIONS}
              onChange={(value) =>
                setDraft({ ...draft, firing_type: (value || null) as FiringType | null })
              }
            />
            <TextField
              label="Número de hornadas"
              requirement="optional"
              type="number"
              inputMode="numeric"
              value={String(draft.firing_batches)}
              onChange={(value) => setDraft({ ...draft, firing_batches: Number(value) || 0 })}
              disabled={readOnly}
            />
            <TextField
              label="Días de secado"
              requirement="optional"
              type="number"
              inputMode="decimal"
              value={draft.drying_days}
              onChange={(drying_days) => setDraft({ ...draft, drying_days })}
              disabled={readOnly}
            />
            <TextField
              label="Días de ajuste"
              requirement="optional"
              type="number"
              inputMode="decimal"
              value={draft.adjustment_days}
              onChange={(adjustment_days) => setDraft({ ...draft, adjustment_days })}
              disabled={readOnly}
            />
          </div>
        </section>
      ) : null}

      {step === 5 ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-zinc-950">Costeo</h2>
              <p className="text-xs text-zinc-500">
                Calculado por BGreda. Esta pantalla no hace aritmética de dinero.
              </p>
            </div>
            <SecondaryButton
              type="button"
              disabled={preview.isPending || !prototipoListo}
              onClick={() =>
                preview.mutate(payload, { onSuccess: (fila) => setCosting(fila.costing) })
              }
            >
              {preview.isPending ? "Calculando…" : "Recalcular"}
            </SecondaryButton>
          </div>
          {costing ? <Costeo costing={costing} money={money} /> : (
            <p className="text-xs text-zinc-400">
              Complete la pieza y pulse Recalcular para ver el costo.
            </p>
          )}
        </section>
      ) : null}

      {step === 6 ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs sm:p-6">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-zinc-950">Resumen</h2>
            <p className="text-xs text-zinc-500">
              Revise antes de emitir. Al emitir se congela el precio y se asigna el correlativo.
            </p>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Dato label="Cliente" valor={customerLabel || "—"} />
            <Dato label="Moneda" valor={currency} />
            <Dato label="Pieza" valor={draft.description || "—"} />
            <Dato label="Muestras" valor={String(draft.quantity)} />
            <Dato
              label="Medidas"
              valor={
                [draft.width_cm, draft.length_cm, draft.height_cm]
                  .filter(Boolean)
                  .join(" × ") || "—"
              }
            />
            <Dato label="Plazo" valor={costing ? `${costing.estimated_days} días` : "—"} />
          </dl>
          {costing ? (
            <div className="mt-5 border-t border-zinc-100 pt-5">
              <Costeo costing={costing} money={money} />
            </div>
          ) : null}
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {describeError(error)}
        </p>
      ) : null}

      <footer className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm sm:px-5">
        <div className="flex gap-2">
          <SecondaryButton disabled={step === 0} onClick={() => setStep((v) => Math.max(0, v - 1))}>
            Anterior
          </SecondaryButton>
          <SecondaryButton
            disabled={step === STEPS.length - 1}
            onClick={() => setStep((v) => Math.min(STEPS.length - 1, v + 1))}
          >
            Siguiente
          </SecondaryButton>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {!readOnly ? (
            <PrimaryButton
              type="button"
              disabled={busy || !datosListos || !prototipoListo}
              onClick={guardar}
            >
              {busy ? "Guardando…" : quotationId ? "Guardar borrador" : "Crear borrador"}
            </PrimaryButton>
          ) : null}
          {quotationId && status === "DRAFT" ? (
            <PrimaryButton type="button" disabled={busy} onClick={() => confirm.mutate()}>
              Emitir cotización
            </PrimaryButton>
          ) : null}
          {persisted?.status === "CONFIRMED" ? (
            <a
              href={prototypeQuotationPdfUrl(persisted.id)}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-xs hover:bg-zinc-50"
            >
              Ver PDF
            </a>
          ) : null}
          {persisted?.status === "CONFIRMED" && persisted.payment_status === "UNPAID" ? (
            <SecondaryButton disabled={busy} onClick={() => markPaid.mutate()}>
              Registrar cobro
            </SecondaryButton>
          ) : null}
        </div>
      </footer>
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <dt className="text-[11px] text-zinc-500">{label}</dt>
      <dd className="text-sm text-zinc-900">{valor}</dd>
    </div>
  );
}

/**
 * El desglose que ve quien cotiza.
 *
 * Todos los importes llegan formateados desde el backend; aquí sólo se
 * colocan. Separar el costo interno del bloque comercial es deliberado: lo de
 * arriba explica en qué se va el dinero, lo de abajo es lo que firma el
 * cliente.
 */
function Costeo({
  costing,
  money,
}: {
  costing: PrototypeCostBreakdown;
  money: (value: string | null | undefined) => string;
}) {
  const conceptos: Array<[string, string]> = [
    ["Diseño", costing.design_cost],
    ["Artista", costing.artist_cost],
    ["Matricero", costing.mold_maker_cost],
    ["Materiales", costing.materials_cost],
    ["Quema", costing.firing_cost],
    ["Costos fijos", costing.fixed_cost],
  ];
  const dias: Array<[string, string]> = [
    ["Diseño", costing.design_days],
    ["Artista", costing.artist_days],
    ["Matricero", costing.mold_maker_days],
    ["Secado", costing.drying_days],
    ["Quema", String(costing.firing_days)],
    ["Ajuste", costing.adjustment_days],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Costo interno
          </p>
          <dl className="mt-2 divide-y divide-zinc-100">
            {conceptos.map(([etiqueta, importe]) => (
              <div key={etiqueta} className="flex items-center justify-between py-1.5">
                <dt className="text-xs text-zinc-600">{etiqueta}</dt>
                <dd className="text-xs font-medium text-zinc-900">{money(importe)}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between py-2">
              <dt className="text-xs font-semibold text-zinc-900">Costo base</dt>
              <dd className="text-sm font-semibold text-zinc-950">{money(costing.base_cost)}</dd>
            </div>
          </dl>
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Plazo</p>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
            {dias.map(([etiqueta, valor]) => (
              <span key={etiqueta} className="text-xs text-zinc-600">
                {etiqueta} <span className="font-medium text-zinc-900">{valor}</span>
              </span>
            ))}
          </div>
          <p className="mt-2 text-sm text-zinc-950">
            <span className="font-semibold">{costing.estimated_days} días</span>
            {costing.target_date ? (
              <span className="text-xs text-zinc-500"> · objetivo {costing.target_date}</span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-zinc-50 p-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Comercial</p>
        <dl className="mt-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <dt className="text-xs text-zinc-600">Subtotal</dt>
            <dd className="text-xs font-medium text-zinc-900">
              {money(costing.commercial_net_total)}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-xs text-zinc-600">IGV ({costing.tax_percent}%)</dt>
            <dd className="text-xs font-medium text-zinc-900">
              {money(costing.commercial_tax_total)}
            </dd>
          </div>
          <div className="flex items-center justify-between border-t border-zinc-200 pt-2">
            <dt className="text-sm font-semibold text-zinc-900">Total</dt>
            <dd className="text-base font-semibold text-zinc-950">
              {money(costing.commercial_gross_total)}
            </dd>
          </div>
          <p className="pt-1 text-[11px] text-zinc-500">
            {money(costing.total_per_prototype)} por muestra
          </p>
        </dl>
      </div>
    </div>
  );
}
