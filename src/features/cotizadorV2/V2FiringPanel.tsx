import { useEffect, useState } from "react";

import { SelectField, TextField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { Panel } from "@/features/masters/MasterTable";
import { describeError } from "@/features/settings/messages";
import {
  useSetV2Firing,
  useV2Firing,
} from "@/features/cotizadorV2/useQuoterV2Firing";
import {
  CUSTOMER_KIND_LABEL,
  FIRING_WARNING_LABEL,
  type V2Firing,
} from "@/types/quoterV2Firing";
import type { V2CustomerKind } from "@/types/quoterV2";

/**
 * Quema de una cotización V2: horno, hornadas, gas real y tarifa.
 *
 * Lo que esta pantalla enseña, y por qué así:
 *
 * - **el gas real y la tarifa van separados**, en dos bloques distintos y con
 *   dos colores distintos. Son COSTO y PRECIO. Juntarlos en una columna —o
 *   sumarlos en un total— haría desaparecer la diferencia, que es justo lo que
 *   el taller quiere mirar;
 * - **una hornada al 60 % cuesta lo mismo que una llena.** La barra de carga
 *   está para verlo, no para calcular con ella: el horno se enciende entero;
 * - **las recomendaciones no actúan.** «Esto cabe en un horno más chico» es una
 *   frase, no un cambio de horno. Quien cotiza decide.
 *
 * No hay ningún multiplicador por ocupación. En el motor histórico una pieza
 * que ocupaba poco horno pagaba hasta ×3; en V2 eso no existe y no vuelve bajo
 * otro nombre.
 *
 * Los campos de tarifa guardan al SALIR del campo. Borrar «35» para escribir
 * «40» pasa por la cadena vacía, y `Number("")` es 0: guardando al vuelo, un
 * importe se pondría en cero a mitad de una pulsación.
 */

const SIN_HORNO = "";

/** Los cuatro importes que se pueden pactar dentro de una cotización. */
type CampoDeTarifa =
  | "gas_cost_low_override"
  | "gas_cost_high_override"
  | "commercial_rate_low_override"
  | "commercial_rate_high_override";

function Aviso({ codigo }: { codigo: string }) {
  return (
    <li className="text-xs text-amber-700">
      {FIRING_WARNING_LABEL[codigo] ?? codigo}
    </li>
  );
}

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

/** Campo que solo avisa cuando el usuario termina de escribir. */
function CampoDiferido({
  label,
  value,
  onCommit,
  disabled,
  hint,
  error,
}: {
  label: string;
  value: string;
  onCommit: (valor: string) => void;
  disabled: boolean;
  hint?: string | undefined;
  error?: string | undefined;
}) {
  const [borrador, setBorrador] = useState(value);
  useEffect(() => setBorrador(value), [value]);

  return (
    <TextField
      label={label}
      requirement="optional"
      value={borrador}
      onChange={setBorrador}
      onBlur={() => {
        if (borrador !== value) onCommit(borrador);
      }}
      disabled={disabled}
      inputMode="decimal"
      {...(hint ? { hint } : {})}
      {...(error ? { error } : {})}
    />
  );
}

/** Cuánta carga lleva cada hornada. Información, no reparto de costo. */
function CargaPorHornada({ cargas }: { cargas: string[] }) {
  if (cargas.length === 0) return null;
  return (
    <div className="mt-4 rounded-2xl border border-black/[0.06] p-4">
      <h3 className="text-xs font-semibold text-zinc-700">
        Carga de cada hornada
      </h3>
      <p className="mt-1 text-[11px] text-zinc-500">
        La última puede ir a medias y cuesta exactamente lo mismo: el horno se
        enciende entero.
      </p>
      <ul className="mt-3 space-y-2">
        {cargas.map((carga, indice) => (
          <li key={indice} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-xs text-zinc-600">
              Hornada {indice + 1}
            </span>
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

function Reparto({ quema }: { quema: V2Firing }) {
  if (quema.lines.length === 0) return null;
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-black/[0.06]">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <caption className="px-4 pt-3 text-left text-xs text-zinc-500">
          La quema es una sola para todo el pedido y se reparte entre los
          productos según el volumen que ocupa cada uno.
        </caption>
        <thead>
          <tr className="text-xs text-zinc-500">
            <th className="px-4 py-2 font-medium">Producto</th>
            <th className="px-4 py-2 font-medium">Volumen cm³</th>
            <th className="px-4 py-2 font-medium">% del horno</th>
            <th className="px-4 py-2 font-medium">% del total</th>
            <th className="px-4 py-2 font-medium">Tarifa asignada</th>
            <th className="px-4 py-2 font-medium">Gas asignado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {quema.lines.map((linea) => (
            <tr key={linea.line_id}>
              <td className="px-4 py-2 text-zinc-800">
                {linea.product_name ?? `Línea ${linea.line_id}`}
              </td>
              <td className="px-4 py-2 text-zinc-600">
                {linea.total_volume_cm3}
              </td>
              <td className="px-4 py-2 text-zinc-600">
                {linea.occupancy_percent}
              </td>
              <td className="px-4 py-2 text-zinc-600">
                {linea.volume_share_percent}
              </td>
              <td className="px-4 py-2 text-zinc-800">
                {linea.commercial_cost}
              </td>
              <td className="px-4 py-2 text-zinc-600">{linea.gas_cost}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function V2FiringPanel({
  quotationId,
  canEdit,
}: {
  quotationId: number;
  canEdit: boolean;
}) {
  const query = useV2Firing(quotationId);
  const guardar = useSetV2Firing(quotationId);
  const [invalido, setInvalido] = useState<string | null>(null);

  if (query.isPending)
    return <Spinner className="size-5" label="Cargando quema..." />;
  if (query.isError) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"
      >
        {describeError(query.error)}
      </div>
    );
  }

  const quema = query.data;
  const recomendado = quema.kilns.find(
    (horno) => horno.kiln_id === quema.recommended_kiln_id,
  );

  /**
   * Un campo vacío RETIRA el acuerdo; un texto que no es número no se manda.
   *
   * Vaciar y mandar `null` no es lo mismo que no mandar nada: el nulo explícito
   * devuelve la tarifa al maestro y la ausencia la conserva. Confundirlos es el
   * error que 010C pagó caro.
   */
  const tarifa = (valor: string, campo: CampoDeTarifa) => {
    const limpio = valor.trim();
    if (limpio === "") {
      setInvalido(null);
      guardar.mutate({ [campo]: null });
      return;
    }
    if (!Number.isFinite(Number(limpio)) || Number(limpio) < 0) {
      setInvalido(
        "Escriba un importe válido, o deje el campo vacío para volver al maestro.",
      );
      return;
    }
    setInvalido(null);
    guardar.mutate({ [campo]: limpio });
  };

  return (
    <Panel>
      {/* El identificador acota las consultas de las pruebas a ESTE bloque: la
          ficha de una cotizacion monta varios paneles y varios de ellos tienen
          un campo llamado «Cantidad» o un importe con la misma pinta. */}
      <div data-testid="panel-quema">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">Quema</h2>
          <span className="text-xs text-zinc-500">
            Tarifa de quema: <strong>{quema.commercial_total}</strong> · Gas
            real: <strong>{quema.gas_total}</strong>
          </span>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Cada hornada necesaria se cobra entera. No hay multiplicador por
          ocupación: ocupar poco horno no encarece la pieza.
        </p>

        {quema.warnings.length > 0 ? (
          <ul
            className="mt-3 space-y-1 rounded-2xl bg-amber-50 p-3"
            data-testid="avisos-quema"
          >
            {quema.warnings.map((codigo) => (
              <Aviso key={codigo} codigo={codigo} />
            ))}
          </ul>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Horno de esta cotización"
            requirement="optional"
            value={quema.kiln_id === null ? SIN_HORNO : String(quema.kiln_id)}
            options={[
              { value: SIN_HORNO, label: "Sin horno" },
              ...quema.kilns.map((horno) => ({
                value: String(horno.kiln_id),
                label: `${horno.name} · ${horno.capacity_cm3} cm³${horno.has_rates ? "" : " (sin tarifas)"}`,
              })),
            ]}
            onChange={(valor) =>
              guardar.mutate({
                kiln_id: valor === SIN_HORNO ? null : Number(valor),
              })
            }
            disabled={!canEdit}
            hint="Cambiarlo afecta solo a esta cotización, nunca a la configuración."
          />
          <SelectField
            label="Tipo de cliente"
            requirement="optional"
            value={quema.customer_kind ?? "EXTERNAL"}
            options={(["EXTERNAL", "STUDENT"] as V2CustomerKind[]).map(
              (valor) => ({
                value: valor,
                label: CUSTOMER_KIND_LABEL[valor],
              }),
            )}
            onChange={(valor) =>
              guardar.mutate({ customer_kind: valor as V2CustomerKind })
            }
            disabled={!canEdit}
            hint="Cambia lo que se cobra. El gas que se consume es el mismo."
          />
          <SelectField
            label="Quema baja"
            requirement="optional"
            value={quema.low_fire_enabled ? "SI" : "NO"}
            options={[
              { value: "SI", label: "Sí" },
              { value: "NO", label: "No" },
            ]}
            onChange={(valor) =>
              guardar.mutate({ low_fire_enabled: valor === "SI" })
            }
            disabled={!canEdit}
          />
          <SelectField
            label="Quema alta"
            requirement="optional"
            value={quema.high_fire_enabled ? "SI" : "NO"}
            options={[
              { value: "SI", label: "Sí" },
              { value: "NO", label: "No" },
            ]}
            onChange={(valor) =>
              guardar.mutate({ high_fire_enabled: valor === "SI" })
            }
            disabled={!canEdit}
          />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-4 rounded-2xl border border-black/[0.06] p-4 sm:grid-cols-4">
          <Dato
            label="Tipo de producción"
            value={
              quema.production_type === "RETAIL" ? "Por menor" : "Por mayor"
            }
            hint="El sistema nunca lo cambia solo."
          />
          <Dato
            label="Capacidad del horno"
            value={quema.kiln_capacity_cm3 ?? "—"}
            hint="Congelada al elegirlo."
          />
          <Dato label="Volumen total" value={`${quema.total_volume_cm3} cm³`} />
          <Dato label="Ocupación" value={`${quema.occupancy_percent} %`} />
          <Dato label="Hornadas" value={String(quema.firing_count)} />
          <Dato label="Hornadas en baja" value={String(quema.low_fire_count)} />
          <Dato
            label="Hornadas en alta"
            value={String(quema.high_fire_count)}
          />
          <Dato
            label="Horno recomendado"
            value={recomendado ? recomendado.name : "—"}
            hint="Es una recomendación. No se aplica sola."
          />
        </dl>

        <CargaPorHornada cargas={quema.batch_loads} />

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
            <h3 className="text-xs font-semibold text-emerald-900">
              Tarifa de quema (lo que se cobra)
            </h3>
            <p className="mt-1 text-[11px] text-emerald-800">
              Por hornada completa, según el tipo de cliente.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CampoDiferido
                label="Tarifa baja"
                value={quema.commercial_rate_low ?? ""}
                onCommit={(valor) =>
                  tarifa(valor, "commercial_rate_low_override")
                }
                disabled={!canEdit}
                {...(quema.commercial_low_is_override
                  ? {
                      hint: "Acordada en esta cotización. Vacíelo para volver al maestro.",
                    }
                  : {})}
              />
              <CampoDiferido
                label="Tarifa alta"
                value={quema.commercial_rate_high ?? ""}
                onCommit={(valor) =>
                  tarifa(valor, "commercial_rate_high_override")
                }
                disabled={!canEdit}
                {...(quema.commercial_high_is_override
                  ? {
                      hint: "Acordada en esta cotización. Vacíelo para volver al maestro.",
                    }
                  : {})}
              />
            </div>
            <p className="mt-3 text-sm text-emerald-900">
              Total tarifa de quema: <strong>{quema.commercial_total}</strong>
            </p>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <h3 className="text-xs font-semibold text-zinc-800">
              Costo real del gas (lo que cuesta)
            </h3>
            <p className="mt-1 text-[11px] text-zinc-600">
              No depende del cliente: un alumno y un externo queman el mismo
              gas.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CampoDiferido
                label="Gas baja"
                value={quema.gas_cost_low ?? ""}
                onCommit={(valor) => tarifa(valor, "gas_cost_low_override")}
                disabled={!canEdit}
                {...(quema.gas_low_is_override
                  ? {
                      hint: "Acordado en esta cotización. Vacíelo para volver al maestro.",
                    }
                  : {})}
              />
              <CampoDiferido
                label="Gas alta"
                value={quema.gas_cost_high ?? ""}
                onCommit={(valor) => tarifa(valor, "gas_cost_high_override")}
                disabled={!canEdit}
                {...(quema.gas_high_is_override
                  ? {
                      hint: "Acordado en esta cotización. Vacíelo para volver al maestro.",
                    }
                  : {})}
              />
            </div>
            <p className="mt-3 text-sm text-zinc-800">
              Total gas real: <strong>{quema.gas_total}</strong>
            </p>
          </section>
        </div>

        <p className="mt-4 rounded-2xl bg-black/[0.03] px-4 py-3 text-sm text-zinc-800">
          Diferencia de la quema: <strong>{quema.difference}</strong>
          <span className="ml-2 text-xs text-zinc-500">
            Lo que deja la quema por sí sola. No es el margen de la cotización:
            aquí no están descontados los materiales ni la mano de obra.
          </span>
        </p>

        <Reparto quema={quema} />

        {invalido ? (
          <p role="alert" className="mt-3 text-xs text-red-600">
            {invalido}
          </p>
        ) : null}
        {guardar.isError ? (
          <p role="alert" className="mt-3 text-xs text-red-600">
            {describeError(guardar.error)}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
