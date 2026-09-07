import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { SelectField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { TypewriterTitle } from "@/components/TypewriterTitle";
import { Badge, EmptyState, Pagination } from "@/features/masters/MasterTable";
import { useProducts } from "@/features/masters/useMasters";
import { describeStatus, statusTone } from "@/features/production/readiness";
import { useProductionOrders } from "@/features/production/useProductionOrders";
import { ApprovalBadge, StatusBadge } from "@/features/prototypes/PrototypeUi";
import { describePrototypeError } from "@/features/prototypes/prototypeLabels";
import { usePrototypes } from "@/features/prototypes/usePrototypes";
import { describeError } from "@/features/settings/messages";
import type { ProductionOrderFilters, ProductionOrderStatus } from "@/types/production";
import type { PrototypeApproval, PrototypeFilters, PrototypeStatus } from "@/types/prototypes";

const ALL = "ALL";
const PAGE_SIZE = 25;

const STATUS_OPTIONS_ORDERS = [
  { value: ALL, label: "Todos los estados" },
  { value: "CREATED", label: "Creada" },
  { value: "STARTED", label: "En proceso" },
  { value: "COMPLETED", label: "Completada" },
  { value: "CANCELLED", label: "Anulada" },
] as const;

const STATUS_OPTIONS_PRT = [
  { value: ALL, label: "Todos los estados" },
  { value: "CREATED", label: "Creado" },
  { value: "STARTED", label: "En fabricación" },
  { value: "COMPLETED", label: "Completado" },
  { value: "CANCELLED", label: "Anulado" },
];

const APPROVAL_OPTIONS = [
  { value: ALL, label: "Todas las evaluaciones" },
  { value: "PENDING", label: "Pendiente" },
  { value: "APPROVED", label: "Aprobado" },
  { value: "REJECTED", label: "Rechazado" },
];

function fecha(valor: string | null): string {
  return valor ? valor.slice(0, 10) : "—";
}

export function ProductionOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab = tabParam === "prototipos" ? "prototipos" : "ordenes";

  const handleTabChange = (nextTab: "ordenes" | "prototipos") => {
    setSearchParams(nextTab === "ordenes" ? {} : { tab: nextTab });
  };

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
        <nav
          role="tablist"
          aria-label="Vistas de producción"
          className="mb-5 flex gap-6 border-b border-zinc-200"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "ordenes"}
            onClick={() => handleTabChange("ordenes")}
            className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
              tab === "ordenes"
                ? "border-zinc-900 text-zinc-900 font-semibold"
                : "border-transparent text-zinc-400 hover:text-zinc-700"
            }`}
          >
            Órdenes de producción
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "prototipos"}
            onClick={() => handleTabChange("prototipos")}
            className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
              tab === "prototipos"
                ? "border-zinc-900 text-zinc-900 font-semibold"
                : "border-transparent text-zinc-400 hover:text-zinc-700"
            }`}
          >
            Prototipos
          </button>
        </nav>

        {tab === "ordenes" ? <ProductionOrdersSection /> : <PrototypesSection />}
      </div>
    </div>
  );
}

function ProductionOrdersSection() {
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
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SelectField
          label="Estado"
          value={status}
          options={STATUS_OPTIONS_ORDERS}
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
  );
}

function PrototypesSection() {
  const [statusPrt, setStatusPrt] = useState(ALL);
  const [approvalPrt, setApprovalPrt] = useState(ALL);
  const [offsetPrt, setOffsetPrt] = useState(0);

  useEffect(() => setOffsetPrt(0), [statusPrt, approvalPrt]);

  const prtFilters: PrototypeFilters = {
    ...(statusPrt === ALL ? {} : { status: statusPrt as PrototypeStatus }),
    ...(approvalPrt === ALL ? {} : { approval: approvalPrt as PrototypeApproval }),
    limit: PAGE_SIZE,
    offset: offsetPrt,
  };
  const prototypes = usePrototypes(prtFilters);
  const products = useProducts({ active: true, limit: 200 });
  const productNames = useMemo(
    () =>
      new Map(
        (products.data?.items ?? []).map((product) => [
          product.id,
          product.name,
        ]),
      ),
    [products.data],
  );

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <SelectField
          label="Fabricación"
          value={statusPrt}
          options={STATUS_OPTIONS_PRT}
          onChange={setStatusPrt}
        />
        <SelectField
          label="Evaluación"
          value={approvalPrt}
          options={APPROVAL_OPTIONS}
          onChange={setApprovalPrt}
        />
      </div>

      <div className="mt-5">
        {prototypes.isPending ? (
          <div className="flex justify-center py-16">
            <Spinner className="size-5" label="Cargando prototipos…" />
          </div>
        ) : prototypes.isError ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700"
          >
            {describePrototypeError(prototypes.error)}
          </p>
        ) : !prototypes.data?.items.length ? (
          <EmptyState message="Todavía no hay prototipos con estos filtros." />
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white/80">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Código PRT</th>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3">Cotización</th>
                    <th className="px-4 py-3 text-right">Muestra</th>
                    <th className="px-4 py-3">Fabricación</th>
                    <th className="px-4 py-3">Evaluación</th>
                    <th className="px-4 py-3 text-right">Días objetivo</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {prototypes.data.items.map((prototype) => (
                    <tr key={prototype.id} className="hover:bg-zinc-50/70">
                      <td className="px-4 py-3 font-mono font-bold">
                        {prototype.code}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {prototype.name}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {prototype.product_id
                          ? productNames.get(prototype.product_id) ??
                            "Producto vinculado"
                          : "Sin producto"}
                      </td>
                      <td className="px-4 py-3">
                        {prototype.quotation_id ? (
                          <Link
                            className="font-mono hover:underline"
                            to={`/cotizaciones/${prototype.quotation_id}`}
                          >
                            {prototype.quotation_code ??
                              "Cotización vinculada"}
                          </Link>
                        ) : (
                          "Sin cotización"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {prototype.quantity}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={prototype.status} />
                      </td>
                      <td className="px-4 py-3">
                        <ApprovalBadge approval={prototype.approval} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {prototype.target_days ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {prototype.requested_at.slice(0, 10)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/produccion/prototipos/${prototype.id}`}
                          className="font-medium hover:underline"
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
              total={prototypes.data.total}
              limit={prototypes.data.limit}
              offset={prototypes.data.offset}
              onOffsetChange={setOffsetPrt}
            />
          </>
        )}
      </div>
    </div>
  );
}
