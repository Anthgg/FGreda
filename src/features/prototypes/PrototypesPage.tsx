import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { fetchPrototypeQuotationPdf } from "@/api/prototypeQuotations";
import { SelectField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { TypewriterTitle } from "@/components/TypewriterTitle";
import { Badge, EmptyState, Pagination } from "@/features/masters/MasterTable";
import { useProducts } from "@/features/masters/useMasters";
import {
  usePrototypeQuotation,
  usePrototypeQuotations,
} from "@/features/prototypeQuotations/usePrototypeQuotations";
import { ApprovalBadge, StatusBadge } from "@/features/prototypes/PrototypeUi";
import { describePrototypeError } from "@/features/prototypes/prototypeLabels";
import { usePrototypes } from "@/features/prototypes/usePrototypes";
import { formatMoney } from "@/features/quotations/money";
import type {
  PrototypeQuotationListItem,
  PrototypeQuotationStatus,
} from "@/types/prototypeQuotations";
import type { PrototypeApproval, PrototypeFilters, PrototypeStatus } from "@/types/prototypes";

const ALL = "ALL";
const PAGE_SIZE = 25;

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

const STATUS_OPTIONS_CPR = [
  { value: ALL, label: "Todos los estados" },
  { value: "DRAFT", label: "Borrador" },
  { value: "CONFIRMED", label: "Emitida" },
  { value: "CANCELLED", label: "Anulada" },
];

const CPR_STATUS_LABEL: Record<PrototypeQuotationStatus, string> = {
  DRAFT: "Borrador",
  CONFIRMED: "Emitida",
  CANCELLED: "Anulada",
};

const CPR_STATUS_TONE: Record<PrototypeQuotationStatus, "warning" | "positive" | "neutral"> = {
  DRAFT: "warning",
  CONFIRMED: "positive",
  CANCELLED: "neutral",
};

export function PrototypesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [tab, setTab] = useState<"cotizaciones" | "muestras">(
    tabParam === "muestras" ? "muestras" : "cotizaciones",
  );

  // Filtros tabla A (Cotizaciones CPR)
  const [statusCpr, setStatusCpr] = useState(ALL);
  const [offsetCpr, setOffsetCpr] = useState(0);
  useEffect(() => setOffsetCpr(0), [statusCpr]);

  const cprFilters: Record<string, unknown> = {
    ...(statusCpr === ALL ? {} : { status: statusCpr }),
    limit: PAGE_SIZE,
    offset: offsetCpr,
  };
  const cprQuery = usePrototypeQuotations(cprFilters);

  // Filtros tabla B (Muestras físicas PRT)
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

  const handleTabChange = (nextTab: "cotizaciones" | "muestras") => {
    setTab(nextTab);
    setSearchParams(nextTab === "cotizaciones" ? {} : { tab: nextTab });
  };

  const handleDownloadPdf = async (id: number) => {
    try {
      const { blob, filename } = await fetchPrototypeQuotationPdf(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename ?? `cotizacion-prototipo-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Ignorar fallo de descarga en entornos sin soporte
    }
  };

  return (
    <div className="w-full space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <TypewriterTitle
            text="Prototipos."
            className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl"
          />
          <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
            Cotizaciones de muestras, desarrollo en taller y seguimiento físico.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/prototipos/cotizador"
            className="inline-flex rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Cotizar prototipo
          </Link>
        </div>
      </header>

      <section className="glass-panel rounded-2xl border border-white/60 p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <nav
          role="tablist"
          aria-label="Vistas de prototipos"
          className="mb-5 flex gap-6 border-b border-zinc-200"
        >
          {(
            [
              { id: "cotizaciones", label: "Cotizaciones de prototipo" },
              { id: "muestras", label: "Muestras en producción" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => handleTabChange(item.id)}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                tab === item.id
                  ? "border-zinc-900 text-zinc-900 font-semibold"
                  : "border-transparent text-zinc-400 hover:text-zinc-700"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {tab === "cotizaciones" ? (
          <div>
            <div className="grid gap-3 sm:grid-cols-2 lg:max-w-md">
              <SelectField
                label="Estado"
                value={statusCpr}
                options={STATUS_OPTIONS_CPR}
                onChange={setStatusCpr}
              />
            </div>

            <div className="mt-5">
              {cprQuery.isPending ? (
                <div className="flex justify-center py-16">
                  <Spinner className="size-5" label="Cargando cotizaciones…" />
                </div>
              ) : cprQuery.isError ? (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700"
                >
                  Error al cargar las cotizaciones de prototipo.
                </p>
              ) : !cprQuery.data?.items.length ? (
                <EmptyState message="Todavía no hay cotizaciones de prototipo con estos filtros." />
              ) : (
                <>
                  <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white/80">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
                        <tr>
                          <th className="px-4 py-3">CPR</th>
                          <th className="px-4 py-3">Cliente</th>
                          <th className="px-4 py-3">Prototipo</th>
                          <th className="px-4 py-3">Estado</th>
                          <th className="px-4 py-3">Pago</th>
                          <th className="px-4 py-3 text-right">Total</th>
                          <th className="px-4 py-3">Fecha</th>
                          <th className="px-4 py-3 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {cprQuery.data.items.map((item) => (
                          <tr key={item.id} className="hover:bg-zinc-50/70">
                            <td className="px-4 py-3 font-mono font-bold">
                              {item.code ? (
                                <Link
                                  to={`/prototipos/cotizador/${item.id}`}
                                  className="hover:underline"
                                >
                                  {item.code}
                                </Link>
                              ) : (
                                <span className="text-zinc-400">
                                  Borrador #{item.id}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-medium">
                              {item.customer_name || "—"}
                            </td>
                            <td className="px-4 py-3 text-zinc-700">
                              {item.description}
                              {item.quantity > 1 ? (
                                <span className="ml-1 text-zinc-400">
                                  (×{item.quantity})
                                </span>
                              ) : null}
                            </td>
                            <td className="px-4 py-3">
                              <Badge tone={CPR_STATUS_TONE[item.status]}>
                                {CPR_STATUS_LABEL[item.status]}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              {item.status === "CONFIRMED" ? (
                                <Badge
                                  tone={
                                    item.payment_status === "PAID"
                                      ? "positive"
                                      : "warning"
                                  }
                                >
                                  {item.payment_status === "PAID"
                                    ? "Pagada"
                                    : "Pendiente"}
                                </Badge>
                              ) : (
                                <span className="text-zinc-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums font-medium">
                              {item.commercial_gross_total
                                ? formatMoney(
                                    item.commercial_gross_total,
                                    item.currency_code ?? "PEN",
                                  )
                                : "—"}
                            </td>
                            <td className="px-4 py-3 text-zinc-500">
                              {item.confirmed_at
                                ? item.confirmed_at.slice(0, 10)
                                : "—"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {item.status === "DRAFT" ? (
                                <Link
                                  to={`/prototipos/cotizador/${item.id}`}
                                  className="font-medium text-orange-700 hover:underline"
                                >
                                  Continuar
                                </Link>
                              ) : item.payment_status === "PAID" ? (
                                <CprPaidActions
                                  item={item}
                                  onDownloadPdf={handleDownloadPdf}
                                />
                              ) : (
                                <div className="flex items-center justify-end gap-3">
                                  <Link
                                    to={`/prototipos/cotizador/${item.id}`}
                                    className="font-medium text-zinc-900 hover:underline"
                                  >
                                    Ver
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadPdf(item.id)}
                                    className="font-medium text-zinc-600 hover:underline"
                                  >
                                    PDF
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination
                    total={cprQuery.data.total}
                    limit={PAGE_SIZE}
                    offset={offsetCpr}
                    onOffsetChange={setOffsetCpr}
                  />
                </>
              )}
            </div>
          </div>
        ) : (
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
                                to={`/prototipos/${prototype.id}`}
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
        )}
      </section>
    </div>
  );
}

function CprPaidActions({
  item,
  onDownloadPdf,
}: {
  item: PrototypeQuotationListItem;
  onDownloadPdf: (id: number) => void;
}) {
  const detail = usePrototypeQuotation(item.id);
  const prototypeId = detail.data?.prototype_id;

  return (
    <div className="flex items-center justify-end gap-3">
      <Link
        to={`/prototipos/cotizador/${item.id}`}
        className="font-medium text-zinc-900 hover:underline"
      >
        Ver
      </Link>
      <button
        type="button"
        onClick={() => onDownloadPdf(item.id)}
        className="font-medium text-zinc-600 hover:underline"
      >
        PDF
      </button>
      {prototypeId ? (
        <Link
          to={`/prototipos/${prototypeId}`}
          className="font-semibold text-black hover:underline"
        >
          Producción
        </Link>
      ) : null}
    </div>
  );
}

