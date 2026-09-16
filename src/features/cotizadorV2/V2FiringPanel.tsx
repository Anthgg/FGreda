import { SelectField } from "@/components/form";
import { DecimalField } from "@/components/DecimalField";
import { Spinner } from "@/components/Spinner";
import { Panel } from "@/features/masters/MasterTable";
import { describeError } from "@/features/settings/messages";
import {
  useSetV2Firing,
  useV2Firing,
} from "@/features/cotizadorV2/useQuoterV2Firing";
import { useEsperarGuardado } from "@/features/cotizadorV2/claves";
import {
  CUSTOMER_KIND_LABEL,
  FIRING_WARNING_LABEL,
  type V2Firing,
} from "@/types/quoterV2Firing";
import type { V2CustomerKind } from "@/types/quoterV2";
import { KilnOccupancySVG } from "@/components/KilnOccupancySVG";
import { formatMoney, formatNumber } from "@/utils/formatters";

const SIN_HORNO = "";

function Aviso({ codigo }: { codigo: string }) {
  return (
    <li className="text-xs text-amber-700 font-medium">
      {FIRING_WARNING_LABEL[codigo] ?? codigo}
    </li>
  );
}

function CargaPorHornada({ cargas }: { cargas: string[] }) {
  if (cargas.length === 0) return null;
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-zinc-900 mb-4">
        Ocupación por hornada
      </h3>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        {cargas.map((carga, indice) => (
          <div key={indice} className="bg-white rounded-xl border border-black/5 p-4 flex flex-col items-center justify-center shadow-xs">
            <KilnOccupancySVG occupancyPercent={Number(carga)} label={`HORNADA ${indice + 1}`} />
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-zinc-500 max-w-2xl">
        La última hornada puede ir a medias y cuesta exactamente lo mismo: el horno se
        enciende entero. No hay descuentos por volumen sobrante.
      </p>
    </div>
  );
}

function Reparto({ quema }: { quema: V2Firing }) {
  if (quema.lines.length === 0) return null;
  return (
    <div className="mt-8 rounded-2xl border border-black/10 bg-white overflow-hidden shadow-xs">
      <div className="p-5 border-b border-black/5">
        <h3 className="text-sm font-semibold text-zinc-900">Reparto interno</h3>
        <p className="mt-1 text-xs text-zinc-500">
          La quema es una sola para todo el pedido y se reparte entre los
          productos según el volumen que ocupa cada uno.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500 border-b border-black/5">
            <tr>
              <th className="px-5 py-3 font-medium">Producto</th>
              <th className="px-5 py-3 font-medium text-right">Volumen</th>
              <th className="px-5 py-3 font-medium text-right">% del horno</th>
              <th className="px-5 py-3 font-medium text-right">% del pedido</th>
              <th className="px-5 py-3 font-medium text-right">Tarifa asignada</th>
              <th className="px-5 py-3 font-medium text-right">Gas asignado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {quema.lines.map((linea) => (
              <tr key={linea.line_id} className="hover:bg-zinc-50/50">
                <td className="px-5 py-3 font-medium text-zinc-900">
                  {linea.product_name ?? `Línea ${linea.line_id}`}
                </td>
                <td className="px-5 py-3 text-zinc-600 text-right">
                  {formatNumber(linea.total_volume_cm3)} cm³
                </td>
                <td className="px-5 py-3 text-zinc-600 text-right">
                  {linea.occupancy_percent}%
                </td>
                <td className="px-5 py-3 text-zinc-600 text-right">
                  {linea.volume_share_percent}%
                </td>
                <td className="px-5 py-3 text-zinc-900 font-medium text-right">
                  {formatMoney(linea.commercial_cost)}
                </td>
                <td className="px-5 py-3 text-zinc-600 text-right">
                  {formatMoney(linea.gas_cost)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
  const esperarGuardado = useEsperarGuardado(quotationId);

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

  return (
    <Panel>
      <div data-testid="panel-quema" className="space-y-6">
        
        {/* HEADER & ALERTS */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
              HORNO / QUEMA
            </h2>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="block text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Costo Gas Real</span>
                <span className="text-sm font-semibold text-zinc-900">{formatMoney(quema.gas_total)}</span>
              </div>
              <div className="text-right">
                <span className="block text-[10px] uppercase font-bold text-emerald-600 tracking-wider">Tarifa a Cobrar</span>
                <span className="text-lg font-bold text-emerald-700">{formatMoney(quema.commercial_total)}</span>
              </div>
            </div>
          </div>
          
          {quema.warnings.length > 0 ? (
            <ul
              className="mt-4 space-y-2 rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm"
              data-testid="avisos-quema"
            >
              {quema.warnings.map((codigo) => (
                <Aviso key={codigo} codigo={codigo} />
              ))}
            </ul>
          ) : null}
        </div>

        {/* CONTROLES PRINCIPALES */}
        <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-xs">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <SelectField
              label="Horno a utilizar *"
              value={quema.kiln_id === null ? SIN_HORNO : String(quema.kiln_id)}
              options={[
                { value: SIN_HORNO, label: "Sin horno" },
                ...quema.kilns.map((horno) => ({
                  value: String(horno.kiln_id),
                  label: `${horno.name} · ${formatNumber(horno.capacity_cm3)} cm³`,
                })),
              ]}
              onChange={(valor) =>
                guardar.mutate({
                  kiln_id: valor === SIN_HORNO ? null : Number(valor),
                })
              }
              disabled={!canEdit}
              hint={recomendado ? `Recomendado: ${recomendado.name}` : ""}
            />
            <SelectField
              label="Tipo de cliente *"
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
              hint="Determina la tarifa comercial aplicada."
            />
            <SelectField
              label="Requiere Quema Baja"
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
              label="Requiere Quema Alta"
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
        </div>

        {/* RESUMEN DEL HORNO Y OCUPACIÓN */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* VOLUMEN Y OCUPACIÓN */}
          <div className="lg:col-span-1 rounded-2xl border border-black/10 bg-gradient-to-br from-zinc-50 to-white p-5 shadow-xs flex flex-col items-center justify-center relative overflow-hidden">
            <h3 className="text-sm font-semibold text-zinc-900 self-start w-full mb-4">Ocupación Total</h3>
            <div className="flex-1 w-full flex flex-col items-center justify-center">
               <KilnOccupancySVG 
                 occupancyPercent={Number(quema.occupancy_percent)} 
                 label={`VOLUMEN: ${formatNumber(quema.total_volume_cm3)} cm³`} 
               />
               <p className="mt-4 text-center text-sm font-semibold text-zinc-900">
                  {quema.firing_count} {quema.firing_count === 1 ? 'Ciclo Necesario' : 'Ciclos Necesarios'}
               </p>
               <div className="mt-2 text-[11px] text-zinc-500 font-medium flex gap-3">
                 <span>Baja: {quema.low_fire_count}</span>
                 <span>Alta: {quema.high_fire_count}</span>
               </div>
            </div>
          </div>

          {/* TARIFAS Y COSTOS */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* TARIFA COMERCIAL */}
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <svg className="w-16 h-16 text-emerald-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.64-2.25 1.64-1.74 0-2.1-.96-2.17-1.92H8c.07 1.77 1.25 3.01 2.9 3.39V20h2.34v-1.65c1.69-.32 2.89-1.42 2.89-3.03 0-2.3-1.89-3.1-4.04-3.66z"/></svg>
              </div>
              <h3 className="text-sm font-semibold text-emerald-900">
                Tarifa de quema (Precio a cobrar)
              </h3>
              <p className="mt-1 text-xs text-emerald-700/80 max-w-sm">
                Se multiplica por la cantidad de hornadas necesarias.
              </p>
              
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DecimalField
                  label="Tarifa ciclo Baja"
                  value={quema.commercial_rate_low ?? ""}
                  onCommit={(valor) =>
                    esperarGuardado(guardar, "quema", { commercial_rate_low_override: valor })
                  }
                  disabled={!canEdit}
                  {...(quema.commercial_low_is_override
                    ? { hint: "Valor sobrescrito." }
                    : {})}
                />
                <DecimalField
                  label="Tarifa ciclo Alta"
                  value={quema.commercial_rate_high ?? ""}
                  onCommit={(valor) =>
                    esperarGuardado(guardar, "quema", { commercial_rate_high_override: valor })
                  }
                  disabled={!canEdit}
                  {...(quema.commercial_high_is_override
                    ? { hint: "Valor sobrescrito." }
                    : {})}
                />
              </div>
              <div className="mt-4 pt-4 border-t border-emerald-900/10 flex justify-between items-center">
                <span className="text-sm font-medium text-emerald-900">Total Tarifa ({quema.firing_count} ciclos):</span>
                <span className="text-xl font-bold text-emerald-700">{formatMoney(quema.commercial_total)}</span>
              </div>
            </section>

            {/* COSTO GAS */}
            <section className="rounded-2xl border border-orange-200 bg-orange-50/30 p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <svg className="w-16 h-16 text-orange-600" fill="currentColor" viewBox="0 0 24 24"><path d="M19.48,13.03A4,4,0,0,1,16,19h-4a2,2,0,0,1-2-2V9.38A5.005,5.005,0,0,0,8,4.52V4h2v.52a3,3,0,0,1,1.52,2.6V17a4,4,0,0,0,4,4h4a2,2,0,0,0,2-2v-1.61Z"/><path d="M11.5,13.5a1.5,1.5,0,1,1-1.5-1.5A1.5,1.5,0,0,1,11.5,13.5Z"/></svg>
              </div>
              <h3 className="text-sm font-semibold text-orange-900">
                Costo Gas Real (Costo taller)
              </h3>
              <p className="mt-1 text-xs text-orange-700/80 max-w-sm">
                Gasto interno por ciclo de horno, sin importar cliente.
              </p>
              
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DecimalField
                  label="Gas ciclo Baja"
                  value={quema.gas_cost_low ?? ""}
                  onCommit={(valor) =>
                    esperarGuardado(guardar, "quema", { gas_cost_low_override: valor })
                  }
                  disabled={!canEdit}
                  {...(quema.gas_low_is_override
                    ? { hint: "Valor sobrescrito." }
                    : {})}
                />
                <DecimalField
                  label="Gas ciclo Alta"
                  value={quema.gas_cost_high ?? ""}
                  onCommit={(valor) =>
                    esperarGuardado(guardar, "quema", { gas_cost_high_override: valor })
                  }
                  disabled={!canEdit}
                  {...(quema.gas_high_is_override
                    ? { hint: "Valor sobrescrito." }
                    : {})}
                />
              </div>
              <div className="mt-4 pt-4 border-t border-orange-900/10 flex justify-between items-center">
                <span className="text-sm font-medium text-orange-900">Total Gas ({quema.firing_count} ciclos):</span>
                <span className="text-xl font-bold text-orange-700">{formatMoney(quema.gas_total)}</span>
              </div>
            </section>
            
          </div>
        </div>

        {/* DETALLE HORNADAS & REPARTO */}
        <CargaPorHornada cargas={quema.batch_loads} />
        
        <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-5 mt-6 flex items-center justify-between">
           <div>
              <h4 className="text-sm font-semibold text-sky-900">Diferencia de la quema</h4>
              <p className="text-xs text-sky-800/80 mt-1">Lo que deja la quema por sí sola (Tarifa - Gas). No incluye mano de obra ni materiales.</p>
           </div>
           <div className="text-2xl font-bold text-sky-700">{formatMoney(quema.difference)}</div>
        </div>

        <Reparto quema={quema} />
        
        {guardar.isError ? (
          <p role="alert" className="mt-3 text-xs text-red-600">
            {describeError(guardar.error)}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

