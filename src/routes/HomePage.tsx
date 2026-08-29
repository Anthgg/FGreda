import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  DollarSignIcon,
  FilePlusIcon,
  FileTextIcon,
  MoreVerticalIcon,
  PackageIcon,
  PlusIcon,
  TrendingUpIcon,
  UserIcon,
  UsersIcon,
} from "@/components/icons";
import { Spinner } from "@/components/Spinner";
import { TypewriterTitle } from "@/components/TypewriterTitle";
import { formatDecimalString } from "@/features/firings/labels";
import { Badge } from "@/features/masters/MasterTable";
import { usePartners, useProducts, useStock } from "@/features/masters/useMasters";
import { useAllQuotations, useQuotations } from "@/features/quotations/useQuotations";
import type { QuotationStatus, QuotationSummaryOut } from "@/types/quotations";

/**
 * Formatea una fecha ISO a formato legible dd/mm/aaaa.
 */
function formatDate(isoString: string): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString.slice(0, 10);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return isoString.slice(0, 10);
  }
}

/**
 * Calcula un tiempo relativo en español para la actividad reciente.
 */
function formatRelativeTime(isoString: string): string {
  if (!isoString) return "Reciente";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "Reciente";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Justo ahora";
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays === 1) return "Ayer";
    if (diffDays < 7) return `Hace ${diffDays} días`;

    const day = String(date.getDate()).padStart(2, "0");
    const monthNames = [
      "ene",
      "feb",
      "mar",
      "abr",
      "may",
      "jun",
      "jul",
      "ago",
      "sep",
      "oct",
      "nov",
      "dic",
    ];
    return `${day} ${monthNames[date.getMonth()] ?? ""}`;
  } catch {
    return "Reciente";
  }
}

/**
 * Un Decimal serializado en "0", "0.00" o notacion cientifica ("0E-18") es una
 * cadena no vacia: `||` lo trata como verdadero y nunca cae al siguiente campo
 * de la cascada. Sin este chequeo numerico, una cotizacion Legacy cuyo
 * commercial_total nunca se poblo (queda en cero) pisa un total_with_tax real
 * y no nulo con un cero silencioso.
 */
function isMeaningfulTotal(value: string | undefined): value is string {
  if (!value) return false;
  const parsed = parseFloat(value);
  return !isNaN(parsed) && parsed !== 0;
}

/** Total crudo (sin formatear) para cotizaciones de tipo Cotizador o Legacy. */
function getQuoteTotalRaw(quote: QuotationSummaryOut): string {
  if (quote.workflow === "COTIZADOR") return quote.total_with_tax;
  if (isMeaningfulTotal(quote.commercial_total)) return quote.commercial_total;
  if (isMeaningfulTotal(quote.total_with_tax)) return quote.total_with_tax;
  if (isMeaningfulTotal(quote.calculated_total)) return quote.calculated_total;
  return quote.commercial_total || quote.total_with_tax || quote.calculated_total || "0";
}

/**
 * Formato del total monetario para cotizaciones de tipo Cotizador o Legacy.
 */
function getQuoteTotal(quote: QuotationSummaryOut): string {
  return formatDecimalString(getQuoteTotalRaw(quote), 2);
}

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

/**
 * Pantalla de Inicio / Dashboard Operativo de GREDA.
 *
 * Muestra KPIs en tiempo real del taller, cotizaciones recientes,
 * bloque de pendientes/alertas, actividad cronológica y accesos rápidos secundarios.
 */
export function HomePage() {
  const navigate = useNavigate();

  // Rangos del mes actual y del anterior, en el formato ISO que espera el
  // backend. Se calculan una vez para no recrear las claves de consulta en
  // cada render.
  const ranges = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return {
      thisFrom: iso(new Date(y, m, 1)),
      thisTo: iso(new Date(y, m + 1, 0)),
      prevFrom: iso(new Date(y, m - 1, 1)),
      prevTo: iso(new Date(y, m, 0)),
    };
  }, []);

  // Los CONTADORES los cuenta el backend, no esta pantalla.
  //
  // Antes se pedia una pagina de 100 cotizaciones y se contaba `items.length`:
  // con 229 cotizaciones el panel mostraba 100, y ahi se quedaba clavado por
  // muchas que hubiera. Ahora se pide `limit: 1` con los filtros que el
  // endpoint ya soporta y se lee `total`, que es el numero real.
  const monthCount = useQuotations({ limit: 1, date_from: ranges.thisFrom, date_to: ranges.thisTo });
  const monthConfirmedCount = useQuotations({
    limit: 1,
    status: "CONFIRMED",
    date_from: ranges.thisFrom,
    date_to: ranges.thisTo,
  });
  const prevMonthCount = useQuotations({ limit: 1, date_from: ranges.prevFrom, date_to: ranges.prevTo });
  const prevMonthConfirmedCount = useQuotations({
    limit: 1,
    status: "CONFIRMED",
    date_from: ranges.prevFrom,
    date_to: ranges.prevTo,
  });
  const draftsCountQuery = useQuotations({ limit: 1, status: "DRAFT" });

  // Los importes si necesitan las filas. `useAllQuotations` recorre TODAS las
  // paginas del filtro: quedarse en la primera reintroduciria el mismo
  // truncamiento que tenian los contadores, solo que en soles y a partir de
  // 200 confirmadas en un mes.
  const confirmedThisMonthQuery = useAllQuotations({
    status: "CONFIRMED",
    date_from: ranges.thisFrom,
    date_to: ranges.thisTo,
  });
  const confirmedPrevMonthQuery = useAllQuotations({
    status: "CONFIRMED",
    date_from: ranges.prevFrom,
    date_to: ranges.prevTo,
  });

  // Lista de "cotizaciones recientes": solo se muestran las primeras filas,
  // asi que una pagina corta basta y no participa en ningun conteo.
  const quotesQuery = useQuotations({ limit: 100 });
  const productsQuery = useProducts({ limit: 100, product_type: "FINISHED_PRODUCT" });
  const stockQuery = useStock({ limit: 50 });
  const partnersQuery = usePartners({ limit: 10 });

  const quotes = useMemo(() => quotesQuery.data?.items ?? [], [quotesQuery.data?.items]);

  // Cálculos de métricas y períodos
  const metrics = useMemo(() => {
    const sum = (rows: QuotationSummaryOut[]) =>
      rows.reduce((acc, q) => {
        const val = parseFloat(getQuoteTotalRaw(q));
        return acc + (isNaN(val) ? 0 : val);
      }, 0);

    const quotesCount = monthCount.data?.total ?? 0;
    const quotesLastCount = prevMonthCount.data?.total ?? 0;
    const confirmedCount = monthConfirmedCount.data?.total ?? 0;
    const confirmedLastCount = prevMonthConfirmedCount.data?.total ?? 0;

    const totalCommercialThisMonth = sum(confirmedThisMonthQuery.data ?? []);
    const totalCommercialLastMonth = sum(confirmedPrevMonthQuery.data ?? []);

    // Sin mes anterior no hay porcentaje que calcular: dividir entre cero
    // daria Infinity y la tarjeta mostraria un crecimiento inventado.
    const growth = (current: number, previous: number) =>
      previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;

    return {
      quotesCount,
      quotesGrowth: growth(quotesCount, quotesLastCount),
      confirmedCount,
      confirmedGrowth: growth(confirmedCount, confirmedLastCount),
      draftsCount: draftsCountQuery.data?.total ?? 0,
      totalCotizado: totalCommercialThisMonth,
      totalGrowth: growth(totalCommercialThisMonth, totalCommercialLastMonth),
    };
  }, [
    monthCount.data?.total,
    prevMonthCount.data?.total,
    monthConfirmedCount.data?.total,
    prevMonthConfirmedCount.data?.total,
    draftsCountQuery.data?.total,
    confirmedThisMonthQuery.data,
    confirmedPrevMonthQuery.data,
  ]);

  // Alertas calculadas a partir de datos reales existentes
  const alerts = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      subtitle: string;
      to: string;
      tone: "amber" | "yellow" | "red";
      icon: "draft" | "product" | "stock";
    }> = [];

    // 1. Borradores pendientes
    const drafts = quotes.filter((q) => q.status === "DRAFT");
    if (drafts.length > 0) {
      items.push({
        id: "drafts-alert",
        title: `${drafts.length} ${drafts.length === 1 ? "borrador" : "borradores"}`,
        subtitle: "Cotizaciones sin finalizar",
        to: "/cotizaciones",
        tone: "amber",
        icon: "draft",
      });
    }

    // 2. Productos sin medida / incompletos
    const finishedProducts = productsQuery.data?.items ?? [];
    const incompleteProducts = finishedProducts.filter(
      (p) => !p.width || !p.height || (!p.length && !p.depth) || !p.grammage,
    );
    if (incompleteProducts.length > 0) {
      items.push({
        id: "products-alert",
        title: `${incompleteProducts.length} ${incompleteProducts.length === 1 ? "producto sin medida" : "productos sin medida"}`,
        subtitle: "Completar dimensiones",
        to: "/productos",
        tone: "yellow",
        icon: "product",
      });
    }

    // 3. Alertas de inventario / stock en cero o bajo
    const stockItems = stockQuery.data?.items ?? [];
    const lowStockItems = stockItems.filter((s) => {
      const qty = parseFloat(s.quantity || "0");
      return qty <= 0;
    });
    if (lowStockItems.length > 0) {
      items.push({
        id: "stock-alert",
        title: `${lowStockItems.length} ${lowStockItems.length === 1 ? "alerta de stock" : "alertas de stock"}`,
        subtitle: "Stock mínimo o agotado",
        to: "/inventario",
        tone: "red",
        icon: "stock",
      });
    }

    return items;
  }, [quotes, productsQuery.data?.items, stockQuery.data?.items]);

  // Actividad reciente construida a partir de entidades y marcas de tiempo reales
  const recentActivity = useMemo(() => {
    type ActivityItem = {
      id: string;
      title: string;
      date: string;
      to: string;
      tone: "green" | "blue" | "purple" | "neutral";
      icon: "check" | "user" | "package" | "file";
    };

    const list: ActivityItem[] = [];

    // Cotizaciones recientes
    quotes.slice(0, 6).forEach((q) => {
      if (q.status === "CONFIRMED") {
        list.push({
          id: `quote-conf-${q.id}`,
          title: `Cotización ${q.code} confirmada${q.customer_name ? ` para ${q.customer_name}` : ""}`,
          date: q.created_at,
          to: q.workflow === "COTIZADOR" ? `/cotizador/${q.id}` : `/cotizaciones/${q.id}`,
          tone: "green",
          icon: "check",
        });
      } else {
        list.push({
          id: `quote-new-${q.id}`,
          title: `Cotización ${q.code} registrada (${STATUS_LABEL[q.status] ?? q.status})`,
          date: q.created_at,
          to: q.workflow === "COTIZADOR" ? `/cotizador/${q.id}` : `/cotizaciones/${q.id}`,
          tone: "neutral",
          icon: "file",
        });
      }
    });

    // Terceros recientes
    const partners = partnersQuery.data?.items ?? [];
    partners.slice(0, 3).forEach((p) => {
      list.push({
        id: `partner-${p.id}`,
        title: `Nuevo tercero ${p.name} registrado`,
        date: quotes[0]?.created_at ?? new Date().toISOString(),
        to: "/terceros",
        tone: "blue",
        icon: "user",
      });
    });

    return list.slice(0, 5);
  }, [quotes, partnersQuery.data?.items]);

  // Cotizaciones para la tabla de recientes (máximo 5)
  const recentQuotes = useMemo(() => quotes.slice(0, 5), [quotes]);

  return (
    <div className="w-full space-y-6">
      {/* ========================================================================= */}
      {/* HEADER DE INICIO                                                          */}
      {/* ========================================================================= */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <TypewriterTitle
            text="Inicio."
            className="text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl"
          />
          <p className="mt-1 text-xs text-zinc-500 sm:text-sm">Resumen general del taller.</p>
        </div>

        <Link
          to="/cotizador/nuevo"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-xs sm:text-sm font-medium text-white shadow-xs transition-all duration-150 hover:bg-zinc-800 active:scale-[0.98] shrink-0"
        >
          <PlusIcon className="size-4" />
          <span>Nueva cotización</span>
        </Link>
      </header>

      {/* ========================================================================= */}
      {/* FILA DE KPIS (4 cards compactas)                                         */}
      {/* ========================================================================= */}
      <section
        aria-label="Métricas del taller"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {/* KPI 1: Cotizaciones este mes */}
        <div className="rounded-2xl border border-white/60 bg-white/60 p-4 sm:p-5 shadow-xs backdrop-blur-md transition-all duration-150 hover:bg-white/75 flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-zinc-100/90 text-zinc-700 border border-black/[0.04] shrink-0">
              <FileTextIcon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-500 truncate">Cotizaciones este mes</p>
              <p className="text-2xl font-bold text-zinc-900 tracking-tight mt-0.5">
                {quotesQuery.isPending ? "…" : metrics.quotesCount}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-black/[0.03] text-[11px] text-zinc-400">
            {metrics.quotesGrowth !== null ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                <TrendingUpIcon className="size-3" />
                {metrics.quotesGrowth >= 0
                  ? `+${metrics.quotesGrowth}%`
                  : `${metrics.quotesGrowth}%`}{" "}
                vs mes anterior
              </span>
            ) : (
              <span>en el mes actual</span>
            )}
          </div>
        </div>

        {/* KPI 2: Confirmadas */}
        <div className="rounded-2xl border border-white/60 bg-white/60 p-4 sm:p-5 shadow-xs backdrop-blur-md transition-all duration-150 hover:bg-white/75 flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 border border-emerald-500/25 shrink-0">
              <CheckCircleIcon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-500 truncate">Confirmadas</p>
              <p className="text-2xl font-bold text-zinc-900 tracking-tight mt-0.5">
                {quotesQuery.isPending ? "…" : metrics.confirmedCount}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-black/[0.03] text-[11px] text-zinc-400">
            {metrics.confirmedGrowth !== null ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                <TrendingUpIcon className="size-3" />
                {metrics.confirmedGrowth >= 0
                  ? `+${metrics.confirmedGrowth}%`
                  : `${metrics.confirmedGrowth}%`}{" "}
                vs mes anterior
              </span>
            ) : (
              <span>aprobadas del mes</span>
            )}
          </div>
        </div>

        {/* KPI 3: Borradores pendientes */}
        <Link
          to="/cotizaciones"
          className="group rounded-2xl border border-white/60 bg-white/60 p-4 sm:p-5 shadow-xs backdrop-blur-md transition-all duration-150 hover:bg-white/75 flex flex-col justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 border border-amber-500/25 shrink-0">
              <ClockIcon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-500 truncate group-hover:text-zinc-800 transition-colors">
                Borradores pendientes
              </p>
              <p className="text-2xl font-bold text-zinc-900 tracking-tight mt-0.5">
                {quotesQuery.isPending ? "…" : metrics.draftsCount}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-black/[0.03] text-[11px] text-zinc-400 flex items-center justify-between">
            <span>
              {metrics.draftsCount === 0 ? "sin pendientes" : "requieren atención"}
            </span>
            <ChevronRightIcon className="size-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {/* KPI 4: Total cotizado (mes) */}
        <div className="rounded-2xl border border-white/60 bg-white/60 p-4 sm:p-5 shadow-xs backdrop-blur-md transition-all duration-150 hover:bg-white/75 flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/15 text-purple-700 border border-purple-500/25 shrink-0">
              <DollarSignIcon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-500 truncate">Total cotizado (mes)</p>
              <p className="text-2xl font-bold text-zinc-900 tracking-tight mt-0.5">
                {quotesQuery.isPending
                  ? "…"
                  : `S/ ${metrics.totalCotizado.toLocaleString("es-PE", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-black/[0.03] text-[11px] text-zinc-400">
            {metrics.totalGrowth !== null ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                <TrendingUpIcon className="size-3" />
                {metrics.totalGrowth >= 0
                  ? `+${metrics.totalGrowth}%`
                  : `${metrics.totalGrowth}%`}{" "}
                vs mes anterior
              </span>
            ) : (
              <span>total confirmado</span>
            )}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* FILA PRINCIPAL: Cotizaciones recientes (70%) + Pendientes/Alertas (30%)   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Cotizaciones Recientes */}
        <section
          aria-label="Cotizaciones recientes"
          className="lg:col-span-8 rounded-3xl border border-white/60 bg-white/60 p-5 sm:p-6 shadow-xs backdrop-blur-md flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-black/[0.04]">
              <h2 className="text-sm font-semibold text-zinc-900">Cotizaciones recientes</h2>
              <Link
                to="/cotizaciones"
                className="text-xs font-medium text-zinc-600 hover:text-black rounded-lg px-2.5 py-1 hover:bg-white/80 transition-colors"
              >
                Ver todas
              </Link>
            </div>

            {quotesQuery.isPending ? (
              <div className="flex justify-center py-12">
                <Spinner className="size-5" label="Cargando cotizaciones recientes…" />
              </div>
            ) : recentQuotes.length === 0 ? (
              <div className="py-10 text-center text-xs text-zinc-400">
                No hay cotizaciones registradas aún.
              </div>
            ) : (
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-black/[0.04] text-[10.5px] uppercase tracking-wider text-zinc-400 font-semibold">
                      <th className="pb-2.5 pt-1 pl-1">Código</th>
                      <th className="pb-2.5 pt-1">Cliente</th>
                      <th className="pb-2.5 pt-1">Fecha</th>
                      <th className="pb-2.5 pt-1 text-right">Total</th>
                      <th className="pb-2.5 pt-1 text-center">Estado</th>
                      <th className="pb-2.5 pt-1 pr-1 text-right">
                        <span className="sr-only">Acción</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.03]">
                    {recentQuotes.map((quote) => {
                      const quoteUrl =
                        quote.workflow === "COTIZADOR"
                          ? `/cotizador/${quote.id}`
                          : `/cotizaciones/${quote.id}`;

                      return (
                        <tr
                          key={quote.id}
                          onClick={() => navigate(quoteUrl)}
                          className="group hover:bg-white/50 cursor-pointer transition-colors"
                        >
                          <td className="py-3 pl-1 font-mono font-bold text-zinc-900">
                            {quote.code}
                          </td>
                          <td className="py-3 max-w-[140px] truncate text-zinc-700">
                            {quote.customer_name || "—"}
                          </td>
                          <td className="py-3 text-zinc-500 whitespace-nowrap">
                            {formatDate(quote.created_at)}
                          </td>
                          <td className="py-3 text-right font-semibold tabular-nums text-zinc-900 whitespace-nowrap">
                            S/ {getQuoteTotal(quote)}
                          </td>
                          <td className="py-3 text-center">
                            <Badge tone={STATUS_TONE[quote.status]}>
                              {STATUS_LABEL[quote.status]}
                            </Badge>
                          </td>
                          <td className="py-3 pr-1 text-right">
                            <Link
                              to={quoteUrl}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Abrir cotización ${quote.code}`}
                              className="inline-flex size-7 items-center justify-center rounded-lg text-zinc-400 hover:text-black hover:bg-white transition-colors"
                            >
                              <MoreVerticalIcon className="size-4" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Pendientes / Alertas */}
        <section
          aria-label="Pendientes y alertas"
          className="lg:col-span-4 rounded-3xl border border-white/60 bg-white/60 p-5 sm:p-6 shadow-xs backdrop-blur-md flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-black/[0.04]">
              <h2 className="text-sm font-semibold text-zinc-900">Pendientes / Alertas</h2>
            </div>

            <div className="mt-3.5 space-y-2.5">
              {alerts.length === 0 ? (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <p className="text-xs font-semibold text-emerald-800">Todo al día</p>
                  <p className="text-[11px] text-emerald-600 mt-0.5">
                    No hay alertas operativas pendientes.
                  </p>
                </div>
              ) : (
                alerts.map((alert) => (
                  <Link
                    key={alert.id}
                    to={alert.to}
                    className="group flex items-center justify-between p-3 rounded-2xl bg-white/40 hover:bg-white/80 border border-white/50 shadow-2xs hover:shadow-xs transition-all duration-150"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={[
                          "flex size-9 items-center justify-center rounded-xl shrink-0",
                          alert.tone === "amber"
                            ? "bg-amber-500/15 text-amber-700 border border-amber-500/25"
                            : alert.tone === "yellow"
                              ? "bg-yellow-500/15 text-yellow-700 border border-yellow-500/25"
                              : "bg-red-500/15 text-red-700 border border-red-500/25",
                        ].join(" ")}
                      >
                        {alert.icon === "draft" ? (
                          <ClockIcon className="size-4.5" />
                        ) : alert.icon === "product" ? (
                          <PackageIcon className="size-4.5" />
                        ) : (
                          <AlertTriangleIcon className="size-4.5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-900 group-hover:text-black truncate">
                          {alert.title}
                        </p>
                        <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                          {alert.subtitle}
                        </p>
                      </div>
                    </div>
                    <ChevronRightIcon className="size-4 text-zinc-400 group-hover:text-black group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                  </Link>
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ========================================================================= */}
      {/* FILA INFERIOR: Actividad reciente (70%) + Accesos rápidos (30%)           */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Actividad Reciente */}
        <section
          aria-label="Actividad reciente"
          className="lg:col-span-8 rounded-3xl border border-white/60 bg-white/60 p-5 sm:p-6 shadow-xs backdrop-blur-md"
        >
          <div className="flex items-center justify-between pb-4 border-b border-black/[0.04]">
            <h2 className="text-sm font-semibold text-zinc-900">Actividad reciente</h2>
            <Link
              to="/cotizaciones"
              className="text-xs font-medium text-zinc-600 hover:text-black rounded-lg px-2.5 py-1 hover:bg-white/80 transition-colors"
            >
              Ver todas
            </Link>
          </div>

          {recentActivity.length === 0 ? (
            <p className="py-8 text-center text-xs text-zinc-400">No hay actividad reciente.</p>
          ) : (
            <div className="divide-y divide-black/[0.03] mt-1">
              {recentActivity.map((activity) => (
                <Link
                  key={activity.id}
                  to={activity.to}
                  className="group flex items-center justify-between py-3 px-2 -mx-2 rounded-xl hover:bg-white/45 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={[
                        "flex size-7 items-center justify-center rounded-lg shrink-0",
                        activity.tone === "green"
                          ? "bg-emerald-500/15 text-emerald-700"
                          : activity.tone === "blue"
                            ? "bg-blue-500/15 text-blue-700"
                            : activity.tone === "purple"
                              ? "bg-purple-500/15 text-purple-700"
                              : "bg-zinc-100 text-zinc-600",
                      ].join(" ")}
                    >
                      {activity.icon === "check" ? (
                        <CheckCircleIcon className="size-3.5" />
                      ) : activity.icon === "user" ? (
                        <UserIcon className="size-3.5" />
                      ) : activity.icon === "package" ? (
                        <PackageIcon className="size-3.5" />
                      ) : (
                        <FileTextIcon className="size-3.5" />
                      )}
                    </div>
                    <p className="text-xs text-zinc-700 group-hover:text-zinc-950 truncate font-medium">
                      {activity.title}
                    </p>
                  </div>
                  <span className="text-[11px] text-zinc-400 shrink-0 ml-3 whitespace-nowrap">
                    {formatRelativeTime(activity.date)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Accesos Rápidos Secundarios */}
        <section
          aria-label="Accesos rápidos"
          className="lg:col-span-4 rounded-3xl border border-white/60 bg-white/60 p-5 sm:p-6 shadow-xs backdrop-blur-md flex flex-col justify-between"
        >
          <div>
            <div className="pb-4 border-b border-black/[0.04]">
              <h2 className="text-sm font-semibold text-zinc-900">Accesos rápidos</h2>
            </div>

            <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-2.5">
              <Link
                to="/cotizador/nuevo"
                className="group flex flex-col items-center justify-center p-3 rounded-2xl bg-white/40 hover:bg-white/80 border border-white/50 shadow-2xs hover:shadow-xs transition-all duration-150 text-center"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-white/80 border border-white/60 text-zinc-800 group-hover:bg-black group-hover:text-white transition-colors mb-1.5 shadow-2xs">
                  <FilePlusIcon className="size-5" />
                </div>
                <span className="text-xs font-semibold text-zinc-800 group-hover:text-black">
                  Cotizador
                </span>
              </Link>

              <Link
                to="/productos"
                className="group flex flex-col items-center justify-center p-3 rounded-2xl bg-white/40 hover:bg-white/80 border border-white/50 shadow-2xs hover:shadow-xs transition-all duration-150 text-center"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-white/80 border border-white/60 text-zinc-800 group-hover:bg-black group-hover:text-white transition-colors mb-1.5 shadow-2xs">
                  <PackageIcon className="size-5" />
                </div>
                <span className="text-xs font-semibold text-zinc-800 group-hover:text-black">
                  Productos
                </span>
              </Link>

              <Link
                to="/terceros"
                className="group flex flex-col items-center justify-center p-3 rounded-2xl bg-white/40 hover:bg-white/80 border border-white/50 shadow-2xs hover:shadow-xs transition-all duration-150 text-center"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-white/80 border border-white/60 text-zinc-800 group-hover:bg-black group-hover:text-white transition-colors mb-1.5 shadow-2xs">
                  <UsersIcon className="size-5" />
                </div>
                <span className="text-xs font-semibold text-zinc-800 group-hover:text-black">
                  Terceros
                </span>
              </Link>

              <Link
                to="/cotizaciones"
                className="group flex flex-col items-center justify-center p-3 rounded-2xl bg-white/40 hover:bg-white/80 border border-white/50 shadow-2xs hover:shadow-xs transition-all duration-150 text-center"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-white/80 border border-white/60 text-zinc-800 group-hover:bg-black group-hover:text-white transition-colors mb-1.5 shadow-2xs">
                  <FileTextIcon className="size-5" />
                </div>
                <span className="text-xs font-semibold text-zinc-800 group-hover:text-black">
                  Cotizaciones
                </span>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

