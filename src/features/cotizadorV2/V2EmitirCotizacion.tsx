import { useState } from "react";

import { ApiError } from "@/api/client";
import { formatDisplayDate } from "@/components/dateFormat";
import { PrimaryButton, SecondaryButton } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { describirBloqueo } from "@/features/cotizadorV2/mensajesCicloDeVida";
import type { PasoId } from "@/features/cotizadorV2/pasos";
import { useDialogoAccesible } from "@/features/cotizadorV2/useDialogoAccesible";
import { useEstadoDeGuardado } from "@/features/cotizadorV2/useEstadoDeGuardado";
import {
  useConfirmV2Quotation,
  useV2ConfirmationPreview,
} from "@/features/cotizadorV2/useQuoterV2Lifecycle";
import { formatMoney } from "@/features/quotations/money";
import { describeError } from "@/features/settings/messages";
import type { V2ConfirmationPreview, V2PreviewLine } from "@/types/quoterV2";

/**
 * «Confirmar y emitir», al final del resumen de un borrador. Fase 010H.
 *
 * UN diálogo, sin segunda confirmación. Enseña lo que el cliente va a recibir
 * —tal como lo devuelve el backend, no recalculado aquí— y la frase que importa:
 * al confirmar, los valores comerciales quedan congelados.
 *
 * ## Lo que se confirma es lo que se vio
 *
 * El resumen trae una huella. Confirmar la devuelve, y si otra persona cambió
 * una cantidad entre medias el backend responde 409: el diálogo recarga el
 * resumen y lo dice, en vez de emitir un documento que nadie revisó.
 *
 * Mientras hay guardados pendientes el botón espera: confirmar antes de que
 * llegue el último cambio sería revisar un resumen viejo.
 */

function medidas(linea: V2PreviewLine): string {
  const partes = [linea.length_cm, linea.width_cm, linea.height_cm];
  if (partes.some((valor) => valor === null)) return "—";
  return `${partes.map((valor) => Number(valor)).join(" × ")} cm`;
}

function TablaDelDocumento({ resumen }: { resumen: V2ConfirmationPreview }) {
  const dinero = (valor: string) =>
    formatMoney(valor, resumen.currency_code, { symbolSnapshot: resumen.currency_symbol });
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-left text-xs" data-testid="emision-lineas">
        <thead>
          <tr className="text-zinc-500">
            <th className="py-1 pr-2 font-medium">Producto</th>
            <th className="py-1 pr-2 font-medium">Medidas</th>
            <th className="py-1 pr-2 text-right font-medium">Cant.</th>
            <th className="py-1 pr-2 text-right font-medium">P. unitario</th>
            <th className="py-1 pr-2 text-right font-medium">Subtotal</th>
            <th className="py-1 pr-2 text-right font-medium">IGV</th>
            <th className="py-1 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {resumen.lines.map((linea) => (
            <tr key={linea.id}>
              <td className="py-1 pr-2 text-zinc-800">
                {linea.product_name ?? "Producto"}
                {linea.client_observation ? (
                  <span className="block text-[11px] italic text-zinc-500">
                    {linea.client_observation}
                  </span>
                ) : null}
              </td>
              <td className="py-1 pr-2 text-zinc-600">{medidas(linea)}</td>
              <td className="py-1 pr-2 text-right">{linea.quantity}</td>
              <td className="py-1 pr-2 text-right font-medium">{dinero(linea.unit_price)}</td>
              <td className="py-1 pr-2 text-right">{dinero(linea.line_subtotal)}</td>
              <td className="py-1 pr-2 text-right">{dinero(linea.line_tax)}</td>
              <td className="py-1 text-right font-medium">{dinero(linea.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="mt-3 ml-auto grid max-w-xs grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <dt className="text-zinc-500">Subtotal</dt>
        <dd className="text-right">{dinero(resumen.subtotal_amount)}</dd>
        <dt className="text-zinc-500">
          IGV{resumen.tax_percent ? ` (${Number(resumen.tax_percent)} %)` : ""}
        </dt>
        <dd className="text-right">{dinero(resumen.tax_amount)}</dd>
        <dt className="font-semibold text-zinc-900">Total</dt>
        <dd data-testid="emision-total" className="text-right font-semibold text-zinc-900">
          {dinero(resumen.total_amount)}
        </dd>
      </dl>
    </div>
  );
}

export function V2EmitirCotizacion({
  quotationId,
  irAPaso,
}: {
  quotationId: number;
  irAPaso: (paso: PasoId) => void;
}) {
  const guardado = useEstadoDeGuardado(quotationId);
  const [abierto, setAbierto] = useState(false);
  const [cambio, setCambio] = useState(false);
  const resumen = useV2ConfirmationPreview(quotationId, abierto);
  const confirmar = useConfirmV2Quotation(quotationId);
  const contenedor = useDialogoAccesible<HTMLDivElement>(abierto);

  const cerrar = () => {
    setAbierto(false);
    setCambio(false);
    confirmar.reset();
  };

  const alConfirmar = (datos: V2ConfirmationPreview) => {
    setCambio(false);
    confirmar.mutate(datos.fingerprint, {
      onSuccess: () => cerrar(),
      onError: (error) => {
        // Otra persona cambió el documento: se recarga el resumen y se dice.
        if (error instanceof ApiError && error.code === "V2_QUOTATION_CHANGED") {
          setCambio(true);
          confirmar.reset();
          void resumen.refetch();
        }
      },
    });
  };

  const datos = resumen.data;

  return (
    <section
      data-testid="emitir-cotizacion"
      className="rounded-2xl border border-black/[0.08] bg-white/70 p-4"
    >
      <h3 className="text-sm font-semibold text-zinc-900">Emitir cotización</h3>
      <p className="mt-1 text-xs text-zinc-600">
        Emitir fija el documento que recibe el cliente, con su fecha y su vigencia. Después ya no
        se edita: para cambiar algo habrá que duplicarla.
      </p>
      <div className="mt-3">
        <PrimaryButton
          type="button"
          disabled={guardado.hayRiesgo || guardado.fallidos.length > 0}
          onClick={() => setAbierto(true)}
        >
          Confirmar y emitir
        </PrimaryButton>
        {guardado.hayRiesgo ? (
          <span className="ml-3 text-[11px] text-amber-700">
            Espere a que terminen de guardarse los cambios.
          </span>
        ) : null}
      </div>

      {abierto ? (
        <div
          ref={contenedor}
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar y emitir la cotización"
          onKeyDown={(evento) => {
            if (evento.key === "Escape" && !confirmar.isPending) cerrar();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-base font-bold text-zinc-900">Confirmar y emitir</h2>

            {resumen.isPending || resumen.isFetching ? (
              <div className="py-8">
                <Spinner className="size-5" label="Preparando el resumen…" />
              </div>
            ) : resumen.isError || !datos ? (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {describeError(resumen.error)}
              </p>
            ) : (
              <>
                {cambio ? (
                  <p
                    role="alert"
                    data-testid="emision-cambio"
                    className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
                  >
                    La cotización cambió mientras usted revisaba el resumen. Estos son los valores
                    actualizados: revíselos antes de confirmar.
                  </p>
                ) : null}

                <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  <div>
                    <dt className="text-zinc-500">Cliente</dt>
                    <dd className="font-medium text-zinc-900">
                      {datos.customer_name ?? "Sin cliente"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Código</dt>
                    <dd className="font-medium text-zinc-900">{datos.code}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Moneda</dt>
                    <dd className="font-medium text-zinc-900">
                      {datos.currency_code ?? "—"}
                      {datos.exchange_rate
                        ? ` · TC ${Number(datos.exchange_rate).toFixed(3)}`
                        : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Válida hasta (si se emite hoy)</dt>
                    <dd data-testid="emision-vigencia" className="font-medium text-zinc-900">
                      {datos.valid_until ? formatDisplayDate(datos.valid_until) : "—"}
                      {datos.validity_days ? ` · ${datos.validity_days} días` : ""}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4">
                  <TablaDelDocumento resumen={datos} />
                </div>

                {datos.blockers.length > 0 ? (
                  <div
                    data-testid="emision-bloqueos"
                    className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3"
                  >
                    <p className="text-xs font-semibold text-red-800">
                      No se puede emitir todavía:
                    </p>
                    <ul className="mt-1 space-y-1">
                      {datos.blockers.map((bloqueo, indice) => {
                        const pendiente = describirBloqueo(bloqueo.code);
                        return (
                          <li key={`${bloqueo.code}-${indice}`} className="text-xs text-red-700">
                            {pendiente.mensaje}{" "}
                            {pendiente.paso ? (
                              <button
                                type="button"
                                className="font-semibold underline underline-offset-2"
                                onClick={() => {
                                  cerrar();
                                  if (pendiente.paso) irAPaso(pendiente.paso);
                                }}
                              >
                                Ir a corregirlo
                              </button>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <p
                    data-testid="emision-aviso-congelado"
                    className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs font-medium text-sky-900"
                  >
                    Al confirmar, los valores comerciales quedarán congelados.
                  </p>
                )}

                {confirmar.error ? (
                  <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">
                    {describeError(confirmar.error)}
                  </p>
                ) : null}
              </>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <SecondaryButton disabled={confirmar.isPending} onClick={cerrar}>
                Volver
              </SecondaryButton>
              <PrimaryButton
                type="button"
                disabled={
                  !datos ||
                  !datos.can_confirm ||
                  confirmar.isPending ||
                  resumen.isFetching
                }
                onClick={() => {
                  if (datos) alConfirmar(datos);
                }}
              >
                {confirmar.isPending ? "Emitiendo…" : "Confirmar y emitir"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
