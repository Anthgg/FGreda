import { useId, useState, type ReactNode } from "react";

import { formatPercentage } from "@/features/firings/labels";
import { formatCosto, formatPrecio } from "@/features/cotizadorV2/moneda";
import { esMonedaExtranjera } from "@/features/cotizadorV2/pasos";
import type { V2Quotation } from "@/types/quoterV2";
import type { V2QuotationProduct } from "@/types/quoterV2Materials";
import type { V2Pricing } from "@/types/quoterV2Pricing";

/**
 * El resumen que acompaña a la cotización en todos los pasos. Fase 010O.3.
 *
 * Solo LEE. Cada cifra es un campo del backend tal cual llega de `/pricing`:
 * aquí no se suma, no se resta y no se multiplica nada. Lo único que se cuenta
 * son las piezas, que son un número entero de cosas, no dinero.
 *
 * Dos monedas, cada una en su sitio (ver `moneda.ts`): el total al cliente en
 * la de la cotización; lo que cuesta y lo que se gana, en la base del taller.
 * En una cotización en dólares se ven los dos símbolos, y se dice por qué.
 *
 * Tres presentaciones según el sitio que haya, decididas por la consulta de
 * contenedor del shell: columna fija a la derecha, dos tarjetas debajo del
 * paso, o una sola línea desplegable en el teléfono.
 */

const PERDIDA = "V2_PRICING_SELLING_BELOW_REAL_COST";

type Props = {
  cotizacion: V2Quotation;
  precio: V2Pricing | undefined;
  precioCargando: boolean;
  precioError: boolean;
  lineas: readonly V2QuotationProduct[] | undefined;
  /** La lista de pendientes, ya montada por el shell. */
  pendientes: ReactNode;
  /** Cuántas cosas impiden emitir, si ya se sabe. Para la línea del teléfono. */
  faltas: number | undefined;
  className?: string;
};

function Fila({ etiqueta, valor, tono }: { etiqueta: string; valor: string; tono?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5 text-[13px]">
      <dt className="text-zinc-600">{etiqueta}</dt>
      <dd className={`font-semibold tabular-nums ${tono ?? "text-zinc-900"}`}>{valor}</dd>
    </div>
  );
}

function Dinero({
  cotizacion,
  precio,
  precioCargando,
  precioError,
  piezas,
}: {
  cotizacion: V2Quotation;
  precio: V2Pricing | undefined;
  precioCargando: boolean;
  precioError: boolean;
  piezas: number | null;
}) {
  const titulo = useId();

  if (precioCargando) {
    return (
      <section aria-busy="true" className="glass-panel min-h-[196px] rounded-2xl p-5">
        <p className="text-xs text-zinc-500">Calculando el precio…</p>
      </section>
    );
  }
  if (precioError || !precio) {
    return (
      <section className="glass-panel min-h-[196px] rounded-2xl p-5">
        <p role="alert" className="text-xs text-red-700">
          No se pudo leer el precio de esta cotización.
        </p>
      </section>
    );
  }

  const sinFactor = precio.commercial_factor === null;
  const perdida = precio.warnings.includes(PERDIDA);
  const conIgv = precio.tax_percent !== null && Number(precio.tax_percent) > 0;
  const textoPiezas =
    piezas === null ? null : piezas === 1 ? "1 pieza" : `${piezas} piezas`;

  return (
    <section
      aria-labelledby={titulo}
      data-testid="v2next-resumen-dinero"
      className="glass-panel min-h-[196px] rounded-2xl p-5"
    >
      <h2 id={titulo} className="text-xs font-medium text-zinc-600">
        Total para el cliente
      </h2>
      <p
        data-testid="v2next-total"
        className="mt-0.5 text-[28px] font-extrabold leading-tight tracking-tight text-zinc-950 tabular-nums"
      >
        {sinFactor ? "—" : formatPrecio(precio.total, cotizacion)}
      </p>
      <p className="text-xs text-zinc-500">
        {sinFactor
          ? "Sin factor comercial todavía: no hay precio."
          : [textoPiezas, conIgv ? "IGV incluido" : "sin IGV"].filter(Boolean).join(" · ")}
      </p>

      <dl className="mt-3 border-t border-black/[0.06] pt-3">
        <Fila etiqueta="Costo real" valor={formatCosto(precio.real_cost)} />
        <Fila
          etiqueta={perdida ? "Ganamos (pérdida)" : "Ganamos"}
          valor={sinFactor ? "—" : formatCosto(precio.estimated_profit)}
          tono={perdida ? "text-red-700" : "text-emerald-700"}
        />
        <Fila
          etiqueta="Margen"
          valor={sinFactor ? "—" : formatPercentage(precio.effective_margin_percent)}
          tono={perdida ? "text-red-700" : "text-emerald-700"}
        />
      </dl>

      {esMonedaExtranjera(cotizacion.currency_code) ? (
        <p className="mt-3 text-[11.5px] text-zinc-500">
          El total va en {cotizacion.currency_code}; lo que cuesta y lo que se gana, en soles.
        </p>
      ) : null}
    </section>
  );
}

export function V2QuotationSummaryRail({
  cotizacion,
  precio,
  precioCargando,
  precioError,
  lineas,
  pendientes,
  faltas,
  className = "",
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const detalle = useId();
  const piezas = lineas ? lineas.reduce((total, linea) => total + linea.quantity, 0) : null;
  const dinero = (
    <Dinero
      cotizacion={cotizacion}
      precio={precio}
      precioCargando={precioCargando}
      precioError={precioError}
      piezas={piezas}
    />
  );

  const totalCompacto =
    precio && precio.commercial_factor !== null ? formatPrecio(precio.total, cotizacion) : "—";
  const estadoCompacto =
    cotizacion.status !== "DRAFT"
      ? "Valores congelados"
      : faltas === undefined
        ? "Pendientes por comprobar"
        : faltas === 0
          ? "Todo listo para emitir"
          : faltas === 1
            ? "Falta 1 cosa"
            : `Faltan ${faltas} cosas`;

  return (
    <aside
      aria-label="Resumen de la cotización"
      data-testid="v2next-resumen"
      className={`min-w-0 self-start ${className}`}
    >
      {/* Teléfono: una línea con el total y lo que falta, desplegable. */}
      <div data-testid="v2next-resumen-compacto" className="@min-[760px]:hidden">
        <button
          type="button"
          aria-expanded={abierto}
          aria-controls={detalle}
          onClick={() => setAbierto((valor) => !valor)}
          className="glass-panel flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left cursor-pointer"
        >
          <span className="min-w-0">
            <span className="block text-[11.5px] text-zinc-600">Total para el cliente</span>
            <span className="block text-lg font-extrabold tabular-nums text-zinc-950">
              {totalCompacto}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-zinc-700">
            {estadoCompacto}
            <span aria-hidden="true">{abierto ? "▴" : "▾"}</span>
          </span>
        </button>
        {abierto ? (
          <div id={detalle} className="mt-3 space-y-3">
            {dinero}
            {pendientes}
          </div>
        ) : null}
      </div>

      {/* Tablet: dos tarjetas debajo del paso. Escritorio: columna derecha. */}
      <div className="hidden gap-4 @min-[760px]:grid @min-[760px]:grid-cols-2 @min-[1120px]:grid-cols-1">
        {dinero}
        {pendientes}
      </div>
    </aside>
  );
}
