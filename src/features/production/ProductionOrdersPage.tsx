import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { SelectField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { TypewriterTitle } from "@/components/TypewriterTitle";
import { Badge, EmptyState, Pagination } from "@/features/masters/MasterTable";
import { describeStatus, statusTone } from "@/features/production/readiness";
import { useProductionOrders } from "@/features/production/useProductionOrders";
import { describeError } from "@/features/settings/messages";
import type {
  ProductionOrderFilters,
  ProductionOrderStatus,
  ProductionOrderSummary,
} from "@/types/production";

const ALL = "ALL";
const PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  { value: ALL, label: "Todos los estados" },
  { value: "CREATED", label: "Creada" },
  { value: "STARTED", label: "En proceso" },
  { value: "COMPLETED", label: "Completada" },
  { value: "CANCELLED", label: "Anulada" },
] as const;

const ORIGIN_OPTIONS = [
  { value: ALL, label: "Todos los orígenes" },
  { value: "QUOTATION", label: "Cotización" },
  { value: "PROTOTYPE", label: "Prototipo" },
] as const;

function fecha(valor: string | null): string {
  return valor ? valor.slice(0, 10) : "—";
}

/**
 * De dónde viene una orden, escrito con códigos y no con identificadores.
 *
 * Un número de fila no le dice nada a quien está en el taller. Los códigos sí:
 * CTZ-…, CPR-… y PRT-… son lo que aparece impreso en los papeles que tiene
 * delante.
 */
function Origen({ order }: { order: ProductionOrderSummary }) {
  if (order.origin_type === "PROTOTYPE") {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-zinc-700">
          {order.prototype_quotation_code ?? "Sin cotización de prototipo"}
        </span>
        <span className="font-mono text-[10px] text-zinc-500">
          {order.prototype_code ?? "Muestra"}
        </span>
      </div>
    );
  }
  if (order.quotation_id === null) return <span className="text-zinc-400">—</span>;
  return (
    <Link
      to={`/cotizador/${order.quotation_id}`}
      className="font-mono text-zinc-700 hover:text-black hover:underline"
    >
      {order.quotation_code ?? "Cotización"}
    </Link>
  );
}

/**
 * Producción. **Una sola lista.**
 *
 * Hasta 009K.4 esta pantalla tenía dos pestañas —órdenes y prototipos— porque
 * había dos sistemas para el mismo hecho físico. Ya no: toda la ejecución vive
 * en una orden de producción, venga de una cotización o de una muestra, y
 * mantener dos tablas obligaría a mirar en dos sitios para saber qué se está
 * fabricando hoy.
 *
 * Lo que esta lista NO hace es enseñar las muestras históricas como si fueran
 * órdenes. Aquellas se fabricaron sin orden y no se les inventa una: se llegan
 * a ver por su propia ruta, en sólo lectura.
 */
export function ProductionOrdersPage() {
  const [status, setStatus] = useState<string>(ALL);
  const [origin, setOrigin] = useState<string>(ALL);
  const [offset, setOffset] = useState(0);

  useEffect(() => setOffset(0), [status, origin]);

  const filters: ProductionOrderFilters = {
    ...(status !== ALL ? { status: status as ProductionOrderStatus } : {}),
    limit: PAGE_SIZE,
    offset,
  };
  const orders = useProductionOrders(filters);

  // El filtro de origen se aplica en la pantalla y no en la consulta: el
  // backend todavía no lo acepta como parámetro, y añadirlo sólo para esto
  // habría cambiado un contrato por una comodidad visual. Con 25 filas por
  // página el filtrado local no se nota; el día que estorbe, se pide arriba.
  const filas = (orders.data?.items ?? []).filter(
    (order) => origin === ALL || order.origin_type === origin,
  );

  return (
    <div className="w-full space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <TypewriterTitle
            text="Producción."
            className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl"
          />
          <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
            Órdenes de fabricación y consumo físico de material preparado.
          </p>
        </div>
      </header>

      <div className="glass-panel rounded-2xl border border-white/60 p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SelectField label="Estado" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
          <SelectField
            label="Origen"
            value={origin}
            options={ORIGIN_OPTIONS}
            onChange={setOrigin}
          />
        </div>

        <div className="mt-4">
          {orders.isPending ? (
            <div className="flex justify-center py-16">
              <Spinner className="size-5" label="Cargando órdenes…" />
            </div>
          ) : orders.isError ? (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700"
            >
              {describeError(orders.error)}
            </p>
          ) : filas.length === 0 ? (
            <EmptyState
              message={
                status === ALL && origin === ALL
                  ? "Todavía no hay órdenes de producción. Nacen de una cotización confirmada o del cobro de una cotización de prototipo."
                  : "No hay órdenes con esos filtros."
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white/80">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Orden</th>
                      <th className="px-4 py-3 font-semibold">Origen</th>
                      <th className="px-4 py-3 font-semibold">Estado</th>
                      <th className="px-4 py-3 font-semibold">Almacén</th>
                      <th className="px-4 py-3 text-right font-semibold">Líneas</th>
                      <th className="px-4 py-3 font-semibold">Creada</th>
                      <th className="px-4 py-3 font-semibold">Arrancada</th>
                      <th className="px-4 py-3 font-semibold">Completada</th>
                      <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filas.map((order) => (
                      <tr key={order.id} className="hover:bg-zinc-50/70">
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-zinc-900">{order.code}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Origen order={order} />
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={statusTone(order.status)}>
                            {describeStatus(order.status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-zinc-600">{order.stock_location_name}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{order.line_count}</td>
                        <td className="px-4 py-3 text-zinc-500">{fecha(order.created_at)}</td>
                        <td className="px-4 py-3 text-zinc-500">{fecha(order.started_at)}</td>
                        <td className="px-4 py-3 text-zinc-500">{fecha(order.completed_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/produccion/${order.id}`}
                            className="font-medium text-zinc-700 hover:text-black hover:underline"
                          >
                            Ver detalle
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                total={orders.data!.total}
                limit={orders.data!.limit}
                offset={orders.data!.offset}
                onOffsetChange={setOffset}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
