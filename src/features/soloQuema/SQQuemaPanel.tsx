import { DecimalField } from "@/components/DecimalField";
import { SelectField } from "@/components/form";
import { Panel } from "@/features/masters/MasterTable";
import { describeError } from "@/features/settings/messages";
import { useUpdateFiringQuotation } from "@/features/soloQuema/useSoloQuema";
import type { V2FiringQuotation, V2FiringQuotationKiln } from "@/types/firingQuotationV2";
import type { V2CustomerKind } from "@/types/quoterV2";
import { CUSTOMER_KIND_LABEL, FIRING_MODE_LABEL, type V2FiringMode } from "@/types/quoterV2Firing";

/**
 * El horno, el ciclo y la modalidad de un servicio de Solo Quema. Fase 010K.
 *
 * Las tres decisiones que mueven el precio están juntas a propósito: el horno
 * decide cuánta ocupación hay, el ciclo decide qué tarifas entran y la
 * modalidad decide si se cobra la fracción ocupada o la hornada entera.
 * Repartirlas en tres pantallas obligaría a ir y volver para entender por qué
 * cambió el total.
 *
 * ## El comparador compara, no elige
 *
 * La tabla enseña lo que costaría el mismo pedido en cada horno y en las dos
 * modalidades. Es una tabla de lectura: ni el horno ni el modo cambian solos.
 * La sugerencia de abajo es una frase, y quien cotiza decide si la sigue.
 *
 * ## El gas no es el precio
 *
 * El gas es COSTO interno y por eso vive en la columna gris, separado de la
 * tarifa comercial, y no aparece en el documento del cliente. Sumarlos en una
 * sola cifra sería perder de vista de dónde sale la ganancia.
 */

const SIN_HORNO = "";

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
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="text-sm text-zinc-800">{value}</dd>
      {hint ? <dd className="text-[11px] text-zinc-500">{hint}</dd> : null}
    </div>
  );
}

/** Lo que costaría este mismo pedido en cada horno, en las dos modalidades. */
function ComparadorDeHornos({ cotizacion }: { cotizacion: V2FiringQuotation }) {
  if (cotizacion.kilns.length === 0) return null;
  const importe = (valor: string | undefined | null) => valor ?? "Sin tarifas";
  return (
    <div
      className="mt-4 overflow-x-auto rounded-2xl border border-black/[0.06]"
      data-testid="comparacion-hornos"
    >
      <table className="w-full min-w-[42rem] text-left text-sm">
        <caption className="px-4 pt-3 text-left text-xs text-zinc-500">
          El mismo pedido en cada horno y en las dos modalidades. Comparar no cambia nada: el horno
          y el modo elegidos siguen siendo los de arriba.
        </caption>
        <thead>
          <tr className="text-xs text-zinc-500">
            <th className="px-4 py-2 font-medium">Horno</th>
            <th className="px-4 py-2 font-medium">Ocupación</th>
            <th className="px-4 py-2 font-medium">Hornadas</th>
            <th className="px-4 py-2 font-medium">Compartida</th>
            <th className="px-4 py-2 font-medium">Exclusiva</th>
            <th className="px-4 py-2 font-medium">Gas (compartida)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {cotizacion.kilns.map((horno: V2FiringQuotationKiln) => (
            <tr key={horno.kiln_id} className={horno.selected ? "bg-emerald-50/40" : undefined}>
              <td className="px-4 py-2 text-zinc-800">
                {horno.name}
                {horno.selected ? (
                  <span className="ml-2 text-[11px] text-zinc-500">(elegido)</span>
                ) : null}
                {horno.active ? null : (
                  <span className="ml-2 text-[11px] text-amber-700">(dado de baja)</span>
                )}
              </td>
              <td className="px-4 py-2 text-zinc-600">{horno.occupancy_percent} %</td>
              <td className="px-4 py-2 text-zinc-600">{horno.firing_count}</td>
              <td className="px-4 py-2 text-zinc-800">{importe(horno.shared?.commercial)}</td>
              <td className="px-4 py-2 text-zinc-800">{importe(horno.exclusive?.commercial)}</td>
              <td className="px-4 py-2 text-zinc-600">{importe(horno.shared?.gas)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Cuánta carga lleva cada hornada. Información, no reparto de costo. */
function CargaPorHornada({
  cargas,
  modo,
}: {
  cargas: readonly string[];
  modo: V2FiringMode;
}) {
  if (cargas.length === 0) return null;
  return (
    <div className="mt-4 rounded-2xl border border-black/[0.06] p-4" data-testid="carga-hornadas">
      <h3 className="text-xs font-semibold text-zinc-700">Carga de cada hornada</h3>
      <p className="mt-1 text-[11px] text-zinc-500">
        {modo === "SHARED"
          ? "Compartida: la última hornada viaja con otras piezas del taller y se cobra por lo que ocupa."
          : "Exclusiva: cada hornada se cobra entera, aunque la última vaya a medias."}
      </p>
      <ul className="mt-3 space-y-2">
        {cargas.map((carga, indice) => (
          <li key={indice} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-xs text-zinc-600">Hornada {indice + 1}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-black/5">
              <span
                className="block h-full rounded-full bg-orange-400"
                style={{ width: `${Math.min(100, Number(carga))}%` }}
              />
            </span>
            <span className="w-16 shrink-0 text-right text-xs text-zinc-600">
              {Number(carga).toFixed(1)} %
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SQQuemaPanel({
  cotizacion,
  canEdit,
}: {
  cotizacion: V2FiringQuotation;
  canEdit: boolean;
}) {
  const guardar = useUpdateFiringQuotation(cotizacion.id);

  return (
    <Panel>
      <div data-testid="panel-quema-solo">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">Horno, ciclo y modalidad</h2>
          <span className="text-xs text-zinc-500">
            Tarifa de quema: <strong>{cotizacion.firing_commercial_total}</strong> · Gas real:{" "}
            <strong>{cotizacion.firing_gas_total}</strong>
          </span>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          El gas es costo del taller y no sale en el documento del cliente. Lo que se cobra es la
          tarifa de quema.
        </p>

        {cotizacion.suggestion ? (
          <p
            className="mt-3 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900"
            data-testid="sugerencia-horno"
          >
            «{cotizacion.suggestion.name}» dejaría la quema en{" "}
            <strong>{cotizacion.suggestion.commercial}</strong>, {cotizacion.suggestion.savings}{" "}
            menos.
            <span className="ml-1 text-xs text-sky-800">
              Es una sugerencia: el horno no se cambia solo.
            </span>
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField
            label="Horno"
            requirement="required"
            value={cotizacion.kiln_id === null ? SIN_HORNO : String(cotizacion.kiln_id)}
            options={[
              { value: SIN_HORNO, label: "Sin horno todavía" },
              ...cotizacion.kilns.map((horno) => ({
                value: String(horno.kiln_id),
                label: `${horno.name} · ${horno.capacity_cm3} cm³${horno.active ? "" : " (de baja)"}`,
              })),
            ]}
            onChange={(valor) =>
              guardar.mutate({ kiln_id: valor === SIN_HORNO ? null : Number(valor) })
            }
            disabled={!canEdit}
            hint="Se elige a mano. El sistema sugiere, pero no cambia el horno por su cuenta."
          />
          <SelectField
            label="Modalidad"
            requirement="required"
            value={cotizacion.firing_mode}
            options={(["SHARED", "EXCLUSIVE"] as V2FiringMode[]).map((valor) => ({
              value: valor,
              label: FIRING_MODE_LABEL[valor],
            }))}
            onChange={(valor) => guardar.mutate({ firing_mode: valor as V2FiringMode })}
            disabled={!canEdit}
            hint="Compartida cobra lo que ocupa; exclusiva reserva hornadas enteras."
          />
          <SelectField
            label="Tipo de cliente"
            requirement="required"
            value={cotizacion.customer_kind}
            options={(["EXTERNAL", "STUDENT"] as V2CustomerKind[]).map((valor) => ({
              value: valor,
              label: CUSTOMER_KIND_LABEL[valor],
            }))}
            onChange={(valor) => guardar.mutate({ customer_kind: valor as V2CustomerKind })}
            disabled={!canEdit}
            hint="Cambia la tarifa. El gas que se consume es el mismo."
          />
          <SelectField
            label="Quema baja"
            requirement="optional"
            value={cotizacion.low_fire_enabled ? "SI" : "NO"}
            options={[
              { value: "SI", label: "Sí" },
              { value: "NO", label: "No" },
            ]}
            onChange={(valor) => guardar.mutate({ low_fire_enabled: valor === "SI" })}
            disabled={!canEdit}
            hint="Bizcocho. Se cobra y se costea aparte de la alta."
          />
          <SelectField
            label="Quema alta"
            requirement="optional"
            value={cotizacion.high_fire_enabled ? "SI" : "NO"}
            options={[
              { value: "SI", label: "Sí" },
              { value: "NO", label: "No" },
            ]}
            onChange={(valor) => guardar.mutate({ high_fire_enabled: valor === "SI" })}
            disabled={!canEdit}
            hint="Vidriado o gres. Puede ir sola, o con la baja."
          />
          <DecimalField
            label="Separación entre piezas (cm)"
            value={cotizacion.piece_separation_cm}
            onCommit={(valor) => {
              if (valor === null) return;
              guardar.mutate({ piece_separation_cm: valor });
            }}
            disabled={!canEdit}
            hint="Se suma a largo, ancho y alto de cada pieza. 0 = sin separación."
          />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-4 rounded-2xl border border-black/[0.06] p-4 sm:grid-cols-4">
          <Dato
            label="Capacidad del horno"
            value={cotizacion.kiln_capacity_cm3 ?? "—"}
            hint="Congelada al elegirlo."
          />
          <Dato label="Volumen total" value={`${cotizacion.total_volume_cm3} cm³`} />
          <Dato label="Ocupación" value={`${cotizacion.occupancy_percent} %`} />
          <Dato
            label="Hornadas físicas"
            value={String(cotizacion.firing_count)}
            hint="Cuántas veces se enciende."
          />
          <Dato
            label="Carga facturada"
            value={`${cotizacion.billed_load} hornadas`}
            hint={
              cotizacion.firing_mode === "SHARED"
                ? "Ocupación / 100: se cobra lo que ocupa."
                : "Hornadas enteras."
            }
          />
          <Dato label="Tarifa baja" value={cotizacion.commercial_rate_low ?? "—"} />
          <Dato label="Tarifa alta" value={cotizacion.commercial_rate_high ?? "—"} />
          <Dato
            label="Gas real"
            value={cotizacion.firing_gas_total}
            hint="Costo interno. No sale en el documento."
          />
        </dl>

        <CargaPorHornada cargas={cotizacion.batch_loads} modo={cotizacion.firing_mode} />
        <ComparadorDeHornos cotizacion={cotizacion} />

        {guardar.isError ? (
          <p role="alert" className="mt-3 text-xs text-red-600">
            {describeError(guardar.error)}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
