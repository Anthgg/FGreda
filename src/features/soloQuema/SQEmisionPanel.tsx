import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchFiringQuotationPdf } from "@/api/firingQuotationV2";
import { formatDisplayDate } from "@/components/dateFormat";
import { PrimaryButton, SecondaryButton, TextAreaField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { EmptyState, Panel } from "@/features/masters/MasterTable";
import { describeError } from "@/features/settings/messages";
import {
  useCancelFiringQuotation,
  useConfirmFiringQuotation,
  useDuplicateFiringQuotation,
  useFiringQuotationPreview,
} from "@/features/soloQuema/useSoloQuema";
import {
  FIRING_QUOTATION_BLOCKER_LABEL,
  FIRING_QUOTATION_DUPLICATE_WARNING_LABEL,
  FIRING_QUOTATION_WARNING_LABEL,
  type V2FiringQuotation,
} from "@/types/firingQuotationV2";

/**
 * Lo que el cliente va a recibir, y el momento de emitirlo. Fase 010K.
 *
 * ## Se emite lo que se vio
 *
 * El resumen trae una huella de los valores comerciales y esa huella viaja con
 * la emisión. Si entre mirar y confirmar alguien cambió una tarifa, el backend
 * rechaza: emitir a ciegas un precio distinto del que se leyó es exactamente lo
 * que este mecanismo existe para impedir.
 *
 * ## Lo que falta se dice, no se esconde
 *
 * Cuando no se puede emitir, el botón no se apaga en silencio: se listan los
 * bloqueos con nombre. Un botón gris sin explicación deja a quien cotiza
 * probando cosas al azar.
 *
 * ## Emitida ya no se edita
 *
 * Se anula o se duplica. Cambiarle el precio a un documento que el cliente ya
 * tiene en la mano no es editar: es reescribir lo acordado.
 */

function useDescargaPdf(id: number) {
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const descargar = async () => {
    setDescargando(true);
    setError(null);
    try {
      const { blob, filename } = await fetchFiringQuotationPdf(id);
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = filename ?? `quema-${id}.pdf`;
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

export function SQEmisionPanel({
  cotizacion,
}: {
  cotizacion: V2FiringQuotation;
}) {
  const navigate = useNavigate();
  const resumen = useFiringQuotationPreview(cotizacion.id);
  const emitir = useConfirmFiringQuotation(cotizacion.id);
  const anular = useCancelFiringQuotation(cotizacion.id);
  const duplicar = useDuplicateFiringQuotation(cotizacion.id);
  const pdf = useDescargaPdf(cotizacion.id);

  const [motivo, setMotivo] = useState("");
  const [anulando, setAnulando] = useState(false);

  const esBorrador = cotizacion.status === "DRAFT";

  if (resumen.isPending) return <Spinner label="Cargando el resumen del cliente" />;
  if (resumen.isError) {
    return (
      <Panel>
        <EmptyState message="No se pudo cargar el resumen que verá el cliente." />
      </Panel>
    );
  }

  const vista = resumen.data;

  return (
    <Panel>
      <div data-testid="panel-emision-quema">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">Lo que verá el cliente</h2>
          <span className="text-xs text-zinc-500">{vista.service_label}</span>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Sin ocupación, sin gas, sin factor y sin margen: el documento lleva las piezas, el
          servicio y los tres importes.
        </p>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-black/[0.06]">
          <table className="w-full min-w-[32rem] text-left text-sm" data-testid="vista-cliente">
            <thead>
              <tr className="text-xs text-zinc-500">
                <th className="px-4 py-2 font-medium">Pieza</th>
                <th className="px-4 py-2 font-medium">Cantidad</th>
                <th className="px-4 py-2 font-medium">Medidas (cm)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {vista.lines.map((linea) => (
                <tr key={linea.id}>
                  <td className="px-4 py-2 text-zinc-800">{linea.product_name ?? "Pieza"}</td>
                  <td className="px-4 py-2 text-zinc-600">{linea.quantity}</td>
                  <td className="px-4 py-2 text-zinc-600">
                    {linea.length_cm && linea.width_cm && linea.height_cm
                      ? `${linea.length_cm} × ${linea.width_cm} × ${linea.height_cm}`
                      : "Sin medidas"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-4 rounded-2xl bg-black/[0.03] px-4 py-3 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-zinc-500">Cliente</dt>
            <dd className="text-sm text-zinc-800">{vista.customer_name ?? "Sin cliente"}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Subtotal</dt>
            <dd className="text-sm text-zinc-800">{vista.subtotal_amount}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">IGV</dt>
            <dd className="text-sm text-zinc-800">{vista.tax_amount}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Total</dt>
            <dd className="text-base font-semibold text-zinc-900">{vista.total_amount}</dd>
          </div>
        </dl>

        {vista.warnings.length > 0 ? (
          <ul className="mt-4 space-y-1 rounded-2xl bg-amber-50 p-3" data-testid="avisos-quema">
            {vista.warnings.map((codigo) => (
              <li key={codigo} className="text-xs text-amber-700">
                {FIRING_QUOTATION_WARNING_LABEL[codigo] ?? codigo}
              </li>
            ))}
          </ul>
        ) : null}

        {esBorrador && vista.blockers.length > 0 ? (
          <ul className="mt-4 space-y-1 rounded-2xl bg-red-50 p-3" data-testid="bloqueos-quema">
            {vista.blockers.map((bloqueo, indice) => (
              <li key={`${bloqueo.code}-${bloqueo.line_id ?? indice}`} className="text-xs text-red-700">
                {FIRING_QUOTATION_BLOCKER_LABEL[bloqueo.code] ?? bloqueo.code}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {esBorrador ? (
            <PrimaryButton
              type="button"
              onClick={() => emitir.mutate(vista.fingerprint)}
              disabled={!vista.can_confirm || emitir.isPending}
            >
              {emitir.isPending ? "Emitiendo..." : "Emitir cotización de quema"}
            </PrimaryButton>
          ) : (
            <SecondaryButton type="button" onClick={pdf.descargar} disabled={pdf.descargando}>
              {pdf.descargando ? "Preparando..." : "Descargar PDF"}
            </SecondaryButton>
          )}

          {cotizacion.status === "CONFIRMED" ? (
            <SecondaryButton type="button" onClick={() => setAnulando(true)}>
              Anular
            </SecondaryButton>
          ) : null}

          {!esBorrador ? (
            <SecondaryButton
              type="button"
              onClick={() =>
                duplicar.mutate(undefined, {
                  onSuccess: (resultado) =>
                    navigate(`/solo-quema/${resultado.quotation.id}`, {
                      state: {
                        avisosDeDuplicacion: resultado.warnings,
                        duplicacionCreada: resultado.created,
                      },
                    }),
                })
              }
              disabled={duplicar.isPending}
            >
              {duplicar.isPending ? "Duplicando..." : "Duplicar"}
            </SecondaryButton>
          ) : null}

          {vista.valid_until ? (
            <span className="text-xs text-zinc-500">
              Válida hasta {formatDisplayDate(vista.valid_until)}
            </span>
          ) : null}
        </div>

        {anulando ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50/60 p-4">
            <p className="text-xs text-red-800">
              Anular no borra nada: el documento queda, marcado como anulado, con el motivo.
            </p>
            <div className="mt-3">
              <TextAreaField
                label="Motivo de la anulación"
                requirement="optional"
                value={motivo}
                onChange={setMotivo}
                rows={2}
              />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <PrimaryButton
                type="button"
                onClick={() =>
                  anular.mutate(motivo.trim() || null, {
                    onSuccess: () => {
                      setAnulando(false);
                      setMotivo("");
                    },
                  })
                }
                disabled={anular.isPending}
              >
                {anular.isPending ? "Anulando..." : "Confirmar anulación"}
              </PrimaryButton>
              <SecondaryButton type="button" onClick={() => setAnulando(false)}>
                Volver
              </SecondaryButton>
            </div>
          </div>
        ) : null}

        {duplicar.data && duplicar.data.warnings.length > 0 ? (
          <ul className="mt-4 space-y-1 rounded-2xl bg-amber-50 p-3">
            {duplicar.data.warnings.map((codigo) => (
              <li key={codigo} className="text-xs text-amber-700">
                {FIRING_QUOTATION_DUPLICATE_WARNING_LABEL[codigo] ?? codigo}
              </li>
            ))}
          </ul>
        ) : null}

        {emitir.isError ? (
          <p role="alert" className="mt-3 text-xs text-red-600">
            {describeError(emitir.error)}
          </p>
        ) : null}
        {anular.isError ? (
          <p role="alert" className="mt-3 text-xs text-red-600">
            {describeError(anular.error)}
          </p>
        ) : null}
        {duplicar.isError ? (
          <p role="alert" className="mt-3 text-xs text-red-600">
            {describeError(duplicar.error)}
          </p>
        ) : null}
        {pdf.error ? (
          <p role="alert" className="mt-3 text-xs text-red-600">
            {describeError(pdf.error)}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
