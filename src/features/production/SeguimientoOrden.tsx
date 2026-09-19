import { describeStatus } from "@/features/production/readiness";
import { normalizar } from "@/features/production/decimales";
import { fechaHoraLima } from "@/features/production/instanteLima";
import {
  describeConsumptionKind,
  describeFiringKind,
  describeTimelineType,
} from "@/features/production/mensajesProduccion";
import type { ProductionTimelineEvent } from "@/types/production";

const PUNTO: Record<ProductionTimelineEvent["type"], string> = {
  STATUS: "bg-zinc-900",
  CONSUMPTION: "bg-amber-500",
  NOTE: "bg-zinc-400",
  FIRING_NOTE: "bg-orange-600",
  COMMUNICATION: "bg-sky-600",
};

/** Lo que dice cada hecho. Cada tipo lee SOLO su propio detalle. */
function Detalle({ evento }: { evento: ProductionTimelineEvent }) {
  switch (evento.type) {
    case "STATUS":
      return (
        <p className="text-sm font-semibold text-zinc-900">
          {evento.status ? describeStatus(evento.status).toUpperCase() : "Cambio de estado"}
        </p>
      );
    case "CONSUMPTION": {
      const c = evento.consumption;
      if (!c) return null;
      return (
        <p className="text-sm text-zinc-900">
          <span className="font-semibold tabular-nums">
            {normalizar(c.quantity)} {c.uom_code}
          </span>{" "}
          de {c.product_name}
          <span className="text-zinc-500">
            {" "}
            · {describeConsumptionKind(c.kind)} · {c.stock_location_name}
          </span>
        </p>
      );
    }
    case "FIRING_NOTE": {
      const n = evento.note;
      if (!n) return null;
      return (
        <div className="text-sm text-zinc-900">
          <p>
            <span className="font-semibold">{describeFiringKind(n.firing_type)}</span>
            {n.kiln_name ? ` en ${n.kiln_name}` : ""}
          </p>
          {n.body ? <p className="mt-0.5 whitespace-pre-wrap text-zinc-700">{n.body}</p> : null}
        </div>
      );
    }
    case "NOTE": {
      const n = evento.note;
      if (!n) return null;
      return <p className="whitespace-pre-wrap text-sm text-zinc-900">{n.body}</p>;
    }
    case "COMMUNICATION": {
      const m = evento.communication;
      if (!m) return null;
      return (
        <div className="text-sm text-zinc-900">
          <p className="text-xs text-sky-800">Aviso por WhatsApp registrado a mano</p>
          <p className="mt-0.5 whitespace-pre-wrap">{m.message}</p>
        </div>
      );
    }
  }
}

/**
 * El seguimiento de la orden. En el orden que manda el backend, sin volver a
 * ordenarlo aquí: la regla de desempate es suya.
 */
export function SeguimientoOrden({
  eventos,
  cargando,
}: {
  eventos: readonly ProductionTimelineEvent[];
  cargando: boolean;
}) {
  if (cargando) return <p className="text-xs text-zinc-500">Cargando el seguimiento…</p>;
  if (eventos.length === 0) return <p className="text-xs text-zinc-500">Todavía no hay nada.</p>;
  return (
    <ol className="relative space-y-4 border-l border-zinc-200 pl-5" data-testid="seguimiento">
      {eventos.map((evento, indice) => {
        const detalleId =
          evento.consumption?.id ?? evento.note?.id ?? evento.communication?.id ?? indice;
        return (
          <li
            key={`${evento.type}-${detalleId}-${evento.occurred_at}`}
            className="relative"
            data-tipo={evento.type}
          >
            <span
              aria-hidden="true"
              className={`absolute -left-[26px] top-1.5 size-2.5 rounded-full ring-4 ring-white ${PUNTO[evento.type]}`}
            />
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">
              {describeTimelineType(evento.type)} · {fechaHoraLima(evento.occurred_at)}
              {evento.actor_name ? ` · ${evento.actor_name}` : ""}
            </p>
            <div className="mt-0.5">
              <Detalle evento={evento} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
