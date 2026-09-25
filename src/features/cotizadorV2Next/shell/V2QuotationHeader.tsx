import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { EstadoV2 } from "@/features/cotizadorV2/V2CicloDeVida";
import type { V2EffectiveStatus } from "@/types/quoterV2";

/**
 * La cabecera de la cotización: vale igual en los siete pasos. Fase 010O.3.
 *
 * Dice de quién es la cotización y cómo se llama, y deja un hueco para las
 * acciones del ciclo de vida. En 010O.3 ese hueco lo ocupa `V2CicloDeVida` tal
 * cual —anular, PDF, duplicar, enviar a producción—, que ya pinta el estado; por
 * eso `estado` es opcional: se enseña aquí cuando las acciones dejen de
 * hacerlo (010O.12), nunca dos veces.
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
