import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ApiError } from "@/api/client";
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

const statusLabel: Record<QuotationStatus, string> = { DRAFT: "Borrador", CONFIRMED: "Confirmada", CANCELLED: "Anulada" };
const statusTone: Record<QuotationStatus, "warning" | "positive" | "neutral"> = { DRAFT: "warning", CONFIRMED: "positive", CANCELLED: "neutral" };
const money = (value: string | null | undefined) => `S/ ${formatDecimalString(value, 2)}`;

function Metric({ label, value, prominent = false }: { label: string; value: string; prominent?: boolean }) {
  return <div className={prominent ? "rounded-xl bg-zinc-950 p-4 text-white" : "rounded-xl bg-zinc-50 p-4"}><dt className={`text-[11px] ${prominent ? "text-zinc-400" : "text-zinc-500"}`}>{label}</dt><dd className={`${prominent ? "text-xl" : "text-sm"} mt-1 font-bold tabular-nums`}>{value}</dd></div>;
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
  const stale = confirm.error instanceof ApiError && confirm.error.code === "SOURCE_CHANGED";
  const busy = confirm.isPending || cancel.isPending || duplicate.isPending || updatePrice.isPending;

  const mutationError = confirm.error ?? cancel.error ?? duplicate.error ?? updatePrice.error;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="flex items-center gap-3"><h1 className="font-mono text-2xl font-bold tracking-tight text-zinc-950">{quote.code}</h1><Badge tone={statusTone[quote.status]}>{statusLabel[quote.status]}</Badge></div>
          <p className="mt-2 text-sm font-medium text-zinc-800">{quote.product_internal_reference} · {quote.product_name}</p>
          <p className="mt-1 text-xs text-zinc-500">Creada {quote.created_at.slice(0, 10)} · {quote.quantity} piezas</p>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap justify-end gap-2">
            {quote.status === "DRAFT" ? <Link to={`/cotizaciones/${quote.id}/editar`} className="inline-flex min-h-10 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50">Editar</Link> : null}
            {quote.status === "DRAFT" ? <PrimaryButton disabled={busy} onClick={() => { setNotice(null); confirm.mutate({ id: quote.id }); }}>Confirmar</PrimaryButton> : null}
            {quote.status !== "CANCELLED" ? <SecondaryButton disabled={busy} onClick={() => setConfirmCancel(true)}>Anular</SecondaryButton> : null}
            <SecondaryButton disabled={busy} onClick={() => duplicate.mutate(quote.id, { onSuccess: (copy) => navigate(`/cotizaciones/${copy.id}`) })}>Duplicar</SecondaryButton>
            {quote.status === "CONFIRMED" ? <PrimaryButton disabled={busy} onClick={() => setConfirmPrice(true)}>Actualizar precio</PrimaryButton> : null}
          </div>
        ) : null}
      </header>

      {mutationError ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>{describeError(mutationError)}</p>
          {stale ? <button type="button" className="mt-3 rounded-xl bg-red-800 px-4 py-2 text-xs font-semibold text-white" onClick={() => confirm.mutate({ id: quote.id, accept: true })}>Aceptar nuevas fuentes y confirmar</button> : null}
        </div>
      ) : null}
      {notice ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p> : null}
      {confirmCancel ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <span>La cotización conservará su historia, pero quedará anulada.</span>
          <div className="flex gap-2"><SecondaryButton onClick={() => setConfirmCancel(false)}>Volver</SecondaryButton><PrimaryButton onClick={() => cancel.mutate(quote.id, { onSuccess: () => setConfirmCancel(false) })}>Confirmar anulación</PrimaryButton></div>
        </div>
      ) : null}
      {confirmPrice ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          <span>Actualizar el precio vigente de {money(quote.current_sale_price_snapshot)} a {money(quote.calculated_unit_price)}. El costo del producto no cambiará.</span>
          <div className="flex gap-2"><SecondaryButton onClick={() => setConfirmPrice(false)}>Volver</SecondaryButton><PrimaryButton onClick={() => updatePrice.mutate(quote.id, { onSuccess: (result) => { setConfirmPrice(false); setNotice(`Precio actualizado a ${money(result.new_price)}.`); } })}>Actualizar precio</PrimaryButton></div>
        </div>
      ) : null}

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Materiales aplicados" value={money(quote.materials_applied)} />
        <Metric label="Quema" value={money(quote.firing_cost)} />
        <Metric label="Mano de obra" value={money(quote.labor_cost)} />
        <Metric label="Costo espacio" value={money(quote.space_cost)} />
        <Metric label="Subtotal base" value={money(quote.base_commercial_cost)} />
        <Metric label="Factor comercial" value={quote.commercial_factor} />
        <Metric label="Precio total sin IGV" value={money(quote.calculated_total)} prominent />
        <Metric label="Precio unitario sin IGV" value={money(quote.calculated_unit_price)} prominent />
      </dl>

      {/* La cotización se negocia neta; el documento que se entrega muestra las
          dos cifras, y por eso el IGV se guarda calculado, no se deduce luego. */}
      <dl className="grid gap-3 rounded-2xl border border-zinc-300 bg-zinc-50 p-4 sm:grid-cols-3">
        <Metric label={`IGV (${formatDecimalString(quote.tax_percentage, 2)} %)`} value={money(quote.tax_amount)} />
        <Metric label="Precio total con IGV" value={money(quote.total_with_tax)} prominent />
        <Metric label="Precio unitario con IGV" value={money(quote.unit_price_with_tax)} prominent />
      </dl>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-950">Fuentes congeladas</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-xs"><div><dt className="text-zinc-500">Receta / versión</dt><dd className="mt-1 font-medium">{quote.recipe_id ?? "—"} / {quote.recipe_version_id ?? "—"}</dd></div><div><dt className="text-zinc-500">Quema / línea</dt><dd className="mt-1 font-medium">{quote.firing_code_snapshot ?? "—"} / {quote.firing_line_id ?? "—"}</dd></div><div><dt className="text-zinc-500">Material calculado</dt><dd className="mt-1 font-medium">{money(quote.materials_calculated)}</dd><dd className="text-[11px] text-zinc-500">{formatDecimalString(quote.material_grams_per_piece, 2)} g/pieza · {formatDecimalString(quote.material_total_grams, 2)} g en total</dd></div><div><dt className="text-zinc-500">Precio vigente al calcular</dt><dd className="mt-1 font-medium">{money(quote.current_sale_price_snapshot)}</dd></div></dl>
        </section>
        <section className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-950">Días</h2>
          <dl className="mt-4 grid grid-cols-4 gap-3 text-center text-xs"><div><dt className="text-zinc-500">Calculados</dt><dd className="mt-1 text-lg font-bold">{quote.calculated_days}</dd></div><div><dt className="text-zinc-500">Ajuste</dt><dd className="mt-1 text-lg font-bold">{quote.days_adjustment}</dd></div><div><dt className="text-zinc-500">Espera</dt><dd className="mt-1 text-lg font-bold">{quote.waiting_days}</dd></div><div><dt className="text-zinc-500">Total</dt><dd className="mt-1 text-lg font-bold">{quote.total_days}</dd></div></dl>
        </section>
      </div>

      <LineTable title="Técnicas" columns={["Técnica", "Cantidad", "Días propuestos", "Días aplicados", "Costo propuesto", "Costo aplicado"]} rows={quote.techniques.map((line) => [line.name_snapshot, String(line.quantity), String(line.proposed_days), String(line.applied_days), money(line.proposed_cost), money(line.applied_cost)])} />
      <LineTable title="Adicionales" columns={["Adicional", "Fórmula", "Cantidad", "Costo propuesto", "Costo aplicado"]} rows={quote.additionals.map((line) => [line.name_snapshot, line.formula_explanation, line.additional_quantity ?? "—", money(line.proposed_cost), money(line.applied_cost)])} />
      <LineTable title="Otros gastos" columns={["Concepto", "Tipo", "Valor aplicado", "Costo"]} rows={quote.other_costs.map((line) => [line.name_snapshot, line.calculation_type_snapshot, money(line.unit_price_snapshot), money(line.applied_cost)])} />

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
        IGV_RULE_SOURCE: NOT_FOUND · DISCOUNT_RULE_SOURCE: NOT_FOUND. Estas reglas permanecen bloqueadas y no alteran el total.
      </div>
    </div>
  );
}

function LineTable({ title, columns, rows }: { title: string; columns: string[]; rows: string[][] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <h2 className="border-b border-zinc-100 px-5 py-4 text-sm font-semibold text-zinc-950">{title}</h2>
      {rows.length === 0 ? <p className="px-5 py-8 text-center text-xs text-zinc-500">Sin registros.</p> : <div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500"><tr>{columns.map((column) => <th key={column} className="px-4 py-3 font-semibold">{column}</th>)}</tr></thead><tbody className="divide-y divide-zinc-100">{rows.map((row, index) => <tr key={`${title}-${index}`}>{row.map((cell, position) => <td key={`${index}-${position}`} className="px-4 py-3 text-zinc-700">{cell}</td>)}</tr>)}</tbody></table></div>}
    </section>
  );
}
