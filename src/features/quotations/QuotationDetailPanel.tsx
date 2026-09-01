import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ApiError } from "@/api/client";
import { fetchQuotationPdf } from "@/api/quotations";
import { PrimaryButton, SecondaryButton } from "@/components/form";
import { formatDecimalString } from "@/features/firings/labels";
import { Badge } from "@/features/masters/MasterTable";
import {
  useCancelQuotation,
  useConfirmQuotation,
  useDuplicateQuotation,
  useUpdateQuotationProductPrice,
} from "@/features/quotations/useQuotations";
import { describeError } from "@/features/settings/messages";
import type { QuotationOut, QuotationStatus } from "@/types/quotations";
import { exchangeRateLabel, formatMoney } from "@/features/quotations/money";

const statusLabel: Record<QuotationStatus, string> = {
  DRAFT: "Borrador",
  CONFIRMED: "Confirmada",
  CANCELLED: "Anulada",
};
const statusTone: Record<QuotationStatus, "warning" | "positive" | "neutral"> = {
  DRAFT: "warning",
  CONFIRMED: "positive",
  CANCELLED: "neutral",
};
/** El detalle usa la moneda congelada de la cotizacion, no una global. */
const money = (value: string | null | undefined, code?: string | null, symbol?: string | null) =>
  formatMoney(value, code, { symbolSnapshot: symbol ?? null });

/** Costos internos del taller: siempre en soles, aunque se emita en USD. */
const soles = (value: string | null | undefined) => formatMoney(value, "PEN");

function Metric({
  label,
  value,
  prominent = false,
  subtitle,
}: {
  label: string;
  value: string;
  prominent?: boolean;
  subtitle?: string;
}) {
  return (
    <div className={prominent ? "rounded-xl bg-zinc-950 p-4 text-white" : "rounded-xl bg-zinc-50 p-4"}>
      <dt className={`text-[11px] ${prominent ? "text-zinc-400" : "text-zinc-500"}`}>{label}</dt>
      <dd className={`${prominent ? "text-xl font-bold" : "text-sm font-semibold"} mt-1 tabular-nums`}>
        {value}
      </dd>
      {subtitle ? (
        <p className={`text-[10px] mt-0.5 tabular-nums ${prominent ? "text-zinc-400" : "text-zinc-400"}`}>
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

export function QuotationDetailPanel({ quote, canEdit }: { quote: QuotationOut; canEdit: boolean }) {
  const navigate = useNavigate();
  const confirm = useConfirmQuotation();
  const cancel = useCancelQuotation();
  const duplicate = useDuplicateQuotation();
  const updatePrice = useUpdateQuotationProductPrice();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmPrice, setConfirmPrice] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const stale = confirm.error instanceof ApiError && confirm.error.code === "SOURCE_CHANGED";
  const busy = confirm.isPending || cancel.isPending || duplicate.isPending || updatePrice.isPending || downloadingPdf;

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      const { blob, filename } = await fetchQuotationPdf(quote.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || `cotizacion-${quote.code}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setNotice("No se pudo descargar el PDF oficial.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const mutationError = confirm.error ?? cancel.error ?? duplicate.error ?? updatePrice.error;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-bold tracking-tight text-zinc-950">{quote.code}</h1>
            <Badge tone={statusTone[quote.status]}>{statusLabel[quote.status]}</Badge>
          </div>
          {quote.name ? (
            <h2 className="mt-1 text-base font-semibold text-zinc-900">{quote.name}</h2>
          ) : null}
          <p className="mt-1 text-sm font-medium text-zinc-800">
            {quote.product_internal_reference_snapshot || quote.product_internal_reference} · {quote.product_name_snapshot || quote.product_name}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Creada {quote.created_at.slice(0, 10)} · {quote.quantity} piezas
            {quote.confirmed_at ? ` · Confirmada ${quote.confirmed_at.slice(0, 10)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {quote.status === "CONFIRMED" || quote.status === "CANCELLED" ? (
            <SecondaryButton disabled={busy} onClick={handleDownloadPdf}>
              {downloadingPdf ? "Descargando…" : "Descargar PDF"}
            </SecondaryButton>
          ) : null}
          {canEdit ? (
            <>
              {quote.status === "DRAFT" && quote.workflow === "COTIZADOR" ? (
                <Link
                  to={`/cotizador/${quote.id}`}
                  className="inline-flex min-h-10 items-center rounded-xl bg-orange-700 px-4 text-sm font-medium text-white hover:bg-orange-800"
                >
                  Continuar en Cotizador
                </Link>
              ) : null}
              {quote.status === "DRAFT" && quote.workflow !== "COTIZADOR" ? (
                <Link
                  to={`/cotizaciones/${quote.id}/editar`}
                  className="inline-flex min-h-10 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                >
                  Editar
                </Link>
              ) : null}
              {quote.status === "DRAFT" ? (
                <PrimaryButton
                  disabled={busy}
                  onClick={() => {
                    setNotice(null);
                    confirm.mutate({ id: quote.id });
                  }}
                >
                  Confirmar
                </PrimaryButton>
              ) : null}
              {quote.status !== "CANCELLED" ? (
                <SecondaryButton disabled={busy} onClick={() => setConfirmCancel(true)}>
                  Anular
                </SecondaryButton>
              ) : null}
              <SecondaryButton
                disabled={busy}
                onClick={() =>
                  duplicate.mutate(quote.id, {
                    onSuccess: (copy) => navigate(copy.workflow === "COTIZADOR" ? `/cotizador/${copy.id}` : `/cotizaciones/${copy.id}`),
                  })
                }
              >
                Duplicar
              </SecondaryButton>
              {quote.status === "CONFIRMED" ? (
                <PrimaryButton disabled={busy} onClick={() => setConfirmPrice(true)}>
                  Actualizar precio
                </PrimaryButton>
              ) : null}
            </>
          ) : null}
        </div>
      </header>

      {mutationError ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>{describeError(mutationError)}</p>
          {stale ? (
            <button
              type="button"
              className="mt-3 rounded-xl bg-red-800 px-4 py-2 text-xs font-semibold text-white"
              onClick={() => confirm.mutate({ id: quote.id, accept: true })}
            >
              Aceptar nuevas fuentes y confirmar
            </button>
          ) : null}
        </div>
      ) : null}
      {notice ? (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {notice}
        </p>
      ) : null}
      {confirmCancel ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <span>La cotización conservará su historia, pero quedará anulada.</span>
          <div className="flex gap-2">
            <SecondaryButton onClick={() => setConfirmCancel(false)}>Volver</SecondaryButton>
            <PrimaryButton onClick={() => cancel.mutate(quote.id, { onSuccess: () => setConfirmCancel(false) })}>
              Confirmar anulación
            </PrimaryButton>
          </div>
        </div>
      ) : null}
      {confirmPrice ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          <span>
            Actualizar el precio vigente de {money(quote.current_sale_price_snapshot, quote.currency_code_snapshot, quote.currency_symbol_snapshot)} a {money(quote.commercial_sale_unit_price || quote.calculated_unit_price)}. El costo del producto no cambiará.
          </span>
          <div className="flex gap-2">
            <SecondaryButton onClick={() => setConfirmPrice(false)}>Volver</SecondaryButton>
            <PrimaryButton
              onClick={() =>
                updatePrice.mutate(quote.id, {
                  onSuccess: (result) => {
                    setConfirmPrice(false);
                    setNotice(`Precio actualizado a ${money(result.new_price)}.`);
                  },
                })
              }
            >
              Actualizar precio
            </PrimaryButton>
          </div>
        </div>
      ) : null}

      {/* Snapshot del Cliente */}
      {quote.customer_name_snapshot ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-950">Datos del cliente (congelados en emisión)</h2>
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded">
              Snapshot inmutable
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="block text-[10px] text-zinc-400">Razón social / Nombre:</span>
              <span className="font-medium text-zinc-900">{quote.customer_name_snapshot}</span>
            </div>
            <div>
              <span className="block text-[10px] text-zinc-400">Documento:</span>
              <span className="font-medium text-zinc-900">
                {quote.customer_document_type_snapshot ? `${quote.customer_document_type_snapshot} ` : ""}
                {quote.customer_document_number_snapshot || "Sin documento"}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-zinc-400">Teléfono / Celular:</span>
              <span className="font-medium text-zinc-900">{quote.customer_phone_snapshot || "—"}</span>
            </div>
            <div>
              <span className="block text-[10px] text-zinc-400">Correo:</span>
              <span className="font-medium text-zinc-900">{quote.customer_email_snapshot || "—"}</span>
            </div>
            {quote.customer_address_snapshot ? (
              <div className="sm:col-span-2 md:col-span-4 mt-1">
                <span className="block text-[10px] text-zinc-400">Dirección:</span>
                <span className="font-medium text-zinc-900">{quote.customer_address_snapshot}</span>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Snapshot Técnico de la Pieza */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-950">Especificaciones técnicas de la pieza</h2>
          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded">
            Snapshot inmutable
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="block text-[10px] text-zinc-400">Material / Pasta:</span>
            <span className="font-medium text-zinc-900">{quote.product_material_snapshot || "No especificado"}</span>
          </div>
          <div>
            <span className="block text-[10px] text-zinc-400">Gramaje por pieza:</span>
            <span className="font-medium text-zinc-900">
              {quote.product_grammage_snapshot ? `${quote.product_grammage_snapshot} g` : "—"}
            </span>
          </div>
          <div className="sm:col-span-2">
            <span className="block text-[10px] text-zinc-400">Dimensiones (Ancho × Alto × Largo × Prof.):</span>
            <span className="font-medium text-zinc-900">
              {quote.product_width_snapshot ?? "0"} × {quote.product_height_snapshot ?? "0"} × {quote.product_length_snapshot ?? "0"} × {quote.product_depth_snapshot ?? "0"} cm
            </span>
          </div>
        </div>
      </section>

      {/* Resumen Comercial y Costeo */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
        <h2 className="text-sm font-semibold text-zinc-950 mb-4">Desglose de costeo y precios comerciales</h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Materiales aplicados" value={soles(quote.materials_applied)} />
          <Metric label="Quema confirmada" value={soles(quote.firing_cost)} />
          <Metric label="Mano de obra" value={soles(quote.labor_cost)} />
          <Metric label="Costo de espacio" value={soles(quote.space_cost)} />
          <Metric
            label="Costo total interno"
            value={soles(quote.final_total_cost || quote.base_commercial_cost)}
            subtitle={`Unitario: ${soles(quote.final_unit_cost)}`}
          />
          <Metric
            label="Margen sobre costo"
            value={`${formatDecimalString(quote.effective_markup_percent || quote.markup_percent, 2)} %`}
            subtitle={`Ganancia unitaria: ${money(quote.effective_profit_unit || quote.target_profit_unit)}`}
          />
          <Metric
            label="Precio comercial unitario"
            value={money(quote.commercial_sale_unit_price || quote.calculated_unit_price)}
            prominent
            subtitle={`Sugerido: ${money(quote.suggested_commercial_unit_price, quote.currency_code_snapshot, quote.currency_symbol_snapshot)}`}
          />
          <Metric
            label="Subtotal comercial"
            value={money(quote.subtotal, quote.currency_code_snapshot, quote.currency_symbol_snapshot)}
            prominent
            subtitle={`Ganancia total: ${money(quote.effective_profit_total, quote.currency_code_snapshot, quote.currency_symbol_snapshot)}`}
          />
        </dl>

        {/* Fase 009F: la moneda se dice. Y si hay tasa, se dice cual: la
            CONGELADA de esta cotizacion, no la de hoy. */}
        <dl className="mt-4 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-3">
          <Metric label="Moneda" value={quote.currency_code_snapshot} />
          {quote.exchange_rate_snapshot ? (
            <Metric
              label="Tipo de cambio"
              value={exchangeRateLabel(quote.exchange_rate_snapshot) ?? "—"}
            />
          ) : null}
        </dl>

        <dl className="mt-4 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-3">
          <Metric label={`IGV (${formatDecimalString(quote.tax_percentage, 2)} %)`} value={money(quote.tax_amount, quote.currency_code_snapshot, quote.currency_symbol_snapshot)} />
          <Metric
            label="TOTAL COMERCIAL CON IGV"
            value={money(quote.total, quote.currency_code_snapshot, quote.currency_symbol_snapshot)}
            prominent
          />
          <Metric
            label="Precio unitario con IGV"
            value={money(quote.commercial_unit_price_with_tax || quote.unit_price_with_tax)}
            prominent
          />
        </dl>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <h2 className="text-sm font-semibold text-zinc-950">Fuentes congeladas</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-xs">
            <div>
              <dt className="text-zinc-500">Receta / versión</dt>
              <dd className="mt-1 font-medium">{quote.recipe_id ?? "—"} / {quote.recipe_version_id ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Quema / línea</dt>
              <dd className="mt-1 font-medium">{quote.firing_code_snapshot ?? "—"} / {quote.firing_line_id ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Material calculado</dt>
              <dd className="mt-1 font-medium">{money(quote.materials_calculated)}</dd>
              <dd className="text-[11px] text-zinc-500">
                {formatDecimalString(quote.material_grams_per_piece, 2)} g/pieza · {formatDecimalString(quote.material_total_grams, 2)} g en total
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Precio vigente al calcular</dt>
              <dd className="mt-1 font-medium">{money(quote.current_sale_price_snapshot, quote.currency_code_snapshot, quote.currency_symbol_snapshot)}</dd>
            </div>
          </dl>
        </section>
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <h2 className="text-sm font-semibold text-zinc-950">Días</h2>
          <dl className="mt-4 grid grid-cols-4 gap-3 text-center text-xs">
            <div>
              <dt className="text-zinc-500">Calculados</dt>
              <dd className="mt-1 text-lg font-bold">{quote.calculated_days}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Ajuste</dt>
              <dd className="mt-1 text-lg font-bold">{quote.days_adjustment}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Espera</dt>
              <dd className="mt-1 text-lg font-bold">{quote.waiting_days}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Total</dt>
              <dd className="mt-1 text-lg font-bold">{quote.total_days}</dd>
            </div>
          </dl>
        </section>
      </div>

      <LineTable
        title="Técnicas"
        columns={["Técnica", "Cantidad", "Días propuestos", "Días aplicados", "Costo propuesto", "Costo aplicado"]}
        rows={quote.techniques.map((line) => [
          line.name_snapshot,
          String(line.quantity),
          String(line.proposed_days),
          String(line.applied_days),
          money(line.proposed_cost),
          money(line.applied_cost),
        ])}
      />
      <LineTable
        title="Adicionales"
        columns={["Adicional", "Fórmula", "Cantidad", "Costo propuesto", "Costo aplicado"]}
        rows={quote.additionals.map((line) => [
          line.name_snapshot,
          line.formula_explanation,
          line.additional_quantity ?? "—",
          money(line.proposed_cost),
          money(line.applied_cost),
        ])}
      />
      <LineTable
        title="Otros gastos"
        columns={["Concepto", "Tipo", "Valor aplicado", "Costo"]}
        rows={quote.other_costs.map((line) => [
          line.name_snapshot,
          line.calculation_type_snapshot,
          money(line.unit_price_snapshot),
          money(line.applied_cost),
        ])}
      />
    </div>
  );
}

function LineTable({ title, columns, rows }: { title: string; columns: string[]; rows: string[][] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs">
      <h2 className="border-b border-zinc-100 px-5 py-4 text-sm font-semibold text-zinc-950">{title}</h2>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-xs text-zinc-500">Sin registros.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="px-4 py-3 font-semibold">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((row, index) => (
                <tr key={`${title}-${index}`}>
                  {row.map((cell, position) => (
                    <td key={`${index}-${position}`} className="px-4 py-3 text-zinc-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
