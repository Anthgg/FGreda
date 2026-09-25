import { describirBloqueo } from "@/features/cotizadorV2/mensajesCicloDeVida";
import { PASOS, type PasoId } from "@/features/cotizadorV2/pasos";
import { ETIQUETA_DE_PASO } from "@/features/cotizadorV2Next/shell/pasosDelAsistente";
import type { V2Blocker } from "@/types/quoterV2";
import type { V2QuotationProduct } from "@/types/quoterV2Materials";

/**
 * Lo que falta para poder emitir. Fase 010O.3.
 *
 * Sale de los `blockers` del resumen de emisión del backend, que son la
 * autoridad: exactamente lo que impediría emitir. La pantalla no reconstruye
 * esa lista con sus propias reglas —`pasos.ts` es más laxo y la lista saldría
 * distinta de lo que el backend acabaría rechazando—; solo la traduce con
 * `describirBloqueo` y ofrece ir al paso donde se arregla.
 */

type Props = {
  bloqueos: readonly V2Blocker[] | undefined;
  cargando: boolean;
  error: boolean;
  /** Si es borrador. Una emitida ya no tiene pendientes: sus valores están congelados. */
  editable: boolean;
  /** Avisos y recomendaciones de todos los pasos: no impiden emitir. */
  avisos: number;
  lineas: readonly V2QuotationProduct[];
  irAPaso: (paso: PasoId) => void;
};

function numeroDePaso(paso: PasoId): number {
  return PASOS.findIndex((uno) => uno.id === paso) + 1;
}

export function V2PendingList({
  bloqueos,
  cargando,
  error,
  editable,
  avisos,
  lineas,
  irAPaso,
}: Props) {
  const nombreDeLinea = (id: number | null) =>
    id === null ? null : (lineas.find((linea) => linea.id === id)?.product_name ?? null);

  let cuerpo;
  if (!editable) {
    cuerpo = (
      <p className="text-xs text-zinc-600">
        Esta cotización ya no es un borrador: sus valores están congelados.
      </p>
    );
  } else if (cargando) {
    cuerpo = <p className="text-xs text-zinc-500">Comprobando qué falta…</p>;
  } else if (error || bloqueos === undefined) {
    cuerpo = (
      <p className="text-xs text-zinc-600">
        No se pudo comprobar qué falta. Al emitir se vuelve a comprobar.
      </p>
    );
  } else if (bloqueos.length === 0) {
    cuerpo = (
      <p className="flex items-center gap-2.5 text-[13px] font-semibold text-emerald-800">
        <span
          aria-hidden="true"
          className="grid size-5 place-items-center rounded-full bg-emerald-600 text-[11px] text-white"
        >
          ✓
        </span>
        Todo listo para emitir
      </p>
    );
  } else {
    cuerpo = (
      <>
        <h3 className="text-sm font-bold text-red-700">
          {bloqueos.length === 1
            ? "Falta 1 cosa para emitir"
            : `Faltan ${bloqueos.length} cosas para emitir`}
        </h3>
        <ul className="mt-2 space-y-0.5">
          {bloqueos.map((bloqueo, indice) => {
            const pendiente = describirBloqueo(bloqueo.code);
            const pieza = nombreDeLinea(bloqueo.line_id);
            const detalle = [
              pendiente.paso
                ? `Paso ${numeroDePaso(pendiente.paso)}: ${ETIQUETA_DE_PASO[pendiente.paso].titulo}`
                : "Configuración comercial",
              pieza,
            ]
              .filter(Boolean)
              .join(" · ");
            const contenido = (
              <>
                <span
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 rounded-full border-[1.5px] border-red-500"
                />
                <span className="min-w-0">
                  {pendiente.mensaje}
                  <span className="block text-[11.5px] text-zinc-500">{detalle}</span>
                </span>
              </>
            );
            const paso = pendiente.paso;
            return (
              <li key={`${bloqueo.code}-${bloqueo.line_id ?? "x"}-${indice}`}>
                {paso ? (
                  <button
                    type="button"
                    onClick={() => irAPaso(paso)}
                    className="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] text-zinc-900 hover:bg-black/[0.04] cursor-pointer"
                  >
                    {contenido}
                  </button>
                ) : (
                  <div className="flex items-start gap-2.5 px-2 py-1.5 text-[13px] text-zinc-900">
                    {contenido}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  return (
    <section
      aria-label="Pendientes"
      data-testid="v2next-pendientes"
      className="glass-panel rounded-2xl p-4"
    >
      {cuerpo}
      {editable && avisos > 0 ? (
        <p className="mt-3 text-xs text-zinc-500">
          {avisos === 1
            ? "1 aviso menor: no impide emitir."
            : `${avisos} avisos menores: no impiden emitir.`}
        </p>
      ) : null}
    </section>
  );
}
