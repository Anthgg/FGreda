import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { EstadoV2 } from "@/features/cotizadorV2/V2CicloDeVida";
import type { V2EffectiveStatus } from "@/types/quoterV2";

/**
 * La cabecera de la cotización: vale igual en los siete pasos. Fase 010O.3.
 *
 * Dice de quién es la cotización, cómo se llama y en qué estado está, y deja un
 * hueco para el ciclo de vida —anular, PDF, duplicar, enviar a producción—.
 * Desde 010O.12 el estado se pinta aquí y `V2CicloDeVida` se monta con
 * `conEstado={false}`: el mismo estado dos veces en la pantalla es ruido.
 */
export function V2QuotationHeader({
  titulo,
  codigo,
  rutaListado,
  estado,
  children,
}: {
  titulo: string;
  codigo: string;
  rutaListado: string;
  estado?: V2EffectiveStatus | undefined;
  /** Acciones del ciclo de vida. */
  children?: ReactNode;
}) {
  return (
    <header data-testid="v2next-cabecera" className="min-w-0 space-y-2">
      <Link
        to={rutaListado}
        className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-600 hover:text-zinc-900"
      >
        <span aria-hidden="true">‹</span> Cotizaciones
      </Link>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="min-w-0 break-words text-xl font-bold tracking-tight text-zinc-950 sm:text-2xl">
          {titulo}
        </h1>
        {estado ? <EstadoV2 estado={estado} /> : null}
        <span className="text-xs text-zinc-500 tabular-nums">{codigo}</span>
      </div>
      {children}
    </header>
  );
}
