import { DESTINO_DE_GUARDADO } from "@/features/cotizadorV2/claves";
import type { PasoId } from "@/features/cotizadorV2/pasos";
import type { EstadoDeGuardado } from "@/features/cotizadorV2/useEstadoDeGuardado";
import { describeError } from "@/features/settings/messages";

/**
 * El estado de los guardados de la cotización, dicho con verdad. Fase 010O.3.
 *
 * No hay botón de «guardar borrador»: cada campo guarda al salir de él. Lo que
 * sí hay es el ESTADO de esos guardados, leído de `useEstadoDeGuardado`, que
 * sabe lo que la caché de mutaciones sabe. Cuatro frases, por orden de
 * gravedad: un rechazo manda sobre un guardado en curso, y este sobre lo
 * tecleado que aún no ha salido. «Guardado» solo cuando no queda nada de eso.
 */

type Estado = "error" | "guardando" | "sin-guardar" | "guardado";

const TEXTO: Record<Estado, string> = {
  error: "Error al guardar",
  guardando: "Guardando…",
  "sin-guardar": "Cambios sin guardar",
  guardado: "Guardado",
};

const PUNTO: Record<Estado, string> = {
  error: "bg-red-500",
  guardando: "bg-amber-500 motion-safe:animate-pulse",
  "sin-guardar": "bg-amber-500",
  guardado: "bg-emerald-500",
};

const LETRA: Record<Estado, string> = {
  error: "font-semibold text-red-700",
  guardando: "font-medium text-amber-800",
  "sin-guardar": "font-medium text-amber-800",
  guardado: "text-zinc-600",
};

function estadoDeGuardado(guardado: EstadoDeGuardado): Estado {
  if (guardado.fallidos.length > 0) return "error";
  if (guardado.enVuelo > 0) return "guardando";
  if (guardado.borradores > 0) return "sin-guardar";
  return "guardado";
}

export function V2SaveStatus({ guardado }: { guardado: EstadoDeGuardado }) {
  const estado = estadoDeGuardado(guardado);
  return (
    <p
      role="status"
      aria-live="polite"
      data-testid="v2next-estado-guardado"
      data-estado={estado}
      className={`inline-flex items-center gap-2 text-xs ${LETRA[estado]}`}
    >
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${PUNTO[estado]}`} />
      {TEXTO[estado]}
    </p>
  );
}

/**
 * Los guardados que el backend rechazó, en todos los pasos.
 *
 * Se avisa arriba y no solo en el panel que lanzó la escritura: si ya se cambió
 * de paso, ese panel no existe y el error se habría perdido con él. El aviso NO
 * bloquea la navegación —ir al paso donde se arregla es justo lo que hace
 * falta— y se queda hasta que el mismo dato se guarde bien o alguien lo
 * descarte a sabiendas.
 */
export function V2FailedSaves({
  guardado,
  irAPaso,
}: {
  guardado: EstadoDeGuardado;
  irAPaso: (paso: PasoId) => void;
}) {
  if (guardado.fallidos.length === 0) return null;
  return (
    <div
      role="alert"
      data-testid="v2next-guardados-fallidos"
      className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-800"
    >
      <p className="font-semibold">
        {guardado.fallidos.length === 1
          ? "Un cambio no se guardó."
          : `${guardado.fallidos.length} cambios no se guardaron.`}{" "}
        Lo que ve en pantalla puede no ser lo que hay en el servidor.
      </p>
      <ul className="mt-2 space-y-2">
        {guardado.fallidos.map((fallo) => {
          const destino = DESTINO_DE_GUARDADO[fallo.tipo];
          return (
            <li key={fallo.firma} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                No se pudo guardar <strong>{destino?.que ?? "un cambio"}</strong>:{" "}
                {describeError(fallo.error)}
              </span>
              {destino ? (
                <button
                  type="button"
                  onClick={() => irAPaso(destino.paso)}
                  className="font-semibold underline underline-offset-2 cursor-pointer"
                >
                  Ir a corregirlo
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => guardado.descartar(fallo.firma)}
                className="text-red-700 underline underline-offset-2 cursor-pointer"
              >
                Descartar este cambio
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
