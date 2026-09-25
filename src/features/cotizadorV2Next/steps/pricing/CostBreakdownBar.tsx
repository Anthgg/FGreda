import { useId } from "react";

import { formatCosto } from "@/features/cotizadorV2/moneda";
import type { V2Pricing } from "@/types/quoterV2Pricing";

/**
 * «Costo de producción»: el costo con el horno a tarifa y de qué está hecho. 010O.10.
 *
 * El total es `production_cost` TAL CUAL llega del backend. Las partes se
 * enseñan al lado, y la barra solo reparte ANCHOS proporcionales para verlas de
 * un vistazo: nunca se suman aquí para obtener un total, y si por redondeo no
 * cuadraran al céntimo con el total, manda el total.
 *
 * La barra es decorativa (`aria-hidden`): cada parte se lee en la leyenda, con
 * su nombre y su importe, así que el color nunca es la única pista.
 */

const PARTES = [
  { campo: "materials_cost", etiqueta: "Materiales", color: "bg-emerald-600" },
  { campo: "labor_cost", etiqueta: "Mano de obra", color: "bg-sky-500" },
  { campo: "illustration_cost", etiqueta: "Ilustración", color: "bg-fuchsia-400" },
  { campo: "space_cost", etiqueta: "Espacio y servicios", color: "bg-amber-400" },
  { campo: "administration_cost", etiqueta: "Administración", color: "bg-zinc-400" },
  { campo: "extras_cost", etiqueta: "Adicionales", color: "bg-rose-400" },
  { campo: "firing_commercial_cost", etiqueta: "Horno (tarifa)", color: "bg-stone-700" },
] as const satisfies readonly { campo: keyof V2Pricing; etiqueta: string; color: string }[];

export function CostBreakdownBar({ precio }: { precio: V2Pricing }) {
  const titulo = useId();
  // Solo para los anchos de la barra. No es un importe y no se enseña.
  const base = Number(precio.production_cost);

  return (
    <section aria-labelledby={titulo} data-testid="v2next-costo">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={titulo} className="text-base font-bold text-zinc-950">
          Costo de producción
        </h3>
        <p
          data-testid="v2next-costo-produccion"
          className="text-lg font-bold tabular-nums text-zinc-950"
        >
          {formatCosto(precio.production_cost)}
        </p>
      </div>

      <div
        aria-hidden="true"
        data-testid="v2next-barra-costo"
        className="mt-2 flex h-3 overflow-hidden rounded-full border border-black/[0.06] bg-black/[0.03]"
      >
        {base > 0
          ? PARTES.map((parte) => {
              const valor = Number(precio[parte.campo]);
              if (!(valor > 0)) return null;
              return (
                <span
                  key={parte.campo}
                  data-parte={parte.campo}
                  className={`h-full ${parte.color}`}
                  style={{ width: `${Math.min(100, (valor / base) * 100)}%` }}
                />
              );
            })
          : null}
      </div>

      <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {PARTES.map((parte) => {
          const valor = precio[parte.campo];
          return (
            <li key={parte.campo} className="flex items-center gap-2 text-[13px]">
              <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-[3px] ${parte.color}`} />
              <span className="text-zinc-600">{parte.etiqueta}</span>
              <span className="ml-auto font-semibold tabular-nums text-zinc-900">
                {Number(valor) > 0 ? formatCosto(String(valor)) : "—"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
