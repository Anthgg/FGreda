import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { fetchV2QuotationPdf } from "@/api/quoterV2";
import { formatDisplayDate } from "@/components/dateFormat";
import { PrimaryButton, SecondaryButton, TextAreaField } from "@/components/form";
import { fechaLima } from "@/features/cotizadorV2/fechaLima";
import { describirAvisoDeDuplicacion } from "@/features/cotizadorV2/mensajesCicloDeVida";
import { useDialogoAccesible } from "@/features/cotizadorV2/useDialogoAccesible";
import {
  useCancelV2Quotation,
  useDuplicateV2Quotation,
  useSendV2ToProduction,
} from "@/features/cotizadorV2/useQuoterV2Lifecycle";
import { describeError } from "@/features/settings/messages";
import {
  V2_EFFECTIVE_STATUS_LABEL,
  type V2DuplicateWarning,
  type V2EffectiveStatus,
  type V2Quotation,
} from "@/types/quoterV2";

/**
 * El estado comercial de la cotización y lo que se puede hacer con ella. Fase 010H.
 *
 * Va en la cabecera de la ficha, visible en todos los pasos. Todo lo que decide
 * —si venció, si se puede duplicar, si ya pasó a producción— llega resuelto del
 * backend en `effective_status`: el navegador no compara fechas con su reloj.
 *
 * ## Palabras antes que colores
 *
 * El estado se escribe siempre. Una vencida lleva además una banda con el texto
 * «COTIZACIÓN VENCIDA» y la fecha: impresa en blanco y negro, o vista por quien
 * no distingue el ámbar, tiene que seguir leyéndose vencida.
 *
 * ## Duplicar no es reabrir
 *
 * El botón dice «Duplicar y actualizar precios» porque eso es lo que pasa: nace
 * OTRA cotización, con otro código y con los precios, el tipo de cambio, el IGV
 * y la vigencia de hoy. La original no se toca.
 */

const TONO: Record<V2EffectiveStatus, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700 ring-zinc-300",
  CONFIRMED: "bg-emerald-50 text-emerald-800 ring-emerald-300",
  EXPIRED: "bg-amber-50 text-amber-900 ring-amber-400",
  READY_FOR_PRODUCTION: "bg-sky-50 text-sky-900 ring-sky-300",
  CANCELLED: "bg-red-50 text-red-800 ring-red-300",
};

const SIMBOLO: Record<V2EffectiveStatus, string> = {
  DRAFT: "✎",
  CONFIRMED: "✓",
  EXPIRED: "⏱",
  READY_FOR_PRODUCTION: "⚙",
  CANCELLED: "✕",
};

export function EstadoV2({ estado }: { estado: V2EffectiveStatus | undefined }) {
  // Un backend anterior a 010H no manda el estado efectivo. Se dice que no se
  // conoce, con palabras, en vez de pintar un distintivo vacío.
  if (!estado || !(estado in V2_EFFECTIVE_STATUS_LABEL)) {
    return (
      <span
        data-testid="v2-estado-efectivo"
        className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-300"
      >
        Estado no disponible
      </span>
    );
  }
  return (
    <span
      data-testid="v2-estado-efectivo"
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${TONO[estado]}`}
    >
      <span aria-hidden="true">{SIMBOLO[estado]}</span>
      {V2_EFFECTIVE_STATUS_LABEL[estado]}
    </span>
  );
}

function Dialogo({
  titulo,
  children,
  onCerrar,
}: {
  titulo: string;
  children: React.ReactNode;
  onCerrar: () => void;
}) {
  const contenedor = useDialogoAccesible<HTMLDivElement>(true);
  return (
    <div
      ref={contenedor}
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onKeyDown={(evento) => {
        if (evento.key === "Escape") onCerrar();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-base font-bold text-zinc-900">{titulo}</h2>
        {children}
      </div>
    </div>
  );
}

/** Descarga el PDF que genera el backend. Sin sesión en un enlace suelto no saldría. */
function useDescargaPdf(id: number) {
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const descargar = async () => {
    setDescargando(true);
    setError(null);
    try {
      const { blob, filename } = await fetchV2QuotationPdf(id);
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = filename ?? `cotizacion-${id}.pdf`;
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      // El navegador ya tomó el archivo: el blob no tiene por qué quedarse en memoria.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (fallo) {
      setError(fallo);
    } finally {
      setDescargando(false);
    }
  };
  return { descargar, descargando, error };
}

export function V2CicloDeVida({
  cotizacion,
  avisosDeDuplicacion,
  duplicacionCreada = true,
}: {
  cotizacion: V2Quotation;
  /** Lo que la duplicación no pudo traer, cuando se acaba de llegar desde ella. */
  avisosDeDuplicacion?: readonly V2DuplicateWarning[] | undefined;
  /** Falso cuando el backend devolvió el borrador que YA estaba abierto. */
  duplicacionCreada?: boolean | undefined;
}) {
  const navigate = useNavigate();
  // Sin estado efectivo (backend anterior a 010H) se cae al persistido, que
  // nunca dice «vencida»: ofrecer menos acciones es preferible a inventar una.
  const estado: V2EffectiveStatus = cotizacion.effective_status ?? cotizacion.status;
  const pdf = useDescargaPdf(cotizacion.id);
  const anular = useCancelV2Quotation(cotizacion.id);
  const duplicar = useDuplicateV2Quotation(cotizacion.id);
  const enviar = useSendV2ToProduction(cotizacion.id);
  const [dialogo, setDialogo] = useState<"anular" | "produccion" | null>(null);
  const [motivo, setMotivo] = useState("");

  const emitida = cotizacion.issued_at !== null;
  const puedeDuplicar = estado === "EXPIRED" || estado === "CANCELLED";
  const puedeAnular = estado === "DRAFT" || estado === "CONFIRMED" || estado === "EXPIRED";

  const alDuplicar = () =>
    duplicar.mutate(undefined, {
      onSuccess: (resultado) =>
        navigate(`/cotizador-v2/${resultado.quotation.id}`, {
          state: {
            avisosDeDuplicacion: resultado.warnings,
            duplicacionCreada: resultado.created,
            duplicadaDe: cotizacion.code,
          },
        }),
    });

  const error = pdf.error ?? duplicar.error ?? null;

  return (
    <section data-testid="v2-ciclo-de-vida" className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <EstadoV2 estado={estado} />
        {cotizacion.valid_until ? (
          <span data-testid="v2-valida-hasta" className="text-sm text-zinc-700">
            Válida hasta: <strong>{formatDisplayDate(cotizacion.valid_until)}</strong>
          </span>
        ) : null}
        {cotizacion.issued_at ? (
          <span className="text-xs text-zinc-500">
            Emitida el {fechaLima(cotizacion.issued_at)}
            {cotizacion.issued_by_name ? ` por ${cotizacion.issued_by_name}` : ""}
          </span>
        ) : null}
      </div>

      {estado === "EXPIRED" ? (
        <div
          data-testid="v2-banda-vencida"
          role="status"
          className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-950"
        >
          <p className="text-sm font-extrabold tracking-wide">COTIZACIÓN VENCIDA</p>
          <p className="mt-1 text-xs">
            Su vigencia terminó el {formatDisplayDate(cotizacion.valid_until)}. Sus precios ya no
            pueden aceptarse. Para ofrecerla otra vez, duplíquela: la nueva se calcula con los
            precios, el tipo de cambio, el IGV y la vigencia de hoy. Esta se conserva tal cual.
          </p>
        </div>
      ) : null}

      {estado === "CANCELLED" ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <strong>Cotización anulada</strong>
          {cotizacion.cancelled_at ? ` el ${fechaLima(cotizacion.cancelled_at)}` : ""}
          {cotizacion.cancelled_by_name ? ` por ${cotizacion.cancelled_by_name}` : ""}.
          {cotizacion.cancel_reason ? ` Motivo: ${cotizacion.cancel_reason}` : ""}
        </p>
      ) : null}

      {estado === "READY_FOR_PRODUCTION" && cotizacion.production_handoff ? (
        <p
          data-testid="v2-lista-produccion"
          className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900"
        >
          <strong>Lista para producción</strong> desde el{" "}
          {fechaLima(cotizacion.production_handoff.created_at)}
          {cotizacion.production_handoff.created_by_name
            ? ` (por ${cotizacion.production_handoff.created_by_name})`
            : ""}
          . El seguimiento de la producción llega en la siguiente fase; no se descontó inventario.
        </p>
      ) : null}

      {avisosDeDuplicacion ? (
        <div
          data-testid="v2-avisos-duplicacion"
          role="status"
          className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-900"
        >
          <p className="font-semibold">
            {duplicacionCreada
              ? "Cotización nueva creada a partir de una anterior."
              : "Ya había un borrador duplicado de esa cotización: se abrió ese en lugar de crear otro."}
          </p>
          <p className="mt-1">
            Precios, tipo de cambio, IGV, tarifas y vigencia se recalcularon con la configuración de
            hoy al duplicar. La cotización original no cambió.
          </p>
          {avisosDeDuplicacion.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {avisosDeDuplicacion.map((aviso, indice) => (
                <li key={`${aviso.code}-${indice}`}>
                  {describirAvisoDeDuplicacion(aviso.code, aviso.name)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {emitida ? (
          <SecondaryButton disabled={pdf.descargando} onClick={() => void pdf.descargar()}>
            {pdf.descargando ? "Generando PDF…" : "Descargar PDF"}
          </SecondaryButton>
        ) : null}

        {estado === "CONFIRMED" ? (
          <PrimaryButton type="button" onClick={() => setDialogo("produccion")}>
            Enviar a producción
          </PrimaryButton>
        ) : null}

        {puedeDuplicar ? (
          cotizacion.open_duplicate_id ? (
            <Link
              to={`/cotizador-v2/${cotizacion.open_duplicate_id}`}
              className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white sm:text-sm"
            >
              Abrir la cotización duplicada
            </Link>
          ) : (
            <PrimaryButton type="button" disabled={duplicar.isPending} onClick={alDuplicar}>
              {duplicar.isPending ? "Duplicando…" : "Duplicar y actualizar precios"}
            </PrimaryButton>
          )
        ) : null}

        {puedeAnular ? (
          <SecondaryButton onClick={() => setDialogo("anular")}>Anular cotización</SecondaryButton>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-xs text-red-700">
          {describeError(error)}
        </p>
      ) : null}

      {dialogo === "produccion" ? (
        <Dialogo titulo="Enviar a producción" onCerrar={() => setDialogo(null)}>
          <p className="mt-2 text-sm text-zinc-600">
            La cotización quedará lista para producción con los valores que se emitieron. No se
            descuenta pasta ni esmalte: el consumo ocurre cuando la producción arranque.
          </p>
          {enviar.error ? (
            <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">
              {describeError(enviar.error)}
            </p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <SecondaryButton onClick={() => setDialogo(null)}>Volver</SecondaryButton>
            <PrimaryButton
              type="button"
              disabled={enviar.isPending}
              onClick={() => enviar.mutate(undefined, { onSuccess: () => setDialogo(null) })}
            >
              {enviar.isPending ? "Enviando…" : "Enviar a producción"}
            </PrimaryButton>
          </div>
        </Dialogo>
      ) : null}

      {dialogo === "anular" ? (
        <Dialogo titulo="Anular cotización" onCerrar={() => setDialogo(null)}>
          <p className="mt-2 text-sm text-zinc-600">
            {emitida
              ? "La cotización queda anulada. Conserva sus valores y su PDF, que se marcará como ANULADA."
              : "El borrador queda anulado y ya no podrá emitirse."}
          </p>
          <div className="mt-4">
            <TextAreaField
              label="Motivo"
              requirement="optional"
              value={motivo}
              onChange={setMotivo}
              rows={2}
            />
          </div>
          {anular.error ? (
            <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">
              {describeError(anular.error)}
            </p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <SecondaryButton onClick={() => setDialogo(null)}>Volver</SecondaryButton>
            <PrimaryButton
              type="button"
              disabled={anular.isPending}
              onClick={() =>
                anular.mutate(motivo.trim() || null, { onSuccess: () => setDialogo(null) })
              }
            >
              {anular.isPending ? "Anulando…" : "Anular cotización"}
            </PrimaryButton>
          </div>
        </Dialogo>
      ) : null}
    </section>
  );
}
