import { useState } from "react";
import { Link } from "react-router-dom";

import { PrimaryButton, SecondaryButton } from "@/components/form";
import { capabilitiesFor } from "@/features/auth/capabilities";
import { useSession } from "@/features/auth/useSession";
import { Badge } from "@/features/masters/MasterTable";
import { DialogoConsumo } from "@/features/production/DialogoConsumo";
import { DialogoComunicacion, DialogoNota } from "@/features/production/DialogosSeguimiento";
import { normalizar, sumar } from "@/features/production/decimales";
import { fechaHoraLima } from "@/features/production/instanteLima";
import {
  describeConsumptionKind,
  describeProductionError,
  listaDeClases,
} from "@/features/production/mensajesProduccion";
import {
  canCancel,
  canComplete,
  canStart,
  describeStatus,
  statusTone,
} from "@/features/production/readiness";
import { SeguimientoOrden } from "@/features/production/SeguimientoOrden";
import {
  useCancelProductionOrder,
  useCompleteProductionOrder,
  useProductionConsumptions,
  useProductionTimeline,
  useStartProductionOrder,
} from "@/features/production/useProductionOrders";
import type {
  ProductionConsumption,
  ProductionConsumptionKind,
  ProductionOrder,
  V2ProductionPiece,
} from "@/types/production";

type Dialogo = "consumo" | "nota" | "quema" | "comunicacion" | null;

function medidasV2(pieza: V2ProductionPiece): string {
  const partes = [pieza.length_cm, pieza.width_cm, pieza.height_cm];
  if (partes.every((parte) => parte === null)) return "—";
  return `${partes.map((parte) => normalizar(parte)).join(" × ")} cm`;
}

/** Cantidades agrupadas por unidad: «9000 g», o «9000 g + 2 kg» si difieren. */
function totalPorUnidad(filas: readonly { cantidad: string; unidad: string | null }[]): string {
  if (filas.length === 0) return "—";
  const porUnidad = new Map<string, string[]>();
  for (const fila of filas) {
    const unidad = fila.unidad ?? "";
    porUnidad.set(unidad, [...(porUnidad.get(unidad) ?? []), fila.cantidad]);
  }
  return [...porUnidad]
    .map(([unidad, valores]) => `${normalizar(sumar(valores))} ${unidad}`.trim())
    .join(" + ");
}

function Seccion({
  titulo,
  accion,
  children,
}: {
  titulo: string;
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white/90 p-4 shadow-xs sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900">{titulo}</h2>
        {accion}
      </div>
      {children}
    </section>
  );
}

/**
 * Ficha de una orden nacida de una cotización V2. Fase 010I.
 *
 * Es de EJECUCIÓN: qué fabricar, para quién, en qué estado va y qué se ha
 * gastado. Ni un importe. Todo lo que decide —si puede iniciar, si falta
 * material para finalizar, si se puede anular— lo dice el backend; aquí se
 * muestra y se ofrece la acción que corresponde.
 *
 * Vive aparte de la ficha Legacy a propósito: una orden V2 no pasa por el
 * cobro, no descuenta al iniciar y no tiene líneas propias, y mezclar las dos
 * en los mismos bloques obligaría a cada uno a preguntar de dónde viene la
 * orden.
 */
export function OrdenV2({ order }: { order: ProductionOrder }) {
  const { data: user } = useSession();
  const puede = capabilitiesFor(user?.role);
  const timeline = useProductionTimeline(order.id);
  const consumos = useProductionConsumptions(order.id);
  const start = useStartProductionOrder();
  const complete = useCompleteProductionOrder();
  const cancel = useCancelProductionOrder();
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmandoAnulacion, setConfirmandoAnulacion] = useState(false);

  const piezas = order.v2_pieces ?? [];
  const pendientes = order.pending_consumption_kinds ?? [];
  const listaConsumos: readonly ProductionConsumption[] = consumos.data?.items ?? [];
  const eventos = timeline.data?.items ?? [];
  const creadaPor = eventos.find((e) => e.type === "STATUS" && e.status === "CREATED")?.actor_name;
  const comunicaciones = eventos.filter((e) => e.type === "COMMUNICATION");
  const activa = order.status === "CREATED" || order.status === "STARTED";
  const enCurso = start.isPending || complete.isPending || cancel.isPending;
  const errorTransicion = start.error ?? complete.error ?? cancel.error;
  const conConsumos = listaConsumos.length > 0;
  const clasesPlan: ProductionConsumptionKind[] = [
    "BODY",
    ...(piezas.some((pieza) => pieza.requires_glaze) ? (["GLAZE"] as const) : []),
  ];

  const cerrar = () => setDialogo(null);
  // Un aviso de éxito vale para la acción que lo produjo: la siguiente lo borra,
  // o «Consumo registrado» seguiría ahí después de finalizar la orden.
  const abrir = (cual: Exclude<Dialogo, null>) => {
    setAviso(null);
    setDialogo(cual);
  };
  const transicion = (accion: (id: number) => void) => {
    setAviso(null);
    accion(order.id);
  };
  const alRegistrar = (texto: string) => {
    setDialogo(null);
    setAviso(texto);
  };

  return (
    <div className="w-full space-y-4">
      {/* -- Cabecera: lo crítico arriba --------------------------------- */}
      <header className="rounded-2xl border border-zinc-200 bg-white/90 p-4 shadow-xs sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
                {order.code}
              </h1>
              <Badge tone={statusTone(order.status)}>{describeStatus(order.status).toUpperCase()}</Badge>
              <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                Cotización V2
              </span>
            </div>
            <p className="mt-1 text-sm font-medium text-zinc-900" data-testid="orden-cliente">
              {order.customer_name ?? "Cliente sin nombre"}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {puede.verCotizacionV2 && order.v2_quotation_id ? (
                <Link
                  to={`/cotizador-v2/${order.v2_quotation_id}`}
                  className="font-mono text-zinc-700 hover:text-black hover:underline"
                >
                  {order.v2_quotation_code}
                </Link>
              ) : (
                <span className="font-mono">{order.v2_quotation_code}</span>
              )}
              {" · "}Creada el {fechaHoraLima(order.created_at)}
              {creadaPor ? ` por ${creadaPor}` : ""}
              {" · "}Almacén: {order.stock_location_name}
            </p>
          </div>

          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {puede.arrancarProduccion &&
            canStart(order.status, order.readiness.ready, null, order.origin_type) ? (
              <PrimaryButton
                type="button"
                className="w-full sm:w-auto"
                disabled={enCurso}
                onClick={() => transicion(start.mutate)}
              >
                {start.isPending ? "Procesando…" : "Iniciar producción"}
              </PrimaryButton>
            ) : null}
            {puede.completarProduccion && canComplete(order.status) ? (
              <PrimaryButton
                type="button"
                className="w-full sm:w-auto"
                disabled={enCurso || pendientes.length > 0}
                onClick={() => transicion(complete.mutate)}
              >
                {complete.isPending ? "Procesando…" : "Finalizar producción"}
              </PrimaryButton>
            ) : null}
          </div>
        </div>

        {order.status === "CREATED" ? (
          <p className="mt-3 text-xs text-zinc-600">
            Iniciar la producción no descuenta material: el consumo real se registra aparte,
            cuando sale del almacén.
          </p>
        ) : null}

        {/* D3. Lo que falta para finalizar lo dice el backend. */}
        {activa && pendientes.length > 0 ? (
          <p
            role="status"
            data-testid="orden-faltantes"
            className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
          >
            Falta registrar consumo real de: <strong>{listaDeClases(pendientes)}</strong>. Hasta
            entonces la orden no puede finalizarse.
          </p>
        ) : null}
        {order.status === "STARTED" && pendientes.length === 0 ? (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            Nada pendiente de material: la orden puede finalizarse.
          </p>
        ) : null}

        {errorTransicion ? (
          <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {describeProductionError(errorTransicion)}
          </p>
        ) : null}
        {aviso ? (
          <p role="status" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
            {aviso}
          </p>
        ) : null}
      </header>

      {/* -- Piezas y plan ------------------------------------------------ */}
      <Seccion titulo="Piezas a fabricar">
        {piezas.length === 0 ? (
          <p className="text-xs text-zinc-500">La cotización no trae piezas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs" data-testid="orden-piezas">
              <thead className="text-[10px] uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Pieza</th>
                  <th className="py-2 pr-4 text-right font-semibold">Cantidad</th>
                  <th className="py-2 pr-4 font-semibold">Medidas (L × A × H)</th>
                  <th className="py-2 pr-4 font-semibold">Pasta planificada</th>
                  <th className="py-2 pr-4 font-semibold">Esmalte planificado</th>
                  <th className="py-2 font-semibold">Registrado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {piezas.map((pieza) => {
                  const suyos = listaConsumos.filter(
                    (c) => c.v2_quotation_product_id === pieza.id,
                  );
                  return (
                    <tr key={pieza.id} className="align-top">
                      <td className="py-2 pr-4 font-medium text-zinc-900">{pieza.product_name}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{pieza.quantity}</td>
                      <td className="py-2 pr-4 text-zinc-600">{medidasV2(pieza)}</td>
                      <td className="py-2 pr-4 text-zinc-800">
                        {pieza.body_material_name ?? "—"}
                        {pieza.body_unit_weight ? (
                          <span className="block text-[11px] tabular-nums text-zinc-500">
                            {normalizar(pieza.body_unit_weight)} {pieza.body_uom ?? ""} por pieza ·{" "}
                            {normalizar(pieza.body_total_weight)} {pieza.body_uom ?? ""} en total
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4 text-zinc-800">
                        {pieza.requires_glaze ? (
                          <>
                            {pieza.glaze_material_name ?? "Esmalte"}
                            {pieza.glaze_is_reference ? (
                              <span className="block text-[11px] text-zinc-500">
                                Referencia de costeo: puede usarse otro.
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-zinc-400">Sin esmalte</span>
                        )}
                      </td>
                      <td className="py-2 tabular-nums text-zinc-800">
                        {totalPorUnidad(suyos.map((c) => ({ cantidad: c.quantity, unidad: c.uom_code })))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Planificado contra registrado, por clase. Sin análisis: sólo las dos cifras. */}
        <dl className="mt-4 grid gap-2 sm:grid-cols-2" data-testid="plan-vs-real">
          {clasesPlan.map((kind) => {
            const plan =
              kind === "BODY"
                ? piezas.map((p) => ({ cantidad: p.body_total_weight, unidad: p.body_uom }))
                : piezas
                    .filter((p) => p.requires_glaze)
                    .map((p) => ({ cantidad: p.glaze_total_weight, unidad: "g" }));
            const real = listaConsumos
              .filter((c) => c.kind === kind)
              .map((c) => ({ cantidad: c.quantity, unidad: c.uom_code }));
            return (
              <div key={kind} className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  {describeConsumptionKind(kind)}
                </dt>
                <dd className="mt-1 text-xs text-zinc-800">
                  Planificado: <span className="tabular-nums">{totalPorUnidad(plan)}</span>
                  <br />
                  Registrado: <span className="tabular-nums">{totalPorUnidad(real)}</span>
                </dd>
              </div>
            );
          })}
        </dl>
      </Seccion>

      {/* -- Consumos reales --------------------------------------------- */}
      <Seccion
        titulo="Consumos reales"
        accion={
          puede.registrarConsumo && activa ? (
            <PrimaryButton type="button" onClick={() => abrir("consumo")}>
              Registrar consumo
            </PrimaryButton>
          ) : null
        }
      >
        {consumos.isPending ? (
          <p className="text-xs text-zinc-500">Cargando consumos…</p>
        ) : listaConsumos.length === 0 ? (
          <p className="text-xs text-zinc-500">Todavía no se registró material gastado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs" data-testid="orden-consumos">
              <thead className="text-[10px] uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Material</th>
                  <th className="py-2 pr-4 font-semibold">Clase</th>
                  <th className="py-2 pr-4 font-semibold">Almacén</th>
                  <th className="py-2 pr-4 text-right font-semibold">Cantidad</th>
                  <th className="py-2 pr-4 font-semibold">Fecha</th>
                  <th className="py-2 font-semibold">Registrado por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {listaConsumos.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 pr-4 text-zinc-900">{c.product_name}</td>
                    <td className="py-2 pr-4 text-zinc-700">{describeConsumptionKind(c.kind)}</td>
                    <td className="py-2 pr-4 text-zinc-700">{c.stock_location_name}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-zinc-900">
                      {normalizar(c.quantity)} {c.uom_code}
                    </td>
                    <td className="py-2 pr-4 text-zinc-600">{fechaHoraLima(c.created_at)}</td>
                    <td className="py-2 text-zinc-600">{c.created_by_name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] text-zinc-500">
          Los consumos son definitivos: no se editan ni se borran. Un error se corrige con un
          ajuste de inventario.
        </p>
      </Seccion>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* -- Seguimiento ----------------------------------------------- */}
        <Seccion
          titulo="Seguimiento"
          accion={
            puede.registrarNotaProduccion && order.status !== "CANCELLED" ? (
              <div className="flex flex-wrap gap-2">
                <SecondaryButton onClick={() => abrir("nota")}>Añadir nota</SecondaryButton>
                {order.status === "STARTED" || order.status === "COMPLETED" ? (
                  <SecondaryButton onClick={() => abrir("quema")}>
                    Registrar quema
                  </SecondaryButton>
                ) : null}
              </div>
            ) : null
          }
        >
          {timeline.isError ? (
            <p role="alert" className="text-xs text-red-700">
              {describeProductionError(timeline.error)}
            </p>
          ) : (
            <SeguimientoOrden eventos={eventos} cargando={timeline.isPending} />
          )}
        </Seccion>

        {/* -- Comunicaciones ------------------------------------------- */}
        <Seccion
          titulo="Comunicaciones con el cliente"
          accion={
            puede.registrarComunicacion ? (
              <SecondaryButton onClick={() => abrir("comunicacion")}>
                Registrar comunicación
              </SecondaryButton>
            ) : null
          }
        >
          <p className="mb-3 text-[11px] text-zinc-500">
            Registro de avisos hechos por fuera del sistema. Aquí no se envía nada.
          </p>
          {comunicaciones.length === 0 ? (
            <p className="text-xs text-zinc-500">Todavía no se registró ningún aviso.</p>
          ) : (
            <ul className="space-y-3" data-testid="orden-comunicaciones">
              {comunicaciones.map((evento) =>
                evento.communication ? (
                  <li key={evento.communication.id} className="rounded-xl border border-zinc-200 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                      WhatsApp · {fechaHoraLima(evento.communication.sent_at)} · registrado por{" "}
                      {evento.communication.sent_by_name ?? "—"}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-900">
                      {evento.communication.message}
                    </p>
                  </li>
                ) : null,
              )}
            </ul>
          )}
        </Seccion>
      </div>

      {/* -- Anular (ADMIN, sólo en INICIO) ------------------------------ */}
      {puede.anularProduccion && canCancel(order.status) ? (
        <Seccion titulo="Anular la orden">
          {conConsumos ? (
            <p className="text-xs text-zinc-600" data-testid="orden-no-anulable">
              Esta orden ya tiene material consumido y no puede anularse: anular no devuelve el
              material al almacén. Si hubo un error, corríjalo con un ajuste de inventario.
            </p>
          ) : confirmandoAnulacion ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-zinc-700">¿Anular {order.code}? No se puede deshacer.</p>
              <SecondaryButton disabled={enCurso} onClick={() => setConfirmandoAnulacion(false)}>
                No
              </SecondaryButton>
              <PrimaryButton
                type="button"
                disabled={enCurso}
                onClick={() => transicion(cancel.mutate)}
              >
                {cancel.isPending ? "Procesando…" : "Sí, anular"}
              </PrimaryButton>
            </div>
          ) : (
            <SecondaryButton onClick={() => setConfirmandoAnulacion(true)}>Anular orden</SecondaryButton>
          )}
        </Seccion>
      ) : null}

      {dialogo === "consumo" ? (
        <DialogoConsumo
          order={order}
          onClose={cerrar}
          onRegistered={(c) =>
            alRegistrar(
              `Consumo registrado: ${normalizar(c.quantity)} ${c.uom_code} de ${c.product_name}. ` +
                `Saldo en ${c.stock_location_name}: ${normalizar(c.balance_after)} ${c.uom_code}.`,
            )
          }
        />
      ) : null}
      {dialogo === "nota" || dialogo === "quema" ? (
        <DialogoNota
          order={order}
          quema={dialogo === "quema"}
          onClose={cerrar}
          onRegistered={() =>
            alRegistrar(dialogo === "quema" ? "Quema registrada." : "Nota añadida al seguimiento.")
          }
        />
      ) : null}
      {dialogo === "comunicacion" ? (
        <DialogoComunicacion
          order={order}
          onClose={cerrar}
          onRegistered={() => alRegistrar("Comunicación registrada en el seguimiento.")}
        />
      ) : null}
    </div>
  );
}
