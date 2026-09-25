import { Spinner } from "@/components/Spinner";
import { Panel } from "@/features/masters/MasterTable";
import { describeError } from "@/features/settings/messages";
import { describirBloqueo } from "@/features/cotizadorV2/mensajesCicloDeVida";
import { V2DocumentoEmitido } from "@/features/cotizadorV2/V2DocumentoEmitido";
import { useV2ConfirmationPreview } from "@/features/cotizadorV2/useQuoterV2Lifecycle";
import {
  ETIQUETA_DE_PASO,
  estadoVisualDePasos,
  type PasoDelAsistenteProps,
} from "@/features/cotizadorV2Next/shell/pasosDelAsistente";
import { ChecklistDePasos } from "@/features/cotizadorV2Next/steps/review/ChecklistDePasos";
import { DocumentoDelCliente } from "@/features/cotizadorV2Next/steps/review/DocumentoDelCliente";
import { EmitirCotizacion } from "@/features/cotizadorV2Next/steps/review/EmitirCotizacion";
import { vigenciaProyectada } from "@/features/cotizadorV2Next/steps/review/vigencia";

/**
 * Paso «Revisar y emitir» del Cotizador V2 rediseñado. Fase 010O.11.
 *
 * Lo último antes de comprometer un precio, en tres bloques:
 *
 * 1. **la lista de pasos**, con lo que falta en cada uno. Juzga igual que la
 *    barra: `pasos.ts` como pista y los bloqueos del backend como autoridad;
 * 2. **el documento**, tal como lo verá el cliente: el resumen de emisión del
 *    backend, sin un solo costo interno ni una suma hecha aquí;
 * 3. **emitir**, con la huella de ese mismo resumen (ver `EmitirCotizacion`).
 *
 * Una cotización que ya no es borrador enseña el documento que se congeló y su
 * historial; ahí no hay nada que revisar ni que emitir.
 */
export function V2NextReviewStep({ quotationId, datos, estados, irAPaso }: PasoDelAsistenteProps) {
  const cotizacion = datos.cotizacion;
  const borrador = cotizacion?.status === "DRAFT";
  const resumen = useV2ConfirmationPreview(quotationId, borrador);

  if (cotizacion && !borrador) return <V2DocumentoEmitido cotizacion={cotizacion} />;

  // Mientras algún dato del flujo no ha llegado, `pasos.ts` diría «no se pudo
  // leer» de ese paso: la lista espera en vez de pintar una falta que no existe.
  const cargando = Object.values(datos).some((dato) => dato === undefined);
  const pasos = estadoVisualDePasos(estados, resumen.data?.blockers, cargando);
  const deConfiguracion = (resumen.data?.blockers ?? []).filter(
    (bloqueo) => describirBloqueo(bloqueo.code).paso === null,
  );
  const avisos = estados.flatMap((estado) =>
    estado.senales
      .filter((senal) => senal.severidad !== "error")
      .map((senal) => ({ ...senal, paso: estado.id })),
  );

  return (
    <Panel>
      <div data-testid="v2next-paso-revisar" className="space-y-6">
        <p className="max-w-[64ch] text-[13px] text-zinc-600">
          Así lo verá el cliente. Al emitir, la cotización queda fija con su fecha y vigencia.
        </p>

        {cargando ? (
          <Spinner className="size-5" label="Revisando los pasos…" />
        ) : (
          <ChecklistDePasos pasos={pasos} irAPaso={irAPaso} />
        )}

        {deConfiguracion.length > 0 ? (
          <ul
            data-testid="v2next-bloqueos-configuracion"
            className="space-y-1 rounded-xl border border-red-200 bg-red-50 p-3"
          >
            {deConfiguracion.map((bloqueo, indice) => (
              <li key={`${bloqueo.code}-${indice}`} className="text-xs text-red-800">
                {describirBloqueo(bloqueo.code).mensaje}
              </li>
            ))}
          </ul>
        ) : null}

        {resumen.isPending ? (
          <Spinner className="size-5" label="Preparando el documento…" />
        ) : resumen.isError ? (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">
            {describeError(resumen.error)}
          </p>
        ) : (
          <DocumentoDelCliente resumen={resumen.data} subtitulo={vigenciaProyectada(resumen.data)} />
        )}

        {avisos.length > 0 ? (
          <section
            aria-label="Para revisar antes de emitir"
            data-testid="v2next-avisos-revision"
            className="rounded-xl border border-amber-200 bg-amber-50 p-3"
          >
            <p className="text-xs font-semibold text-amber-900">
              Para revisar antes de emitir. Nada de esto impide hacerlo.
            </p>
            <ul className="mt-1.5 space-y-1">
              {avisos.map((aviso, indice) => (
                <li key={`${aviso.paso}-${indice}`} className="text-xs text-amber-900">
                  <button
                    type="button"
                    onClick={() => irAPaso(aviso.paso)}
                    className="font-semibold underline underline-offset-2 cursor-pointer"
                  >
                    {ETIQUETA_DE_PASO[aviso.paso].titulo}
                  </button>
                  {": "}
                  {aviso.mensaje}
                  {aviso.severidad === "recomendacion" ? " (recomendación)" : ""}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <EmitirCotizacion quotationId={quotationId} resumen={resumen} />
      </div>
    </Panel>
  );
}
