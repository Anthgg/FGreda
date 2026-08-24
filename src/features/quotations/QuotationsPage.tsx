import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { DatePickerField, ProductSelectField, SelectField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { TypewriterTitle } from "@/components/TypewriterTitle";
import { useSession } from "@/features/auth/useSession";
import { formatDecimalString } from "@/features/firings/labels";
import { Badge, EmptyState, Pagination, SearchInput } from "@/features/masters/MasterTable";
import { QuotationMastersTab } from "@/features/quotations/QuotationMastersTab";
import { useQuotations } from "@/features/quotations/useQuotations";
import { describeError } from "@/features/settings/messages";
import type { QuotationFilters, QuotationStatus } from "@/types/quotations";

type TabId = "list" | "masters";
const ALL = "ALL";
const PAGE_SIZE = 25;
const STATUS_OPTIONS = [
  { value: ALL, label: "Todos los estados" },
  { value: "DRAFT", label: "Borrador" },
  { value: "CONFIRMED", label: "Confirmada" },
  { value: "CANCELLED", label: "Anulada" },
] as const;
const STATUS_LABEL: Record<QuotationStatus, string> = {
  DRAFT: "Borrador",
  CONFIRMED: "Confirmada",
  CANCELLED: "Anulada",
};
const STATUS_TONE: Record<QuotationStatus, "warning" | "positive" | "neutral"> = {
  DRAFT: "warning",
  CONFIRMED: "positive",
  CANCELLED: "neutral",
};

export function QuotationsPage() {
  const { data: user } = useSession();
  const isAdmin = user?.role === "ADMIN";
  const [tab, setTab] = useState<TabId>("list");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<string>(ALL);
  const [product, setProduct] = useState("");
  const [productLabel, setProductLabel] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => setOffset(0), [debounced, status, product, dateFrom, dateTo]);

  const filters = useMemo<QuotationFilters>(() => ({
    ...(debounced.trim() ? { search: debounced.trim() } : {}),
    ...(status !== ALL ? { status: status as QuotationStatus } : {}),
    ...(/^[1-9]\d*$/.test(product) ? { product: Number(product) } : {}),
    ...(dateFrom ? { date_from: dateFrom } : {}),
    ...(dateTo ? { date_to: dateTo } : {}),
    limit: PAGE_SIZE,
    offset,
  }), [dateFrom, dateTo, debounced, offset, product, status]);
  const quotes = useQuotations(filters);

  return (
    <div className="w-full space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <TypewriterTitle text="Cotizaciones." className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl" />
          <p className="mt-1 text-xs text-zinc-500 sm:text-sm">Costos integrales, trazabilidad de clientes y precios de venta.</p>
        </div>
        {isAdmin ? (
          <Link to="/cotizaciones/nueva" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-5 text-sm font-medium text-white shadow-xs hover:bg-black">
            Nueva cotización
          </Link>
        ) : null}
      </header>

      <div className="glass-panel rounded-2xl border border-white/60 p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <nav role="tablist" aria-label="Vistas de cotizaciones" className="mb-5 flex gap-6 border-b border-zinc-200">
          {([{ id: "list", label: "Listado" }, { id: "masters", label: "Maestros de costos" }] as const).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`border-b-2 pb-3 text-sm font-medium ${tab === item.id ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-400 hover:text-zinc-700"}`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {tab === "masters" ? <QuotationMastersTab canEdit={isAdmin} /> : (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <SearchInput value={search} onChange={setSearch} label="Buscar cotizaciones" placeholder="CTZ, cliente, producto..." />
              <SelectField label="Estado" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
              <ProductSelectField
                label="Producto"
                value={product}
                selectedLabel={productLabel}
                productType="FINISHED_PRODUCT"
                placeholder="Todos los productos"
                onChange={(next, selected) => {
                  setProduct(next);
                  setProductLabel(selected ? `${selected.internal_reference} · ${selected.name}` : "");
                }}
              />
              <DatePickerField label="Desde" value={dateFrom} onChange={setDateFrom} clearable />
              <DatePickerField label="Hasta" value={dateTo} onChange={setDateTo} clearable />
            </div>

            {quotes.isPending ? (
              <div className="flex justify-center py-16"><Spinner className="size-5" label="Cargando cotizaciones…" /></div>
            ) : quotes.isError ? (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700">{describeError(quotes.error)}</p>
            ) : (quotes.data?.items.length ?? 0) === 0 ? (
              <EmptyState message="No hay cotizaciones que coincidan con los filtros." />
            ) : (
              <>
                <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white/80">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">CTZ / Nombre</th>
                        <th className="px-4 py-3 font-semibold">Cliente</th>
                        <th className="px-4 py-3 font-semibold">Fecha</th>
                        <th className="px-4 py-3 font-semibold">Producto</th>
                        <th className="px-4 py-3 text-right font-semibold">Cantidad</th>
                        <th className="px-4 py-3 font-semibold">Estado</th>
                        <th className="px-4 py-3 text-right font-semibold">Precio unitario</th>
                        <th className="px-4 py-3 text-right font-semibold">Total con IGV</th>
                        <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {quotes.data!.items.map((quote) => (
                        <tr key={quote.id} className="hover:bg-zinc-50/70">
                          <td className="px-4 py-3">
                            <span className="font-mono font-bold text-zinc-900">{quote.code}</span>
                            {quote.name ? <span className="block text-[11px] text-zinc-600 font-medium truncate max-w-[12rem]">{quote.name}</span> : null}
                          </td>
                          <td className="px-4 py-3">
                            {quote.customer_name ? (
                              <>
                                <span className="font-medium text-zinc-900 block truncate max-w-[10rem]">{quote.customer_name}</span>
                                {quote.customer_document_number ? (
                                  <span className="text-[10px] text-zinc-400 font-mono">{quote.customer_document_number}</span>
                                ) : null}
                              </>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-zinc-500">{quote.created_at.slice(0, 10)}</td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-zinc-900">{quote.product_name}</span>
                            <span className="block font-mono text-[10px] text-zinc-400">{quote.product_internal_reference}</span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium">{quote.quantity}</td>
                          <td className="px-4 py-3"><Badge tone={STATUS_TONE[quote.status]}>{STATUS_LABEL[quote.status]}</Badge></td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            S/ {formatDecimalString(quote.commercial_sale_unit_price || quote.calculated_unit_price, 2)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-zinc-950">
                            S/ {formatDecimalString(quote.commercial_total || quote.total_with_tax, 2)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link to={`/cotizaciones/${quote.id}`} className="font-medium text-zinc-700 hover:text-black hover:underline">
                              Ver detalle
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination total={quotes.data!.total} limit={quotes.data!.limit} offset={quotes.data!.offset} onOffsetChange={setOffset} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
