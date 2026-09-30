import { useEffect, useRef } from "react";

import type { PasoId } from "@/features/cotizadorV2/pasos";
import {
  ETIQUETA_DE_PASO,
  type EstadoVisualDePaso,
  type Situacion,
} from "@/features/cotizadorV2Next/shell/pasosDelAsistente";

/**
 * La barra de pasos del Cotizador V2. Fase 010O.3.
 *
 * Vertical cuando el asistente tiene sitio, horizontal y desplazable cuando no:
 * lo decide la consulta de contenedor del shell, no el ancho de la ventana,
 * porque el ancho útil cambia al plegar el menú lateral.
 *
 * El estado nunca se dice solo con color. Cada paso lleva un símbolo distinto
 * —✓ listo, ! falta, ▲ aviso— y una frase («Falta 1 dato»), también en el paso
 * actual. Todos los pasos son botones, incluso los incompletos: un asistente
 * que obliga a ir en orden es el que hace abrir una cotización nueva en vez de
 * arreglar la que se tiene.
 */

const SIMBOLO: Record<Exclude<Situacion, "cargando">, string> = {
  listo: "✓",
  falta: "!",
  aviso: "▲",
};

const CIRCULO: Record<Situacion, string> = {
  listo: "border-emerald-500 bg-emerald-50 text-emerald-700",
  falta: "border-red-500 bg-red-50 text-red-600",
  aviso: "border-amber-500 bg-amber-50 text-amber-700",
  cargando: "border-zinc-300 bg-white text-zinc-500",
};

const SUBTITULO: Record<Situacion, string> = {
  listo: "text-zinc-500",
  falta: "text-red-600",
  aviso: "text-amber-700",
  cargando: "text-zinc-500",
};

function frase(paso: EstadoVisualDePaso): string {
  switch (paso.situacion) {
    case "falta":
      return paso.faltas === 1 ? "Falta 1 dato" : `Faltan ${paso.faltas} datos`;
    case "aviso":
      return paso.avisos === 1 ? "1 aviso" : `${paso.avisos} avisos`;
    default:
      return ETIQUETA_DE_PASO[paso.id].detalle;
  }
}

export function V2StepNav({
  pasos,
  actual,
  onIr,
  className = "",
}: {
  pasos: readonly EstadoVisualDePaso[];
  actual: PasoId;
  onIr: (paso: PasoId) => void;
  className?: string;
}) {
  const botonActual = useRef<HTMLButtonElement>(null);

  // En la barra horizontal el paso actual puede quedar fuera de la vista: se
  // trae dentro. `nearest` no mueve nada si ya se ve.
  useEffect(() => {
    botonActual.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [actual]);

  return (
    <nav
      aria-label="Pasos"
      data-testid="v2next-pasos"
      className={`glass-panel min-w-0 self-start rounded-2xl p-1.5 ${className}`}
    >
      {/* `relative` es imprescindible: los prefijos `sr-only` son absolutos, y
          sin un bloque contenedor DENTRO del carril escapaban de su recorte y
          ensanchaban el <main> (605 px de desborde a 375 px de ancho). */}
      <ol className="custom-scrollbar relative flex snap-x gap-1 overflow-x-auto pb-1 @min-[760px]:flex-col @min-[760px]:overflow-visible @min-[760px]:pb-0">
        {pasos.map((paso, indice) => {
          const esActual = paso.id === actual;
          const etiqueta = ETIQUETA_DE_PASO[paso.id];
          return (
            <li key={paso.id} className="shrink-0 snap-start @min-[760px]:shrink">
              <button
                ref={esActual ? botonActual : undefined}
                type="button"
                onClick={() => onIr(paso.id)}
                aria-current={esActual ? "step" : undefined}
                data-situacion={paso.situacion}
                className={[
                  "flex w-full min-w-[150px] items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors cursor-pointer @min-[760px]:min-w-0",
                  esActual ? "bg-zinc-900 text-white" : "text-zinc-900 hover:bg-black/[0.04]",
                ].join(" ")}
              >
                <span
                  aria-hidden="true"
                  className={[
                    "mt-px grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] text-[11px] font-bold",
                    esActual ? "border-white bg-white text-zinc-900" : CIRCULO[paso.situacion],
                  ].join(" ")}
                >
                  {paso.situacion === "cargando" ? indice + 1 : SIMBOLO[paso.situacion]}
                </span>
                <span className="min-w-0">
                  <span className="sr-only">{`Paso ${indice + 1}: `}</span>
                  <span className="block text-[13px] font-semibold leading-tight">
                    {etiqueta.titulo}
                  </span>
                  <span
                    className={[
                      "mt-0.5 block text-[11.5px] leading-tight",
                      esActual ? "text-white/75" : SUBTITULO[paso.situacion],
                    ].join(" ")}
                  >
                    {frase(paso)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
