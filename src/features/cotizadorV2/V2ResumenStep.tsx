import { useState } from "react";
import { formatMoney } from "@/utils/formatters";
import { fetchQuotationPdf } from "@/api/quotations";
import { PrimaryButton } from "@/components/form";

import { TableWrapper, Th, Td } from "@/features/cotizadorV2/components/V2Table";
import {
  esMonedaExtranjera,
  PASOS,
  type DatosDelFlujo,
  type EstadoPaso,
  type PasoId,
} from "@/features/cotizadorV2/pasos";
import { V2_PRODUCTION_TYPE_LABEL } from "@/types/quoterV2";
import { CUSTOMER_KIND_LABEL } from "@/types/quoterV2Firing";

const TITULO: Record<PasoId, string> = Object.fromEntries(
  PASOS.map((paso) => [paso.id, paso.titulo]),
) as Record<PasoId, string>;

function Cifra({
  label,
  value,
  hint,
  tone,
  grande,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  tone?: "negativo" | "positivo" | undefined;
  grande?: boolean | undefined;
}) {
  const color = tone === "negativo" 
    ? "text-red-600" 
    : tone === "positivo" 
      ? "text-emerald-700" 
      : "text-zinc-900";
      
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd
        className={[
          grande ? "text-xl font-bold" : "text-sm font-semibold",
          color,
          "mt-1"
        ].join(" ")}
      >
        {value}
      </dd>
      {hint ? <dd className="text-[10px] font-medium text-zinc-400 mt-1">{hint}</dd> : null}
    </div>
  );
}

export function V2ResumenStep({
  datos,
  estados,
  irAPaso,
}: {
  datos: DatosDelFlujo;
  estados: readonly EstadoPaso[];
  irAPaso: (paso: PasoId) => void;
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownloadPdf = async () => {
    if (!datos.cotizacion?.id) return;
    try {
      setIsDownloading(true);
      setDownloadError(null);
      const result = await fetchQuotationPdf(datos.cotizacion.id);
      const blobUrl = URL.createObjectURL(result.blob);
      const name = result.filename ?? `cotizacion-${datos.cotizacion.id}.pdf`;
      
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    } catch {
      setDownloadError("No se pudo descargar el PDF. Intente nuevamente.");
    } finally {
      setIsDownloading(false);
    }
  };

  const { cotizacion, productos, manoDeObra, quema, precio } = datos;
  const dinero = (valor: string | null | undefined) => formatMoney(valor);

  const pendientes = estados.filter((estado) => estado.id !== "resumen" && !estado.completo);
  const senales = estados.flatMap((estado) =>
    estado.senales
      .filter((senal) => senal.severidad !== "error")
      .map((senal) => ({ ...senal, paso: estado.id })),
  );

  const perdida = precio?.warnings.includes("V2_PRICING_SELLING_BELOW_REAL_COST") ?? false;

  return (
    <div data-testid="paso-resumen" className="space-y-6">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-black/10 pb-4">
        <div>
           <h2 className="text-xl font-bold text-zinc-900">Resumen Oficial</h2>
           <p className="mt-1 text-sm text-zinc-500">
             Documento de revisión interno. 100% Read-Only.
           </p>
        </div>
        {pendientes.length === 0 ? (
          <div className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-200">
            LISTO PARA EMITIR
          </div>
        ) : (
          <div className="bg-amber-50 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-full border border-amber-200">
            INCOMPLETO
          </div>
        )}
      </div>

      {/* ALERTAS BLOQUEANTES */}
      {pendientes.length > 0 && (
        <section
          data-testid="resumen-pendientes"
          className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-xs"
        >
          <div className="flex gap-3">
             <svg className="w-5 h-5 text-red-600 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
             <div>
                <h3 className="text-sm font-bold text-red-900">Falta esto para poder emitir</h3>
                <ul className="mt-3 space-y-2">
                  {pendientes.map((estado) => (
                    <li key={estado.id} className="text-xs text-red-800 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1 shrink-0"></span>
                      <div>
                        <button
                          type="button"
                          onClick={() => irAPaso(estado.id)}
                          className="font-bold underline underline-offset-2 hover:text-red-900 transition-colors mr-1"
                        >
                          {TITULO[estado.id]}
                        </button>
                        — {estado.senales
                          .filter((senal) => senal.severidad === "error")
                          .map((senal) => senal.mensaje)
                          .join(" ")}
                      </div>
                    </li>
                  ))}
                </ul>
             </div>
          </div>
        </section>
      )}

      <div className="flex flex-col items-end gap-2 mt-4 mb-4">
        {downloadError && (
          <p className="text-sm font-medium text-red-600">{downloadError}</p>
        )}
        <PrimaryButton
          type="button"
          onClick={handleDownloadPdf}
          disabled={isDownloading}
          className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto"
        >
          {isDownloading ? (
            <svg className="size-4 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
          {isDownloading ? "Generando..." : "Descargar PDF"}
        </PrimaryButton>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* COLUMNA IZQ: CLIENTE & QUEMA */}
         <div className="lg:col-span-1 space-y-6">
            
            <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-xs">
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider mb-4 border-b border-black/5 pb-2">Datos del Cliente</h3>
              <dl className="grid grid-cols-1 gap-4">
                <Cifra label="Cliente" value={cotizacion?.customer_name ?? "Sin cliente"} />
                <Cifra label="Código de Proyecto" value={cotizacion?.code ?? "—"} />
                <Cifra
                  label="Tipo de producción"
                  value={cotizacion ? V2_PRODUCTION_TYPE_LABEL[cotizacion.production_type] : "—"}
                />
                <Cifra
                  label="Tipo de cliente"
                  value={cotizacion?.customer_kind ? CUSTOMER_KIND_LABEL[cotizacion.customer_kind] : "—"}
                />
              </dl>
              {cotizacion && esMonedaExtranjera(cotizacion.currency_code) ? (
                <div className="mt-4 p-3 bg-zinc-50 rounded-xl border border-black/5 text-[11px] text-zinc-600">
                  Emitida en <strong className="text-zinc-900">{cotizacion.currency_code}</strong> con un tipo de cambio de{" "}
                  <strong className="text-zinc-900">{cotizacion.exchange_rate ?? "—"}</strong>, congelado.
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-xs">
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider mb-4 border-b border-black/5 pb-2">Parámetros de Quema</h3>
              <dl className="grid grid-cols-2 gap-4">
                <Cifra label="Horno" value={quema?.kiln_name ?? "Sin horno"} />
                <Cifra label="Hornadas" value={String(quema?.firing_count ?? 0)} />
                <Cifra
                  label="Ocupación"
                  value={quema ? `${Number(quema.occupancy_percent).toFixed(1)} %` : "—"}
                />
                <Cifra
                  label="Total Piezas"
                  value={String(
                    (productos?.items ?? []).reduce((suma, linea) => suma + linea.quantity, 0),
                  )}
                />
              </dl>
            </section>
         </div>

         {/* COLUMNA DER: COSTOS & PRECIO FINAL */}
         <div className="lg:col-span-2 space-y-6">
            
            <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-xs">
              <h3 className="text-xs font-bold text-emerald-900 uppercase tracking-wider mb-5 border-b border-emerald-900/10 pb-2">Estructura de Precio</h3>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-6 mb-6">
                <Cifra label="Costo de Producción" value={dinero(precio?.production_cost)} />
                <Cifra label="Factor Comercial" value={precio?.commercial_factor ? `×${Number(precio.commercial_factor).toFixed(2)}` : "—"} />
                <Cifra 
                  label={perdida ? "Ganancia Est. (Pérdida)" : "Ganancia Neta Est."} 
                  value={dinero(precio?.estimated_profit)} 
                  tone={perdida ? "negativo" : "positivo"}
                  hint={`Margen efectivo ${Number(precio?.effective_margin_percent ?? 0).toFixed(2)} %`}
                />
              </dl>
              
              <div className="bg-white rounded-xl p-5 border border-emerald-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                 <dl className="flex gap-8 w-full sm:w-auto">
                   <Cifra label="Subtotal" value={dinero(precio?.subtotal)} grande />
                   <Cifra label={`IGV (${precio?.tax_percent ?? "0"}%)`} value={dinero(precio?.tax)} grande />
                 </dl>
                 <div className="text-right w-full sm:w-auto border-t sm:border-t-0 sm:border-l border-emerald-100 pt-4 sm:pt-0 sm:pl-6">
                    <span className="block text-[11px] font-bold uppercase tracking-widest text-emerald-600 mb-1">Total a Cobrar</span>
                    <span className="text-4xl font-black text-emerald-900 tracking-tight">{dinero(precio?.total)}</span>
                 </div>
              </div>

              {perdida && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-medium text-center">
                  ⚠️ Atención: Este precio está por debajo del costo real. La cotización generará pérdidas.
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-xs">
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider mb-5 border-b border-black/5 pb-2">Desglose del Costo Total</h3>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                <Cifra label="Materiales" value={dinero(precio?.materials_cost)} />
                <Cifra label="Mano de Obra" value={dinero(precio?.labor_cost)} />
                <Cifra label="Quema (Comercial)" value={dinero(precio?.firing_commercial_cost)} />
                <Cifra label="Gas Real" value={dinero(precio?.gas_cost)} />
                <Cifra label="Servicios/Espacio" value={dinero(precio?.space_cost)} hint={`${manoDeObra?.effective_work_days ?? 0} días`} />
                <Cifra label="Administrativos" value={dinero(precio?.administration_cost)} />
                <Cifra label="Ilustración" value={dinero(precio?.illustration_cost)} />
                <Cifra label="Dif. Quema" value={dinero(precio?.firing_difference)} hint="Tarifa - Gas" />
              </dl>
            </section>
            
         </div>
      </div>

      {/* TABLA DE PRODUCTOS */}
      <section className="rounded-2xl border border-black/10 bg-white overflow-hidden shadow-xs mt-2">
        <div className="p-5 border-b border-black/5">
          <h3 className="text-sm font-bold text-zinc-900">Detalle de Emisión por Producto</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Valores unitarios y totales finales calculados para el cliente.
          </p>
        </div>
        <div className="overflow-x-auto">
          <TableWrapper>
            <thead className="bg-zinc-50 text-xs text-zinc-500 border-b border-black/5">
              <tr>
                <Th>Producto</Th>
                <Th align="right">Cant.</Th>
                <Th align="right">Costo Unit.</Th>
                <Th align="right" className="font-semibold text-emerald-700">Precio Unit.</Th>
                <Th align="right">Subtotal Línea</Th>
                <Th align="right" className="font-semibold text-zinc-900">Total Línea</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 bg-white">
              {(precio?.lines ?? []).map((linea) => (
                <tr key={linea.line_id} className="hover:bg-zinc-50/50">
                  <Td className="font-medium text-zinc-900">
                    {linea.product_name ?? `Línea ${linea.line_id}`}
                  </Td>
                  <Td align="right">{linea.quantity}</Td>
                  <Td align="right">{dinero(linea.production_cost)}</Td>
                  <Td align="right" className="font-bold text-emerald-700">
                    {dinero(linea.unit_price)}
                  </Td>
                  <Td align="right">{dinero(linea.line_subtotal)}</Td>
                  <Td align="right" className="font-bold text-zinc-900">{dinero(linea.line_total)}</Td>
                </tr>
              ))}
              {(precio?.lines ?? []).length === 0 ? (
                <tr>
                  <Td colSpan={6} className="py-8 text-center text-zinc-500">
                    Todavía no hay productos agregados en la cotización.
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </TableWrapper>
        </div>
      </section>

      {senales.length > 0 && (
        <section
          data-testid="resumen-senales"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-xs"
        >
          <div className="flex gap-3">
             <svg className="w-5 h-5 text-amber-600 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" /></svg>
             <div>
                <h3 className="text-sm font-bold text-amber-900">Recomendaciones (Opcional)</h3>
                <ul className="mt-2 space-y-2">
                  {senales.map((senal, indice) => (
                    <li key={`${senal.paso}-${indice}`} className="text-xs text-amber-800 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1 shrink-0"></span>
                      <div>
                        <button
                          type="button"
                          onClick={() => irAPaso(senal.paso)}
                          className="font-bold underline underline-offset-2 hover:text-amber-900 transition-colors mr-1"
                        >
                          {TITULO[senal.paso]}
                        </button>
                        — {senal.mensaje}
                      </div>
                    </li>
                  ))}
                </ul>
             </div>
          </div>
        </section>
      )}
    </div>
  );
}
