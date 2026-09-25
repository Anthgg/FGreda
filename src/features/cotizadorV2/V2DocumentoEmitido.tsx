import { formatDisplayDate } from "@/components/dateFormat";
import { Spinner } from "@/components/Spinner";
import { fechaLima } from "@/features/cotizadorV2/fechaLima";
import { describirEvento } from "@/features/cotizadorV2/mensajesCicloDeVida";
import { formatPrecio } from "@/features/cotizadorV2/moneda";
import {
  useV2ConfirmationPreview,
  useV2QuotationHistory,
} from "@/features/cotizadorV2/useQuoterV2Lifecycle";
import { DocumentoDelCliente } from "@/features/cotizadorV2Next/steps/review/DocumentoDelCliente";
import { Panel } from "@/features/masters/MasterTable";
import { describeError } from "@/features/settings/messages";
import type { V2Quotation } from "@/types/quoterV2";

/**
 * El documento tal como se emitió, y su historial. Fase 010H; rediseño 010O.12.
 *
 * Solo para cotizaciones que ya no son borrador. Enseña lo que el cliente
 * recibió —productos, medidas, unitarios redondeados, IGV, total, vigencia—
 * leído del backend, que lo sirve desde lo congelado al emitir. Si mañana sube
 * el IGV o cambia un precio del maestro, esto no se mueve: aquí no se
 * recalcula nada, y el documento es el mismo `DocumentoDelCliente` que se
 * revisó antes de emitir.
 *
 * Una cotización anulada sin haberse emitido no tiene documento: solo historial.
 */
export function V2DocumentoEmitido({ cotizacion }: { cotizacion: V2Quotation }) {
  const emitida = cotizacion.issued_at !== null;
  const resumen = useV2ConfirmationPreview(cotizacion.id, emitida);
  const historia = useV2QuotationHistory(cotizacion.id, true);
  const datos = resumen.data;

  const emision = [
    cotizacion.issued_at ? `Emitida el ${fechaLima(cotizacion.issued_at)}` : null,
    cotizacion.issued_by_name ? `por ${cotizacion.issued_by_name}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const vigencia = cotizacion.valid_until
    ? `Válida hasta el ${formatDisplayDate(cotizacion.valid_until)}`
    : null;

  return (
    <Panel>
      <div data-testid="v2-documento-emitido" className="space-y-6">
        {emitida ? (
          <section className="space-y-3">
            <div>
              <h2 className="text-base font-bold text-zinc-950">Documento emitido</h2>
              <p className="mt-1 max-w-[64ch] text-[13px] text-zinc-600">
                Es lo que recibió el cliente. Sus valores quedaron congelados al emitir y no cambian
                aunque cambien los precios, el IGV o el tipo de cambio.
              </p>
            </div>
            {resumen.isPending ? (
              <Spinner className="size-4" label="Cargando el documento…" />
            ) : resumen.isError || !datos || !Array.isArray(datos.lines) ? (
              <p role="alert" className="text-xs text-red-700">
                {describeError(resumen.error)}
              </p>
            ) : (
              <>
                <p className="text-[13px] text-zinc-700 tabular-nums">
                  <span className="font-semibold text-zinc-950">
                    Total: {formatPrecio(datos.total_amount, datos)}
                  </span>
                  {datos.exchange_rate ? ` · TC ${Number(datos.exchange_rate).toFixed(3)}` : ""}
                  {vigencia ? ` · ${vigencia}` : ""}
                </p>
                <DocumentoDelCliente
                  resumen={datos}
                  subtitulo={[emision, vigencia].filter(Boolean).join(" · ")}
                />
              </>
            )}
          </section>
        ) : null}

        <section>
          <h2 className="text-sm font-bold text-zinc-950">Historial</h2>
          {historia.isPending ? (
            <Spinner className="size-4" label="Cargando historial…" />
          ) : historia.isError || !Array.isArray(historia.data) ? (
            <p role="alert" className="text-xs text-red-700">
              {describeError(historia.error)}
            </p>
          ) : (
            <ol data-testid="v2-historial" className="mt-2 space-y-1.5 border-l-2 border-black/[0.08] pl-4">
              {historia.data.map((evento, indice) => (
                <li key={`${evento.event}-${indice}`} className="text-xs text-zinc-700">
                  <span className="font-semibold text-zinc-900">{describirEvento(evento.event)}</span>
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
