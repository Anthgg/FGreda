/**
 * Detalle de una hoja de quema.
 *
 * Cuando la hoja esta confirmada se muestra el **snapshot**: la tarifa que se
 * le aplico, no la vigente hoy. Recalcular una quema pasada con las tarifas de
 * ahora seria reescribir la historia.
 */

import { Link } from "react-router-dom";

import { PrimaryButton, SecondaryButton } from "@/components/form";
import { Badge } from "@/features/masters/MasterTable";
import {
  FIRING_STATUS_LABEL,
  FIRING_STATUS_TONE,
  FIRING_TYPE_LABEL,
  formatDecimalString,
  formatPercentage,
} from "@/features/firings/labels";
import type { FiringOut } from "@/types/firings";

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-black/[0.04] bg-white/40 p-3 shadow-2xs">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
      <p className="mt-0.5 truncate text-sm font-bold tabular-nums text-zinc-900">{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-zinc-400">{hint}</p> : null}
    </div>
  );
}

interface FiringDetailPanelProps {
  firing: FiringOut;
  canEdit: boolean;
  onConfirm: (firing: FiringOut) => void;
  onCancel: (firing: FiringOut) => void;
  isBusy: boolean;
  /** En móvil el detalle es una vista propia y hace falta volver. */
  onBack?: (() => void) | undefined;
}

export function FiringDetailPanel({
  firing,
  canEdit,
  onConfirm,
  onCancel,
  isBusy,
  onBack,
}: FiringDetailPanelProps) {
  const esBorrador = firing.status === "DRAFT";
  const congelada = firing.status === "CONFIRMED";

  return (
    <div className="space-y-4">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-medium text-zinc-500 hover:text-zinc-900 xl:hidden cursor-pointer"
        >
          ← Volver al listado
        </button>
      ) : null}

      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-black/[0.04] pb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-mono text-sm font-bold text-zinc-900">{firing.code}</h2>
            <Badge tone={FIRING_STATUS_TONE[firing.status]}>
              {FIRING_STATUS_LABEL[firing.status]}
            </Badge>
          </div>
          <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-zinc-500">
            <div className="flex gap-1">
              <dt className="text-zinc-400">Fecha de quema:</dt>
              <dd className="text-zinc-700 font-medium">{firing.firing_date ?? "sin fijar"}</dd>
            </div>
            {firing.confirmed_at ? (
              <div className="flex gap-1">
                <dt className="text-zinc-400">Confirmada:</dt>
                <dd className="text-zinc-700">{firing.confirmed_at.slice(0, 10)}</dd>
              </div>
            ) : null}
            {firing.cancelled_at ? (
              <div className="flex gap-1">
                <dt className="text-zinc-400">Anulada:</dt>
                <dd className="text-zinc-700">{firing.cancelled_at.slice(0, 10)}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            {esBorrador ? (
              <>
                <Link
                  to={`/quemas/${firing.id}/editar`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-black/[0.08] bg-white/70 px-3.5 py-2 text-xs font-semibold text-zinc-800 shadow-2xs hover:bg-white hover:text-black transition-colors"
                >
                  <svg className="size-3.5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Editar
                </Link>
                <PrimaryButton type="button" onClick={() => onConfirm(firing)} disabled={isBusy}>
                  Confirmar
                </PrimaryButton>
              </>
            ) : null}
            {firing.status !== "CANCELLED" ? (
              <SecondaryButton onClick={() => onCancel(firing)} disabled={isBusy}>
                Anular
              </SecondaryButton>
            ) : null}
          </div>
        ) : null}
      </header>

      {congelada ? (
        <p className="rounded-2xl border border-black/[0.04] bg-white/40 px-3.5 py-2.5 text-xs text-zinc-600">
          Hoja confirmada. Los importes son los que se aplicaron al confirmarla; cambiar una
          tarifa hoy no los modifica. El IGV es informativo y usa la tasa comercial vigente.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metric
          label="Volumen total"
          value={`${formatDecimalString(firing.total_volume_cm3, 0)} cm³`}
        />
        <Metric
          label="Ocupación"
          value={formatPercentage(firing.occupancy_percentage)}
          hint="Sesión más cargada"
        />
        <Metric label="Costo base" value={formatDecimalString(firing.subtotal, 2)} />
        <Metric
          label="Quema sin IGV"
          value={`${firing.currency_symbol} ${formatDecimalString(firing.total_cost, 2)}`}
        />
        <Metric
          label={`IGV (${formatDecimalString(firing.tax_percentage, 2)}%)`}
          value={`${firing.currency_symbol} ${formatDecimalString(firing.tax_amount, 2)}`}
        />
        <Metric
          label="Quema con IGV"
          value={`${firing.currency_symbol} ${formatDecimalString(firing.total_with_tax, 2)}`}
        />
      </div>

      {/* Sesiones */}
      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-950">
          Sesiones de horno
        </h3>
        <div className="overflow-x-auto rounded-2xl border border-black/[0.04] bg-white/40">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-black/[0.04] bg-black/[0.02] text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="px-3 py-2">Horno</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2 text-right">
                  {congelada ? "Tarifa aplicada" : "Tarifa"}
                </th>
                <th className="px-3 py-2 text-right">Capacidad</th>
                <th className="px-3 py-2 text-right">Ocupación</th>
                <th className="px-3 py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.03]">
              {firing.sessions.map((sesion) => (
                <tr key={`${sesion.kiln_id}-${sesion.firing_type}`}>
                  <td className="px-3 py-2 font-medium text-zinc-900">{sesion.kiln_name}</td>
                  <td className="px-3 py-2">{FIRING_TYPE_LABEL[sesion.firing_type]}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatDecimalString(sesion.rate_snapshot, 2)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                    {formatDecimalString(sesion.capacity_snapshot, 0)} cm³
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                    {formatPercentage(sesion.physical_occupancy_percentage)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-zinc-900">
                    {formatDecimalString(sesion.subtotal, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Piezas */}
      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-950">Piezas</h3>
        <div className="overflow-x-auto rounded-2xl border border-black/[0.04] bg-white/40">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-black/[0.04] bg-black/[0.02] text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="px-3 py-2">Pieza</th>
                <th className="px-3 py-2 text-right">Cant.</th>
                <th className="px-3 py-2 text-right">Dimensiones</th>
                <th className="px-3 py-2 text-right">Volumen</th>
                <th className="px-3 py-2 text-right">Reparto</th>
                <th className="px-3 py-2 text-right">Ocup.</th>
                <th className="px-3 py-2 text-right">Factor</th>
                <th className="px-3 py-2 text-right">Costo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.03]">
              {firing.lines.map((linea) => (
                <tr key={linea.id ?? linea.description} className="hover:bg-white/60 transition-colors">
                  <td className="px-3 py-2">
                    <span className="font-medium text-zinc-900">{linea.description}</span>
                    {linea.product_internal_reference ? (
                      <span className="ml-2 font-mono text-[10px] text-zinc-400">
                        {linea.product_internal_reference}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{linea.quantity}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                    {formatDecimalString(linea.length_cm, 1)}×
                    {formatDecimalString(linea.width_cm, 1)}×
                    {formatDecimalString(linea.height_cm, 1)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatDecimalString(linea.total_volume_cm3, 0)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                    {formatDecimalString(linea.base_cost, 2)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                    {formatPercentage(linea.occupancy_percentage)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                    ×{formatDecimalString(linea.occupancy_factor, 2)}
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-zinc-900">
                    {formatDecimalString(linea.allocated_cost, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {firing.notes ? (
        <p className="text-xs text-zinc-600">
          <span className="font-medium text-zinc-500">Notas: </span>
          {firing.notes}
        </p>
      ) : null}
    </div>
  );
}
