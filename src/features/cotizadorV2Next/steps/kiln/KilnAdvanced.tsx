import { DecimalField } from "@/components/DecimalField";
import type { ResultadoDeGuardado } from "@/components/borradores";
import { formatCosto } from "@/features/cotizadorV2/moneda";
import { formatPercentage } from "@/features/firings/labels";
import type { V2Firing, V2FiringInput } from "@/types/quoterV2Firing";

export type FiringDeferredPatch = Omit<V2FiringInput, "piece_separation_cm"> & {
  piece_separation_cm?: string | null;
};

type GuardarDiferido = (
  payload: FiringDeferredPatch,
) => void | Promise<ResultadoDeGuardado>;

const PISTA_ACUERDO = "Acordada en esta cotización. Vacíelo para volver al maestro.";

function Dato({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-800 tabular-nums">{value}</dd>
      {hint ? <dd className="mt-0.5 text-[11.5px] text-zinc-500">{hint}</dd> : null}
    </div>
  );
}

function CargasPorHornada({ cargas }: { cargas: readonly string[] }) {
  if (cargas.length === 0) {
    return <p className="text-sm text-zinc-500">Todavía no hay hornadas calculadas.</p>;
  }

  return (
    <ol className="space-y-2">
      {cargas.map((carga, indice) => {
        const ancho = Math.max(0, Math.min(100, Number(carga)));
        return (
          <li key={indice} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-xs text-zinc-600">Hornada {indice + 1}</span>
            <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-100">
              <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${ancho}%` }} />
            </span>
            <span className="w-16 shrink-0 text-right text-xs tabular-nums text-zinc-600">
              {formatPercentage(carga)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function RepartoPorPieza({ quema }: { quema: V2Firing }) {
  if (quema.lines.length === 0) {
    return <p className="text-sm text-zinc-500">No hay piezas con reparto de quema.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[42rem] text-left text-sm">
        <thead>
          <tr className="text-xs text-zinc-500">
            <th className="px-3 py-2 font-medium">Pieza</th>
            <th className="px-3 py-2 font-medium">Cant.</th>
            <th className="px-3 py-2 font-medium">Volumen</th>
            <th className="px-3 py-2 font-medium">% del horno</th>
            <th className="px-3 py-2 font-medium">Tarifa</th>
            <th className="px-3 py-2 font-medium">Gas</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/[0.06]">
          {quema.lines.map((linea) => (
            <tr key={linea.line_id}>
              <td className="px-3 py-2 text-zinc-800">{linea.product_name ?? `Línea ${linea.line_id}`}</td>
              <td className="px-3 py-2 tabular-nums text-zinc-600">{linea.quantity}</td>
              <td className="px-3 py-2 tabular-nums text-zinc-600">
                {linea.total_volume_cm3} cm³
              </td>
              <td className="px-3 py-2 tabular-nums text-zinc-600">
                {formatPercentage(linea.occupancy_percent)}
              </td>
              <td className="px-3 py-2 tabular-nums text-zinc-800">
                {formatCosto(linea.commercial_cost)}
              </td>
              <td className="px-3 py-2 tabular-nums text-zinc-600">
                {formatCosto(linea.gas_cost)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TotalesDeQuema({ quema }: { quema: V2Firing }) {
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Dato label="Tarifa de quema" value={formatCosto(quema.commercial_total)} />
      <Dato label="Gas real" value={formatCosto(quema.gas_total)} />
      <Dato
        label="Diferencia de quema"
        value={formatCosto(quema.difference)}
        hint="No es el margen de la cotización."
      />
    </dl>
  );
}

function ValoresSoloLectura({ quema }: { quema: V2Firing }) {
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Dato label="Separación entre piezas" value={`${quema.piece_separation_cm} cm`} />
      <Dato label="Tarifa baja" value={formatCosto(quema.commercial_rate_low)} />
      <Dato label="Tarifa alta" value={formatCosto(quema.commercial_rate_high)} />
      <Dato label="Gas baja" value={formatCosto(quema.gas_cost_low)} />
      <Dato label="Gas alta" value={formatCosto(quema.gas_cost_high)} />
      <Dato label="Carga facturada" value={`${quema.billed_load} hornadas`} />
    </dl>
  );
}

export function KilnAdvanced({
  quema,
  canEdit,
  guardarDiferido,
}: {
  quema: V2Firing;
  canEdit: boolean;
  guardarDiferido: GuardarDiferido;
}) {
  return (
    <details
      data-testid="v2next-horno-avanzado"
      className="rounded-2xl border border-black/[0.06] bg-white/60 p-4 [&[open]>summary]:mb-4"
    >
      <summary className="cursor-pointer text-[13px] font-semibold text-zinc-700">
        Ajustes de carga y tarifas
      </summary>

      <div className="space-y-5">
        {canEdit ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DecimalField
              label="Separación entre piezas"
              value={quema.piece_separation_cm}
              onCommit={(valor) => guardarDiferido({ piece_separation_cm: valor })}
              sufijo="cm"
              hint="Se suma al volumen que calcula el backend."
            />
            <DecimalField
              label="Tarifa baja"
              value={quema.commercial_rate_low ?? ""}
              onCommit={(valor) => guardarDiferido({ commercial_rate_low_override: valor })}
              hint={quema.commercial_low_is_override ? PISTA_ACUERDO : undefined}
            />
            <DecimalField
              label="Tarifa alta"
              value={quema.commercial_rate_high ?? ""}
              onCommit={(valor) => guardarDiferido({ commercial_rate_high_override: valor })}
              hint={quema.commercial_high_is_override ? PISTA_ACUERDO : undefined}
            />
            <DecimalField
              label="Gas baja"
              value={quema.gas_cost_low ?? ""}
              onCommit={(valor) => guardarDiferido({ gas_cost_low_override: valor })}
              hint={quema.gas_low_is_override ? PISTA_ACUERDO : undefined}
            />
            <DecimalField
              label="Gas alta"
              value={quema.gas_cost_high ?? ""}
              onCommit={(valor) => guardarDiferido({ gas_cost_high_override: valor })}
              hint={quema.gas_high_is_override ? PISTA_ACUERDO : undefined}
            />
          </div>
        ) : (
          <ValoresSoloLectura quema={quema} />
        )}

        <section className="rounded-2xl border border-black/[0.06] bg-white/60 p-4">
          <h3 className="text-xs font-semibold text-zinc-700">Totales de quema</h3>
          <div className="mt-3">
            <TotalesDeQuema quema={quema} />
          </div>
        </section>

        <section className="rounded-2xl border border-black/[0.06] bg-white/60 p-4">
          <h3 className="text-xs font-semibold text-zinc-700">Carga de cada hornada</h3>
          <p className="mt-1 text-[11.5px] text-zinc-500">
            Es la carga que calculó el backend; la pantalla no decide hornadas.
          </p>
          <div className="mt-3">
            <CargasPorHornada cargas={quema.batch_loads} />
          </div>
        </section>

        <section className="rounded-2xl border border-black/[0.06] bg-white/60 p-4">
          <h3 className="text-xs font-semibold text-zinc-700">Reparto por pieza</h3>
          <p className="mt-1 text-[11.5px] text-zinc-500">
            La quema se reparte por volumen; los importes ya llegan calculados.
          </p>
          <div className="mt-3">
            <RepartoPorPieza quema={quema} />
          </div>
        </section>
      </div>
    </details>
  );
}
