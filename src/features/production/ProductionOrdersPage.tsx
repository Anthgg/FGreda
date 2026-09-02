import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { SelectField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { TypewriterTitle } from "@/components/TypewriterTitle";
import { Badge, EmptyState, Pagination } from "@/features/masters/MasterTable";
import { describeStatus, statusTone } from "@/features/production/readiness";
import { useProductionOrders } from "@/features/production/useProductionOrders";
import { describeError } from "@/features/settings/messages";
import type { ProductionOrderFilters, ProductionOrderStatus } from "@/types/production";

const ALL = "ALL";
const PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  { value: ALL, label: "Todos los estados" },
  { value: "CREATED", label: "Creada" },
  { value: "STARTED", label: "En proceso" },
  { value: "COMPLETED", label: "Completada" },
  { value: "CANCELLED", label: "Anulada" },
] as const;

function fecha(valor: string | null): string {
  return valor ? valor.slice(0, 10) : "—";
}

/**
 * Listado de órdenes de producción.
 *
 * No muestra disponibilidad: calcularla por fila sería una consulta de stock
 * por orden, y de un listado se mira el estado y las fechas. Quien necesita
 * saber si una orden puede arrancar, la abre.
 */
export function ProductionOrdersPage() {
  const [status, setStatus] = useState<string>(ALL);
  const [offset, setOffset] = useState(0);

  useEffect(() => setOffset(0), [status]);

  const filters: ProductionOrderFilters = {
    ...(status !== ALL ? { status: status as ProductionOrderStatus } : {}),
    limit: PAGE_SIZE,
    offset,
  };
  const orders = useProductionOrders(filters);

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
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SelectField
              label="Estado"
              value={status}
              options={STATUS_OPTIONS}
              onChange={setStatus}
            />
          </div>

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
          ) : (orders.data?.items.length ?? 0) === 0 ? (
            <EmptyState
              message={
                status === ALL
                  ? "Todavía no hay órdenes de producción. Se crean desde una cotización confirmada."
                  : "No hay órdenes con ese estado."
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white/80">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Orden</th>
                      <th className="px-4 py-3 font-semibold">Cotización</th>
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
                    {orders.data!.items.map((order) => (
                      <tr key={order.id} className="hover:bg-zinc-50/70">
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-zinc-900">{order.code}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            to={`/cotizador/${order.quotation_id}`}
                            className="font-mono text-zinc-700 hover:text-black hover:underline"
                          >
                            {order.quotation_code}
                          </Link>
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
