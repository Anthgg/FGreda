import { useId } from "react";

import { formatCosto, formatPrecio, type MonedaDeCotizacion } from "@/features/cotizadorV2/moneda";
import { porcentaje } from "@/features/cotizadorV2Next/steps/pricing/formato";
import { formatMoney } from "@/features/quotations/money";
import type { V2Pricing } from "@/types/quoterV2Pricing";

/**
 * Tablas del paso de precio. Fase 010O.10.
 *
 * Todo lo que se escribe aquí llega calculado: el unitario ya redondeado al
 * escalón comercial, el subtotal reconstruido sumando las líneas redondeadas,
 * el IGV y el total. La tabla no suma una columna para sacar el pie: el pie es
 * `subtotal`, `tax` y `total` del backend.
 */

/** Lo que el cliente paga por cada pieza, y el documento en tres cifras. */
export function PricePerPieceTable({
  precio,
  moneda,
}: {
  precio: V2Pricing;
  moneda: MonedaDeCotizacion;
}) {
  const titulo = useId();
  return (
    <section aria-labelledby={titulo} data-testid="v2next-precio-por-pieza">
      <h3 id={titulo} className="text-base font-bold text-zinc-950">
        Precio por pieza
      </h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[20rem] text-left text-[13px]">
          <thead>
            <tr className="text-xs text-zinc-500">
              <th scope="col" className="py-2 pr-3 font-semibold">
                Pieza
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">
                Cant.
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">
                Precio c/u
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {precio.lines.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-3 text-zinc-500">
                  Todavía no hay piezas que cobrar.
                </td>
              </tr>
            ) : (
              precio.lines.map((linea) => (
                <tr key={linea.line_id}>
                  <td className="py-2 pr-3 text-zinc-900">
                    {linea.product_name ?? `Línea ${linea.line_id}`}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{linea.quantity}</td>
                  <td className="py-2 pr-3 text-right font-semibold tabular-nums">
                    {formatPrecio(linea.unit_price, moneda)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatPrecio(linea.line_subtotal, moneda)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <dl className="ml-auto mt-3 grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-[13px] tabular-nums">
        <dt className="text-zinc-600">Subtotal sin IGV</dt>
        <dd className="text-right">{formatPrecio(precio.subtotal, moneda)}</dd>
        <dt className="text-zinc-600">IGV {porcentaje(precio.tax_percent)}</dt>
        <dd className="text-right">{formatPrecio(precio.tax, moneda)}</dd>
        <dt className="border-t-2 border-zinc-900 pt-1.5 font-extrabold text-zinc-950">Total</dt>
        <dd
          data-testid="v2next-precio-total"
          className="border-t-2 border-zinc-900 pt-1.5 text-right font-extrabold text-zinc-950"
        >
          {formatPrecio(precio.total, moneda)}
        </dd>
      </dl>
    </section>
  );
}

/**
 * De dónde sale cada precio unitario: lo que carga cada pieza de lo suyo y de
 * lo que es de toda la cotización. Costos en moneda base; precios, en la de la
 * cotización (el unitario sin redondear ya viene convertido).
 */
export function CostAllocationTable({
  precio,
  moneda,
}: {
  precio: V2Pricing;
  moneda: MonedaDeCotizacion;
}) {
  if (precio.lines.length === 0) {
    return <p className="text-xs text-zinc-500">Todavía no hay piezas que repartir.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[48rem] text-left text-xs">
        <caption className="pb-2 text-left text-[11.5px] text-zinc-500">
          Cada pieza carga con lo suyo más la parte que le toca de la quema, del espacio y de lo
          general. La suma de los costos asignados es el costo de producción.
        </caption>
        <thead>
          <tr className="text-zinc-500">
            <th scope="col" className="py-1.5 pr-3 font-semibold">Pieza</th>
            <th scope="col" className="py-1.5 pr-3 text-right font-semibold">Directo</th>
            <th scope="col" className="py-1.5 pr-3 text-right font-semibold">Quema</th>
            <th scope="col" className="py-1.5 pr-3 text-right font-semibold">Espacio</th>
            <th scope="col" className="py-1.5 pr-3 text-right font-semibold">Generales</th>
            <th scope="col" className="py-1.5 pr-3 text-right font-semibold">Costo asignado</th>
            <th scope="col" className="py-1.5 pr-3 text-right font-semibold">Unit. sin redondear</th>
            <th scope="col" className="py-1.5 text-right font-semibold">Unitario</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5 tabular-nums">
          {precio.lines.map((linea) => (
            <tr key={linea.line_id}>
              <td className="py-1.5 pr-3 text-zinc-900">
                {linea.product_name ?? `Línea ${linea.line_id}`}
              </td>
              <td className="py-1.5 pr-3 text-right">{formatCosto(linea.direct_cost)}</td>
              <td className="py-1.5 pr-3 text-right">{formatCosto(linea.firing_cost)}</td>
              <td className="py-1.5 pr-3 text-right">{formatCosto(linea.space_cost)}</td>
              <td className="py-1.5 pr-3 text-right">{formatCosto(linea.general_cost)}</td>
              <td className="py-1.5 pr-3 text-right">{formatCosto(linea.production_cost)}</td>
              <td className="py-1.5 pr-3 text-right text-zinc-500">
                {formatMoney(linea.unit_price_raw, moneda.currency_code, {
                  symbolSnapshot: moneda.currency_symbol ?? null,
                  decimals: 4,
                })}
              </td>
              <td className="py-1.5 text-right font-semibold">
                {formatPrecio(linea.unit_price, moneda)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
