import type { ReactNode } from "react";

import { formatPrecio } from "@/features/cotizadorV2/moneda";
import { porcentaje } from "@/features/cotizadorV2Next/steps/pricing/formato";
import type { V2ConfirmationPreview, V2PreviewLine } from "@/types/quoterV2";

/**
 * El documento que recibe el cliente, tal como lo devuelve el backend. 010O.11.
 *
 * Pinta un `V2ConfirmationPreview` y nada más: producto, medidas, cantidad,
 * unitario, importe, subtotal, IGV y total, con las condiciones. Ni un costo
 * interno, ni un factor, ni una suma hecha aquí —el subtotal es el del backend,
 * reconstruido desde las líneas ya redondeadas—.
 *
 * Sirve para el borrador (lo que se emitiría hoy) y para la emitida (lo que se
 * congeló): el backend contesta con una u otra cosa, este componente no decide.
 */

function medidas(linea: V2PreviewLine): string {
  const partes = [linea.length_cm, linea.width_cm, linea.height_cm];
  if (partes.some((valor) => valor === null)) return "—";
  return `${partes.map((valor) => Number(valor)).join(" × ")} cm`;
}

export function DocumentoDelCliente({
  resumen,
  subtitulo,
}: {
  resumen: V2ConfirmationPreview;
  /** Lo que se dice bajo el código: la vigencia proyectada o la fecha de emisión. */
  subtitulo: ReactNode;
}) {
  const moneda = { currency_code: resumen.currency_code, currency_symbol: resumen.currency_symbol };
  const contacto = [
    resumen.customer_document,
    resumen.customer_address,
    resumen.customer_email,
    resumen.customer_phone,
  ].filter(Boolean);

  return (
    <article
      aria-label="Documento para el cliente"
      data-testid="v2next-documento"
      className="rounded-xl border border-black/[0.08] bg-white/85 p-5 sm:p-6"
    >
      <header className="mb-4 flex flex-wrap justify-between gap-4 border-b-2 border-zinc-900 pb-4">
        <div>
          <h3 className="text-lg font-bold text-zinc-950">Cotización</h3>
          <p className="text-xs text-zinc-500 tabular-nums">{resumen.code}</p>
          <p className="text-xs text-zinc-500">{subtitulo}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="font-semibold text-zinc-950">
            {resumen.customer_name ?? "Cliente por definir"}
          </p>
          {contacto.map((dato) => (
            <p key={dato} className="text-xs text-zinc-500">
              {dato}
            </p>
          ))}
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-left text-[13px]">
          <thead>
            <tr className="text-xs text-zinc-500">
              <th scope="col" className="py-2 pr-3 font-semibold">Descripción</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Medidas</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">Cant.</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">Precio c/u</th>
              <th scope="col" className="py-2 text-right font-semibold">Importe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 tabular-nums">
            {resumen.lines.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-3 text-zinc-500">
                  Sin piezas
                </td>
              </tr>
            ) : (
              resumen.lines.map((linea) => (
                <tr key={linea.id}>
                  <td className="py-2 pr-3 text-zinc-900">
                    {linea.product_name ?? "Pieza"}
                    {linea.client_observation ? (
                      <span className="block text-xs text-zinc-500">{linea.client_observation}</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 text-zinc-600">{medidas(linea)}</td>
                  <td className="py-2 pr-3 text-right">{linea.quantity}</td>
                  <td className="py-2 pr-3 text-right">{formatPrecio(linea.unit_price, moneda)}</td>
                  <td className="py-2 text-right">{formatPrecio(linea.line_subtotal, moneda)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <dl className="ml-auto mt-4 grid w-full max-w-[280px] grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-[13px] tabular-nums">
        <dt className="text-zinc-600">Subtotal</dt>
        <dd className="text-right">{formatPrecio(resumen.subtotal_amount, moneda)}</dd>
        <dt className="text-zinc-600">IGV {porcentaje(resumen.tax_percent)}</dt>
        <dd className="text-right">{formatPrecio(resumen.tax_amount, moneda)}</dd>
        <dt className="border-t-2 border-zinc-900 pt-2 text-base font-extrabold text-zinc-950">
          Total
        </dt>
        <dd
          data-testid="v2next-documento-total"
          className="border-t-2 border-zinc-900 pt-2 text-right text-base font-extrabold text-zinc-950"
        >
          {formatPrecio(resumen.total_amount, moneda)}
        </dd>
      </dl>

      {resumen.exchange_rate ? (
        <p className="mt-3 text-right text-xs text-zinc-500">
          Tipo de cambio congelado: {resumen.exchange_rate}
        </p>
      ) : null}

      {resumen.client_notes || resumen.conditions || resumen.payment_notes ? (
        <div className="mt-5 space-y-2 whitespace-pre-line border-t border-black/[0.06] pt-4 text-[13px] text-zinc-700">
          {resumen.client_notes ? <p>{resumen.client_notes}</p> : null}
          {resumen.conditions ? (
            <p>
              <span className="font-semibold text-zinc-900">Condiciones: </span>
              {resumen.conditions}
            </p>
          ) : null}
          {resumen.payment_notes ? (
            <p>
              <span className="font-semibold text-zinc-900">Pago: </span>
              {resumen.payment_notes}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
