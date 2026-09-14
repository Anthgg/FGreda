import { formatDisplayDate } from "@/components/dateFormat";
import { Spinner } from "@/components/Spinner";
import { fechaLima } from "@/features/cotizadorV2/fechaLima";
import { describirEvento } from "@/features/cotizadorV2/mensajesCicloDeVida";
import {
  useV2ConfirmationPreview,
  useV2QuotationHistory,
} from "@/features/cotizadorV2/useQuoterV2Lifecycle";
import { Panel } from "@/features/masters/MasterTable";
import { formatMoney } from "@/features/quotations/money";
import { describeError } from "@/features/settings/messages";
import type { V2Quotation } from "@/types/quoterV2";

/**
 * El documento tal como se emitió, y su historial. Fase 010H.
 *
 * Solo para cotizaciones que ya no son borrador. Enseña lo que el cliente
 * recibió —productos, medidas, unitarios redondeados, IGV, total, vigencia—
 * leído del backend, que lo sirve desde lo congelado al emitir. Si mañana sube
 * el IGV o cambia un precio del maestro, esto no se mueve.
 */
export function V2DocumentoEmitido({ cotizacion }: { cotizacion: V2Quotation }) {
  const resumen = useV2ConfirmationPreview(cotizacion.id, cotizacion.issued_at !== null);
  const historia = useV2QuotationHistory(cotizacion.id, true);
  const datos = resumen.data;
  const dinero = (valor: string) =>
    formatMoney(valor, datos?.currency_code ?? cotizacion.currency_code, {
      symbolSnapshot: datos?.currency_symbol ?? cotizacion.currency_symbol,
    });

  return (
    <Panel>
      <div data-testid="v2-documento-emitido" className="space-y-5">
        {cotizacion.issued_at !== null ? (
          <section>
            <h2 className="text-sm font-semibold text-zinc-900">Documento emitido</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Es lo que recibió el cliente. Sus valores quedaron congelados al emitir y no cambian
              aunque cambien los precios, el IGV o el tipo de cambio.
            </p>
            {resumen.isPending ? (
              <div className="py-4">
                <Spinner className="size-4" label="Cargando el documento…" />
              </div>
            ) : resumen.isError || !datos || !Array.isArray(datos.lines) ? (
              <p role="alert" className="mt-2 text-xs text-red-700">
                {describeError(resumen.error)}
              </p>
            ) : (
              <>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  <div>
                    <dt className="text-zinc-500">Cliente</dt>
                    <dd className="font-medium text-zinc-900">{datos.customer_name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Moneda</dt>
                    <dd className="font-medium text-zinc-900">
                      {datos.currency_code}
                      {datos.exchange_rate ? ` · TC ${Number(datos.exchange_rate).toFixed(3)}` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">IGV</dt>
                    <dd className="font-medium text-zinc-900">
                      {datos.tax_percent ? `${Number(datos.tax_percent)} %` : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Válida hasta</dt>
                    <dd className="font-medium text-zinc-900">
                      {formatDisplayDate(datos.valid_until)}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[36rem] text-left text-xs">
                    <thead>
                      <tr className="text-zinc-500">
                        <th className="py-1 pr-2 font-medium">Producto</th>
                        <th className="py-1 pr-2 text-right font-medium">Cant.</th>
                        <th className="py-1 pr-2 text-right font-medium">P. unitario</th>
                        <th className="py-1 pr-2 text-right font-medium">Subtotal</th>
                        <th className="py-1 pr-2 text-right font-medium">IGV</th>
                        <th className="py-1 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {datos.lines.map((linea) => (
                        <tr key={linea.id}>
                          <td className="py-1 pr-2 text-zinc-800">{linea.product_name}</td>
                          <td className="py-1 pr-2 text-right">{linea.quantity}</td>
                          <td className="py-1 pr-2 text-right">{dinero(linea.unit_price)}</td>
                          <td className="py-1 pr-2 text-right">{dinero(linea.line_subtotal)}</td>
                          <td className="py-1 pr-2 text-right">{dinero(linea.line_tax)}</td>
                          <td className="py-1 text-right font-medium">
                            {dinero(linea.line_total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-right text-sm font-semibold text-zinc-900">
                  Total: {dinero(datos.total_amount)}
                </p>
              </>
            )}
          </section>
        ) : null}

        <section>
          <h2 className="text-sm font-semibold text-zinc-900">Historial</h2>
          {historia.isPending ? (
            <Spinner className="size-4" label="Cargando historial…" />
          ) : historia.isError || !Array.isArray(historia.data) ? (
            <p role="alert" className="text-xs text-red-700">
              {describeError(historia.error)}
            </p>
          ) : (
            <ol data-testid="v2-historial" className="mt-2 space-y-1">
              {historia.data.map((evento, indice) => (
                <li key={`${evento.event}-${indice}`} className="text-xs text-zinc-700">
                  <span className="font-medium">{describirEvento(evento.event)}</span>
                  {" · "}
                  {fechaLima(evento.at)}
                  {evento.user_name ? ` · ${evento.user_name}` : ""}
                  {evento.details.new_code ? ` · ${evento.details.new_code}` : ""}
                  {evento.details.source_code ? ` · desde ${evento.details.source_code}` : ""}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </Panel>
  );
}
