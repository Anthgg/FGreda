import { useId, useState } from "react";
import { createPortal } from "react-dom";
import type { UseQueryResult } from "@tanstack/react-query";

import { ApiError } from "@/api/client";
import { PrimaryButton, SecondaryButton } from "@/components/form";
import { formatDisplayDate } from "@/components/dateFormat";
import { formatPrecio } from "@/features/cotizadorV2/moneda";
import { useDialogoAccesible } from "@/features/cotizadorV2/useDialogoAccesible";
import { useEstadoDeGuardado } from "@/features/cotizadorV2/useEstadoDeGuardado";
import { useConfirmV2Quotation } from "@/features/cotizadorV2/useQuoterV2Lifecycle";
import { describeError } from "@/features/settings/messages";
import type { V2ConfirmationPreview } from "@/types/quoterV2";

/**
 * Emitir: congelar lo que se está viendo. Fase 010O.11.
 *
 * ## Se confirma lo que se vio
 *
 * El resumen de emisión trae una HUELLA de su contenido, y confirmar la
 * devuelve. Si entre medias cambió algo —otra persona, u otro guardado de
 * esta misma pestaña— el backend responde 409 `V2_QUOTATION_CHANGED` en vez de
 * emitir un documento que nadie revisó. Entonces se vuelve a pedir el resumen
 * y se dice, arriba y con palabras.
 *
 * ## No se emite un resumen viejo
 *
 * El botón espera mientras haya guardados en vuelo, cambios tecleados sin
 * salir del campo o guardados rechazados, y mientras el resumen se esté
 * volviendo a pedir (lo invalida cada guardado). Además, emitir comparte la
 * fila de escrituras de la cotización: si aun así hubiera una escritura
 * delante, la emisión espera a que termine y la huella decide.
 *
 * Un solo diálogo de confirmación, corto: el documento ya está a la vista. Va
 * por un portal al <body>: el paso vive dentro de un `.glass-panel`, cuyo
 * `backdrop-filter` convertiría en su bloque contenedor a cualquier `fixed`
 * y el velo cubriría solo el panel, no la ventana.
 */
export function EmitirCotizacion({
  quotationId,
  resumen,
}: {
  quotationId: number;
  resumen: UseQueryResult<V2ConfirmationPreview>;
}) {
  const guardado = useEstadoDeGuardado(quotationId);
  const confirmar = useConfirmV2Quotation(quotationId);
  const [abierto, setAbierto] = useState(false);
  const [cambio, setCambio] = useState(false);
  const contenedor = useDialogoAccesible<HTMLDivElement>(abierto);
  const titulo = useId();

  const datos = resumen.data;
  const bloqueos = datos?.blockers.length ?? 0;
  const guardando = guardado.hayRiesgo;
  const puedeEmitir =
    datos !== undefined && datos.can_confirm && !guardando && !resumen.isFetching;

  const cerrar = () => {
    if (confirmar.isPending) return;
    setAbierto(false);
    confirmar.reset();
  };

  const emitir = () => {
    if (!datos) return;
    setCambio(false);
    confirmar.mutate(datos.fingerprint, {
      onSuccess: () => setAbierto(false),
      onError: (error) => {
        if (error instanceof ApiError && error.code === "V2_QUOTATION_CHANGED") {
          setAbierto(false);
          setCambio(true);
          confirmar.reset();
          void resumen.refetch();
        }
      },
    });
  };

  const estado = !datos
    ? "Preparando el resumen…"
    : bloqueos > 0
      ? bloqueos === 1
        ? "Completa 1 dato para poder emitir."
        : `Completa ${bloqueos} datos para poder emitir.`
      : guardado.fallidos.length > 0
        ? "Hay cambios que no se guardaron: resuélvalos antes de emitir."
        : guardando
          ? "Espere a que terminen de guardarse los cambios."
          : resumen.isFetching
            ? "Actualizando el resumen…"
            : "Después ya no se edita.";

  return (
    <div data-testid="v2next-emitir" className="space-y-3">
      {cambio ? (
        <p
          role="alert"
          data-testid="v2next-emision-cambio"
          className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
        >
          La cotización cambió mientras usted la revisaba. El documento de arriba ya tiene los
          valores actualizados: revíselos antes de emitir.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <PrimaryButton type="button" disabled={!puedeEmitir} onClick={() => setAbierto(true)}>
          Emitir cotización
        </PrimaryButton>
        <span
          role="status"
          className={`text-[13px] ${bloqueos > 0 ? "text-red-700" : "text-zinc-600"}`}
        >
          {estado}
        </span>
      </div>

      {confirmar.error && !cambio && !abierto ? (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">
          {describeError(confirmar.error)}
        </p>
      ) : null}

      {abierto && datos
        ? createPortal(
            <div
              ref={contenedor}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titulo}
              onKeyDown={(evento) => {
                if (evento.key === "Escape") cerrar();
              }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4"
            >
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                <h2 id={titulo} className="text-base font-bold text-zinc-950">
                  ¿Emitir la cotización?
                </h2>
                <p className="mt-2 text-sm text-zinc-600">
                  Se emite por{" "}
                  <strong className="tabular-nums text-zinc-950">
                    {formatPrecio(datos.total_amount, {
                      currency_code: datos.currency_code,
                      currency_symbol: datos.currency_symbol,
                    })}
                  </strong>
                  {datos.valid_until ? (
                    <>
                      {" "}
                      y queda válida hasta el <strong>{formatDisplayDate(datos.valid_until)}</strong>
                    </>
                  ) : null}
                  . Al confirmar, los valores comerciales quedan congelados y ya no se edita.
                </p>
                {confirmar.error ? (
                  <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">
                    {describeError(confirmar.error)}
                  </p>
                ) : null}
                <div className="mt-5 flex justify-end gap-2">
                  <SecondaryButton type="button" disabled={confirmar.isPending} onClick={cerrar}>
                    Volver
                  </SecondaryButton>
                  <PrimaryButton type="button" disabled={confirmar.isPending} onClick={emitir}>
                    {confirmar.isPending ? "Emitiendo…" : "Confirmar y emitir"}
                  </PrimaryButton>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
