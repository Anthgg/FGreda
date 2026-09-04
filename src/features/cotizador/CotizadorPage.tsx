import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import { PrimaryButton, SecondaryButton, SelectField, TextField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { TypewriterTitle } from "@/components/TypewriterTitle";
import { useSession } from "@/features/auth/useSession";
import { CommercialLines } from "@/features/cotizador/CommercialLines";
import { CotizadorItemCard, type CotizadorItemMode } from "@/features/cotizador/CotizadorItemCard";
import { CotizadorPdfPanel } from "@/features/cotizador/CotizadorPdfPanel";
import {
  cotizadorFromOutput,
  cotizadorToPayload,
  emptyCotizadorDraft,
  emptyCotizadorItem,
  type CotizadorDraft,
} from "@/features/cotizador/draft";
import { describeNextStep } from "@/features/quotations/domainWarnings";
import {
  useCancelCotizador,
  useConfirmCotizador,
  useCotizador,
  useCotizadorPreview,
  useCreateCotizador,
  useDuplicateCotizador,
  useMarkCotizadorPaid,
  useUpdateCotizador,
} from "@/features/cotizador/useCotizador";
import { useKilns } from "@/features/firings/useFirings";
import { formatDecimalString } from "@/features/firings/labels";
import { Badge } from "@/features/masters/MasterTable";
import { CustomerSelectField } from "@/features/quotations/CustomerSelectField";
import { ProductionOrderAction } from "@/features/production/ProductionOrderAction";
import { canMarkPaid, describePayment, paymentDate, paymentTone } from "@/features/quotations/payment";
import { describeError } from "@/features/settings/messages";
import type { QuotationBuilderOut } from "@/types/quotationBuilder";
import { CURRENCY_OPTIONS, exchangeRateLabel, formatMoney } from "@/features/quotations/money";

const STEPS = [
  { label: "Datos", mode: null },
  { label: "Piezas", mode: "PIECES" },
  { label: "Producción", mode: null },
  { label: "Costeo", mode: "COSTS" },
  { label: "Margen y precio", mode: "MARGIN" },
  { label: "Resumen", mode: "SUMMARY" },
  { label: "PDF", mode: null },
] as const;

const STATUS_LABEL = { DRAFT: "Borrador", CONFIRMED: "Confirmada", CANCELLED: "Anulada" } as const;
const STATUS_TONE = { DRAFT: "warning", CONFIRMED: "positive", CANCELLED: "neutral" } as const;
const money = (value: string | null | undefined, code: string | null | undefined = "PEN") =>
  formatMoney(value, code);

function numberFrom(value: unknown, fallback = "—") {
  return value === null || value === undefined ? fallback : String(value);
}

const decimalFrom = (value: unknown, decimals = 2) =>
  value === null || value === undefined ? "—" : formatDecimalString(String(value), decimals);

function ProductionPanel({ preview }: {
  preview?: QuotationBuilderOut | undefined;
}) {
  const summary = preview?.production_summary ?? {};
  const sessions = Array.isArray(summary.sessions) ? summary.sessions as Array<Record<string, unknown>> : [];
  // El resumen de HORNADAS es produccion, no comercio: siempre en soles.
  // Convertirlo daria a entender que el costo del taller cambia al elegir
  // otra moneda de emision, y no cambia.
  const taxPercentage = numberFrom(summary.tax_percentage, "0");
  return (
    <section className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs sm:p-6">
      <div>
        <h2 className="text-sm font-semibold text-zinc-950">Resumen de quema del lote</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Cálculo consolidado de todos los productos incluidos en esta producción. La ocupación
          y el factor salen del lote completo, no de cada pieza por separado.
        </p>
      </div>
      {/* Siete columnas solo caben de verdad en pantalla ancha. A 1024 px
          partian cada importe en dos lineas ("S/" arriba, la cifra abajo);
          cuatro columnas ahi lo mantienen legible sin agrandar las tarjetas. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <div className="rounded-xl bg-zinc-50 p-3"><p className="text-[10px] uppercase text-zinc-400">Volumen</p><p className="font-bold tabular-nums">{decimalFrom(summary.total_volume_cm3)} cm³</p></div>
        <div className="rounded-xl bg-zinc-50 p-3"><p className="text-[10px] uppercase text-zinc-400">Ocupación</p><p className="font-bold tabular-nums">{decimalFrom(summary.occupancy_percentage)}%</p></div>
        <div className="rounded-xl bg-zinc-50 p-3"><p className="text-[10px] uppercase text-zinc-400">Factor</p><p className="font-bold tabular-nums">×{decimalFrom(summary.occupancy_factor)}</p></div>
        <div className="rounded-xl bg-zinc-50 p-3"><p className="text-[10px] uppercase text-zinc-400">Costo base</p><p className="font-bold tabular-nums">{money(numberFrom(summary.subtotal, "0"), "PEN")}</p></div>
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-3"><p className="text-[10px] uppercase text-orange-700">Quema sin IGV</p><p className="font-bold tabular-nums text-orange-950">{money(numberFrom(summary.total_cost, "0"), "PEN")}</p></div>
        <div className="rounded-xl bg-zinc-50 p-3"><p className="text-[10px] uppercase text-zinc-400">IGV ({taxPercentage}%)</p><p className="font-bold tabular-nums">{money(numberFrom(summary.tax_amount, "0"), "PEN")}</p></div>
        <div className="rounded-xl bg-zinc-950 p-3 text-white"><p className="text-[10px] uppercase text-zinc-400">Quema con IGV</p><p className="font-bold tabular-nums">{money(numberFrom(summary.total_with_tax, "0"), "PEN")}</p></div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {sessions.map((session, index) => (
          <div key={`${numberFrom(session.firing_type)}-${index}`} className="rounded-xl border border-zinc-200 p-4">
            <div className="flex justify-between gap-3"><p className="text-xs font-bold text-zinc-900">Quema {session.firing_type === "LOW" ? "baja" : "alta"}</p><p className="text-xs font-semibold tabular-nums">{money(numberFrom(session.subtotal, "0"), "PEN")}</p></div>
            <p className="mt-1 text-[11px] text-zinc-500">{numberFrom(session.kiln_code)} · Ocupación física {numberFrom(session.physical_occupancy_percentage)}%</p>
          </div>
        ))}
      </div>
      <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">
        Estas cifras son el <strong>costo total de la quema</strong>, no el de la última pieza:
        cada producto recibe su parte prorrateada en su propia tarjeta. La simulación no crea ni
        confirma una quema real y no mueve inventario.
      </p>
    </section>
  );
}

export function CotizadorPage() {
  const params = useParams();
  const parsedId = params.id ? Number(params.id) : null;
  const id = parsedId && Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
  const navigate = useNavigate();
  const { data: user } = useSession();
  const canEdit = user?.role === "ADMIN";
  const query = useCotizador(id);
  const create = useCreateCotizador();
  const update = useUpdateCotizador(id ?? 0);
  const confirm = useConfirmCotizador();
  const cancel = useCancelCotizador();
  const duplicate = useDuplicateCotizador();
  const markPaid = useMarkCotizadorPaid();
  const kilns = useKilns({ active: true, limit: 100 });
  const [draft, setDraft] = useState<CotizadorDraft>(emptyCotizadorDraft);
  const [persisted, setPersisted] = useState<QuotationBuilderOut | null>(null);
  const [step, setStep] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmPaid, setConfirmPaid] = useState(false);
  const [confirmQuotationModal, setConfirmQuotationModal] = useState(false);
  const [cachedPdf, setCachedPdf] = useState<{ url: string; filename: string; payloadStr: string } | null>(null);
  const [showDatosRequired, setShowDatosRequired] = useState(false);
  const syncedVersion = useRef<string | null>(null);
  const routeId = useRef<number | null>(id);

  useEffect(() => {
    if (routeId.current === id) return;
    routeId.current = id;
    // Crear navega de /nuevo al id devuelto después de sincronizar la
    // respuesta. Ese caso conserva el estado recién guardado; cualquier otra
    // transición de ruta empieza desde el registro solicitado o un alta vacía.
    if (id !== null && persisted?.id === id) return;
    setDraft(emptyCotizadorDraft);
    setPersisted(null);
    setStep(0);
    setDirty(false);
    setNotice(null);
    setConfirmCancel(false);
    setConfirmQuotationModal(false);
    if (cachedPdf?.url) {
      URL.revokeObjectURL(cachedPdf.url);
      setCachedPdf(null);
    }
    syncedVersion.current = null;
  }, [cachedPdf?.url, id, persisted?.id]);

  useEffect(() => {
    return () => {
      if (cachedPdf?.url) {
        URL.revokeObjectURL(cachedPdf.url);
      }
    };
  }, [cachedPdf?.url]);

  useEffect(() => {
    if (!query.data || syncedVersion.current === query.data.updated_at) return;
    if (dirty && syncedVersion.current !== null) return;
    setDraft(cotizadorFromOutput(query.data));
    setPersisted(query.data);
    syncedVersion.current = query.data.updated_at;
  }, [dirty, query.data]);

  const status = persisted?.status ?? query.data?.status ?? "DRAFT";
  const payload = useMemo(() => cotizadorToPayload(draft), [draft]);
  const [previewPayload, setPreviewPayload] = useState(id ? null : payload);
  useEffect(() => {
    if (status !== "DRAFT") {
      setPreviewPayload(null);
      return;
    }
    if (id && !query.data && !persisted) return;
    const timer = window.setTimeout(() => setPreviewPayload(payload), 350);
    return () => window.clearTimeout(timer);
  }, [id, payload, persisted, query.data, status]);
  const previewQuery = useCotizadorPreview(previewPayload);
  const stored = persisted ?? query.data;
  const preview = status === "DRAFT" ? previewQuery.data ?? stored : stored;
  const readOnly = !canEdit || status !== "DRAFT";
  // El paso Datos es la unica fuente de nombre y cliente: nada aguas abajo
  // (piezas, produccion, costeo...) tiene sentido sin ellos, y el backend ya
  // bloquea la confirmacion sin cliente. Sin esta guarda la navegacion del
  // wizard avanzaba en silencio y el usuario creia haber completado el paso.
  const missingCustomer = !/^[1-9]\d*$/.test(draft.customerId);
  const missingName = draft.name.trim() === "";
  const datosComplete = !readOnly ? !missingName && !missingCustomer : true;
  const currentMode = STEPS[step]?.mode as CotizadorItemMode | null;
  // El backend nombra el paso con su codigo interno; aqui se dice como se
  // llama en la pantalla.
  const nextStepLabel = describeNextStep(preview?.next_step);
  const busy = create.isPending || update.isPending || confirm.isPending || cancel.isPending || duplicate.isPending;
  const mutationError = create.error ?? update.error ?? confirm.error ?? cancel.error ?? duplicate.error;
  const sourceChanged = mutationError instanceof ApiError && mutationError.code === "QUOTATION_BUILDER_SOURCE_CHANGED";

  const changeDraft = (next: CotizadorDraft) => {
    setDraft(next);
    setDirty(true);
    setNotice(null);
  };
  const syncSaved = (saved: QuotationBuilderOut) => {
    setPersisted(saved);
    setDraft(cotizadorFromOutput(saved));
    syncedVersion.current = saved.updated_at;
    setDirty(false);
  };
  const save = (exitAfter = false) => {
    setNotice(null);
    if (!id) {
      create.mutate(payload, { onSuccess: (saved) => {
        syncSaved(saved);
        if (exitAfter) navigate("/cotizaciones");
        else navigate(`/cotizador/${saved.id}`, { replace: true });
      }});
      return;
    }
    const expected = persisted?.updated_at ?? query.data?.updated_at;
    if (!expected) return;
    update.mutate({ ...payload, expected_updated_at: expected }, { onSuccess: (saved) => {
      syncSaved(saved);
      setNotice("Borrador guardado y recalculado con las fuentes actuales.");
      if (exitAfter) navigate("/cotizaciones");
    }});
  };

  if (id && query.isPending && !persisted) return <div className="flex justify-center py-24"><Spinner className="size-6" label="Abriendo cotizador…" /></div>;
  if (id && query.isError && !persisted) return <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{describeError(query.error)}</p>;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 pb-36 sm:pb-24">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <TypewriterTitle text={persisted?.code ?? "Nuevo cotizador."} className="text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl" />
            <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
            {/* Procedencia, no propiedad: esta es una cotización final como
                cualquier otra, que además nació de una muestra aprobada. Por
                eso va como una etiqueta discreta y no como un título. */}
            {persisted?.origin_prototype_code ? (
              <Link
                to={`/prototipos/${persisted.origin_prototype_id}`}
                className="text-[11px] text-zinc-500 hover:underline"
              >
                Origen: <span className="font-mono">{persisted.origin_prototype_code}</span>
              </Link>
            ) : null}
            {/* El cobro es un eje aparte: una anulada puede estar pagada, así
                que las dos insignias conviven en vez de sustituirse. En un
                borrador no se muestra nada, porque todavía no hay nada que
                cobrar. */}
            {persisted && status !== "DRAFT" ? (
              <Badge tone={paymentTone(persisted.payment_status)}>
                {describePayment(persisted.payment_status)}
                {paymentDate(persisted.paid_at) ? ` · ${paymentDate(persisted.paid_at)}` : ""}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 max-w-2xl text-xs text-zinc-500 sm:text-sm">Cotización multiproducto con simulación de producción y cálculo comercial gobernados por BGreda.</p>
        </div>
        <Link to="/cotizaciones" className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-xs hover:bg-zinc-50">Volver al historial</Link>
      </header>

      <nav aria-label="Etapas del cotizador" className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white p-2 shadow-xs">
        <ol className="flex min-w-max gap-1">
          {STEPS.map((item, index) => (
            <li key={item.label}>
              <button type="button" onClick={() => setStep(index)} aria-current={step === index ? "step" : undefined} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors sm:px-4 ${step === index ? "bg-orange-700 text-white" : index < step ? "bg-orange-50 text-orange-900" : "text-zinc-500 hover:bg-zinc-50"}`}>
                <span className={`flex size-5 items-center justify-center rounded-full text-[10px] ${step === index ? "bg-white/20" : "bg-zinc-100"}`}>{index + 1}</span>{item.label}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {step === 0 ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs sm:p-6">
          <div className="mb-5"><h2 className="text-base font-semibold text-zinc-950">Datos generales</h2><p className="text-xs text-zinc-500">Identifique el pedido y asigne un cliente existente o créelo desde este flujo.</p></div>
          <div className="grid gap-5 md:grid-cols-2">
            <TextField label="Nombre / referencia" requirement="required" value={draft.name} onChange={(name) => { changeDraft({ ...draft, name }); setShowDatosRequired(false); }} disabled={readOnly} placeholder="Ej. Vajilla restaurante Miraflores" />
            <CustomerSelectField value={draft.customerId} labelValue={draft.customerLabel} requirement="required" disabled={readOnly} onChange={(customerId, customerLabel) => { changeDraft({ ...draft, customerId, customerLabel }); setShowDatosRequired(false); }} />
            {/* Fase 009F. La moneda es de ESTA cotizacion, no de Configuracion.
                Cambiarla no toca los costos: el backend recalcula el precio
                desde el costo en soles, que es la moneda base del taller. */}
            <SelectField
              label="Moneda"
              requirement="required"
              value={draft.currencyCode}
              options={CURRENCY_OPTIONS}
              disabled={readOnly}
              onChange={(currencyCode: string) =>
                changeDraft({
                  ...draft,
                  currencyCode: currencyCode === "USD" ? "USD" : "PEN",
                  // Volver a soles descarta la tasa: guardarla describiria una
                  // conversion que ya no ocurre, y el backend la rechaza.
                  exchangeRate: currencyCode === "USD" ? draft.exchangeRate : "",
                })
              }
            />
            {draft.currencyCode === "USD" ? (
              <TextField
                label="Tipo de cambio"
                requirement="required"
                value={draft.exchangeRate}
                onChange={(exchangeRate) => changeDraft({ ...draft, exchangeRate })}
                disabled={readOnly}
                inputMode="decimal"
                placeholder="3.75"
                // Se dice la direccion entera: el numero solo no aclara si hay
                // que multiplicar o dividir, y esa duda cuadruplica precios.
                hint={
                  exchangeRateLabel(draft.exchangeRate.trim() || null) ??
                  "Cuántos soles vale un dólar. Ejemplo: 1 USD = S/ 3.75"
                }
              />
            ) : null}
          </div>
          {draft.currencyCode === "USD" && !draft.exchangeRate.trim() ? (
            <p role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900">
              Ingresa el tipo de cambio para cotizar en dólares.
            </p>
          ) : null}
          {draft.currencyCode === "USD" && draft.exchangeRate.trim() && !(Number(draft.exchangeRate) > 0) ? (
            <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
              El tipo de cambio debe ser mayor que 0.
            </p>
          ) : null}
          {showDatosRequired && !datosComplete ? (
            <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
              {missingCustomer ? "Selecciona un cliente para continuar." : "Ingresa un nombre o referencia para continuar."}
            </p>
          ) : null}
        </section>
      ) : null}

      {currentMode ? (
        <section className="space-y-4">
          {draft.items.map((item, index) => (
            <CotizadorItemCard
              key={item.id ?? `new-${index}`}
              item={item}
              index={index}
              mode={currentMode}
              preview={preview?.items.find((value) => value.product_id === Number(item.productId))}
              currencyCode={preview?.currency_code_snapshot}
              productionSummary={preview?.production_summary}
              headerKilnId={draft.kilnId}
              kilns={kilns.data?.items ?? []}
              disabled={readOnly}
              excludedProductIds={draft.items.filter((_, itemIndex) => itemIndex !== index).map((value) => Number(value.productId)).filter(Number.isInteger)}
              onChange={(next) => changeDraft({ ...draft, items: draft.items.map((value, itemIndex) => itemIndex === index ? next : value) })}
              onRemove={() => changeDraft({ ...draft, items: draft.items.filter((_, itemIndex) => itemIndex !== index) })}
            />
          ))}
          {step === 1 && !readOnly ? (
            <button type="button" onClick={() => changeDraft({ ...draft, items: [...draft.items, emptyCotizadorItem()] })} className="flex min-h-20 w-full items-center justify-center rounded-2xl border-2 border-dashed border-orange-200 bg-orange-50/60 text-sm font-semibold text-orange-900 hover:border-orange-300 hover:bg-orange-50">
              + Agregar producto
            </button>
          ) : null}
          {!draft.items.length ? <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">Agregue al menos un producto para continuar.</p> : null}
        </section>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          {draft.items.map((item, index) => (
            <CotizadorItemCard
              key={item.id ?? `production-${index}`}
              item={item}
              index={index}
              mode="PRODUCTION"
              preview={preview?.items.find((value) => value.product_id === Number(item.productId))}
              currencyCode={preview?.currency_code_snapshot}
              productionSummary={preview?.production_summary}
              headerKilnId={draft.kilnId}
              kilns={kilns.data?.items ?? []}
              disabled={readOnly}
              excludedProductIds={[]}
              onChange={(next) => changeDraft({ ...draft, items: draft.items.map((value, itemIndex) => itemIndex === index ? next : value) })}
              onRemove={() => undefined}
            />
          ))}
          {!draft.items.length ? <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">Agregue piezas antes de configurar la producción.</p> : null}
          {/* El resumen va DESPUES del ultimo producto y antes de la
              navegacion: se configura pieza por pieza hacia abajo, y el
              resultado consolidado se lee donde termina la configuracion.
              Arriba obligaba a subir de nuevo para ver el efecto de lo que
              se acababa de cambiar. */}
          {draft.items.length ? <ProductionPanel preview={preview} /> : null}
        </div>
      ) : null}

      {step === 5 ? (
        <section className="space-y-4">
          {/* Cargos comerciales: van en el Resumen porque afectan al total del
              documento, no a ninguna pieza concreta. */}
          <CommercialLines
            quotationId={id}
            lines={persisted?.commercial_lines ?? query.data?.commercial_lines ?? []}
            currencyCode={preview?.currency_code_snapshot ?? null}
            editable={canEdit && status === "DRAFT"}
          />
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs sm:p-6">
          {/* Fase 009F: la moneda se dice, no se deduce del simbolo. Con USD
              tambien se dice la tasa, porque sin ella el documento afirma
              dolares sin decir a cuanto. */}
          <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-zinc-400">Moneda</p>
              <p className="text-sm font-semibold text-zinc-900">{preview?.currency_code_snapshot ?? "PEN"}</p>
            </div>
            {preview?.exchange_rate_snapshot ? (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-zinc-400">Tipo de cambio</p>
                <p className="text-sm font-semibold text-zinc-900">
                  {exchangeRateLabel(preview.exchange_rate_snapshot)}
                </p>
              </div>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><p className="text-[10px] uppercase tracking-wide text-zinc-400">Subtotal comercial</p><p className="mt-1 text-lg font-bold tabular-nums">{money(preview?.commercial_subtotal, preview?.currency_code_snapshot)}</p></div>
            <div><p className="text-[10px] uppercase tracking-wide text-zinc-400">IGV</p><p className="mt-1 text-lg font-bold tabular-nums">{money(preview?.tax_amount, preview?.currency_code_snapshot)}</p></div>
            <div className="rounded-xl bg-zinc-950 p-4 text-white"><p className="text-[10px] uppercase tracking-wide text-zinc-400">Total con IGV</p><p className="mt-1 text-2xl font-bold tabular-nums">{money(preview?.total_with_tax, preview?.currency_code_snapshot)}</p></div>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-5">
            <p className={`text-sm font-semibold ${status === "CONFIRMED" || preview?.complete ? "text-emerald-700" : "text-amber-700"}`}>
              {status === "CONFIRMED"
                ? "Cotización confirmada"
                : preview?.complete
                  ? "Lista para confirmar · Continúe al paso PDF"
                  : nextStepLabel
                    ? `Borrador incompleto · siguiente paso: ${nextStepLabel}`
                    : "Borrador incompleto. Revise los avisos de cada producto."}
            </p>
            <div className="flex gap-2">
              <PrimaryButton type="button" onClick={() => setStep(6)}>
                Ver vista previa PDF →
              </PrimaryButton>
            </div>
          </div>
        </section>
        </section>
      ) : null}

      {step === 6 ? (
        <CotizadorPdfPanel
          draftPayload={payload}
          preview={preview}
          status={status}
          isDirty={dirty}
          canEdit={canEdit}
          busy={busy}
          cachedPdf={cachedPdf}
          onPdfGenerated={(newPdf) => {
            if (cachedPdf?.url && cachedPdf.url !== newPdf.url) {
              URL.revokeObjectURL(cachedPdf.url);
            }
            setCachedPdf(newPdf);
          }}
          onSaveDraft={(exitAfter) => save(exitAfter)}
          onRequestConfirm={() => {
            if (!id) {
              save(false);
            } else {
              setConfirmQuotationModal(true);
            }
          }}
        />
      ) : null}

      {previewQuery.isFetching && step !== 6 ? <p className="text-right text-[11px] text-zinc-400">Recalculando en BGreda…</p> : null}
      {previewQuery.isError && step !== 6 ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">No se pudo recalcular: {describeError(previewQuery.error)}</p> : null}
      {sourceChanged ? <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Los maestros cambiaron. Revise el nuevo preview y guarde el borrador antes de confirmar.</p> : null}
      {mutationError && !sourceChanged ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{describeError(mutationError)}</p> : null}
      {notice ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}

      <footer className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm sm:px-5">
        <div className="flex gap-2">
          <SecondaryButton disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>Anterior</SecondaryButton>
          <SecondaryButton disabled={step === STEPS.length - 1} onClick={() => {
            if (step === 0 && !datosComplete) { setShowDatosRequired(true); return; }
            setShowDatosRequired(false);
            setStep((value) => Math.min(STEPS.length - 1, value + 1));
          }}>Siguiente</SecondaryButton>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {canEdit && status === "DRAFT" ? <SecondaryButton disabled={busy} onClick={() => save(true)}>Guardar y salir</SecondaryButton> : null}
          {canEdit && status === "DRAFT" ? <PrimaryButton type="button" disabled={busy} onClick={() => save(false)}>{busy ? "Guardando…" : id ? "Guardar borrador" : "Crear borrador"}</PrimaryButton> : null}
          {canEdit && id && status !== "CANCELLED" ? <SecondaryButton disabled={busy} onClick={() => setConfirmCancel(true)}>Anular</SecondaryButton> : null}
          {canEdit && id && persisted && canMarkPaid(status, persisted.payment_status) ? <SecondaryButton disabled={busy} onClick={() => setConfirmPaid(true)}>Marcar como pagada</SecondaryButton> : null}
          {canEdit && id && status !== "DRAFT" ? <SecondaryButton disabled={busy} onClick={() => duplicate.mutate(id, { onSuccess: (copy) => navigate(`/cotizador/${copy.id}`) })}>Duplicar</SecondaryButton> : null}
          {/* Fase 009I. No se consulta el estado de cobro: producir y cobrar
              son ejes distintos, y exigir el pago aqui pararia el taller por
              una gestion administrativa. */}
          {id ? <ProductionOrderAction quotationId={id} status={status} disabled={busy} /> : null}
        </div>
      </footer>

      {confirmCancel ? (
        <div role="dialog" aria-modal="true" aria-label="Confirmar anulación" className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-base font-bold">Anular cotización</h2><p className="mt-2 text-sm text-zinc-600">La cotización conservará su historial y quedará inmutable.</p>{persisted?.payment_status === "PAID" ? <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">La cotización está registrada como pagada. Anularla no revierte el pago.</p> : null}<div className="mt-5 flex justify-end gap-2"><SecondaryButton onClick={() => setConfirmCancel(false)}>Volver</SecondaryButton><PrimaryButton type="button" disabled={busy} onClick={() => id && cancel.mutate(id, { onSuccess: (saved) => { syncSaved(saved); setConfirmCancel(false); } })}>Confirmar anulación</PrimaryButton></div></div>
        </div>
      ) : null}

      {confirmPaid ? (
        <div role="dialog" aria-modal="true" aria-label="Confirmar pago" className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4">
          {/* El texto dice sólo lo que la acción hace. No descuenta material,
              no genera producción y no emite factura: prometerlo aquí sería
              hacer creer que ocurrió algo que no ocurre. */}
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-base font-bold">Marcar como pagada</h2><p className="mt-2 text-sm text-zinc-600">Esta acción registrará la cotización como pagada y guardará la fecha de pago.</p><div className="mt-5 flex justify-end gap-2"><SecondaryButton onClick={() => setConfirmPaid(false)}>Volver</SecondaryButton><PrimaryButton type="button" disabled={busy} onClick={() => id && markPaid.mutate(id, { onSuccess: (saved) => { syncSaved(saved); setConfirmPaid(false); } })}>Confirmar pago</PrimaryButton></div></div>
        </div>
      ) : null}

      {confirmQuotationModal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar cotización"
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-zinc-950">Confirmar cotización</h2>
            <p className="text-sm text-zinc-600">
              Al confirmar, la cotización quedará congelada y ya no podrá editarse.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <SecondaryButton onClick={() => setConfirmQuotationModal(false)}>
                Cancelar
              </SecondaryButton>
              <PrimaryButton
                type="button"
                disabled={busy}
                onClick={() => {
                  const expected = persisted?.updated_at ?? query.data?.updated_at;
                  if (expected && id) {
                    confirm.mutate(
                      { id, expectedUpdatedAt: expected },
                      {
                        onSuccess: (saved) => {
                          syncSaved(saved);
                          setConfirmQuotationModal(false);
                          setStep(6);
                        },
                      }
                    );
                  }
                }}
              >
                {confirm.isPending ? "Confirmando…" : "Confirmar cotización"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
