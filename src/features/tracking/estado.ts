/**
 * Cómo se lee un estado de producción fuera del taller.
 *
 * El backend manda el código (`STARTED`) y el castellano se decide aquí. Hay
 * dos vocabularios a propósito: dentro se dice «En proceso» porque quien lo lee
 * conoce la casa; fuera se dice «En producción» porque quien escanea no sabe si
 * «Creada» significa que ya la están haciendo.
 */

import type { ProductionOrderStatus } from "@/types/production";
import type { PublicTracking } from "@/types/tracking";

/** Tono visual. Los mismos cinco que usa el sistema documental en los PDF. */
export type EstadoTono = "pending" | "active" | "done" | "void";

interface EstadoPublico {
  label: string;
  tono: EstadoTono;
}

const ESTADOS: Record<ProductionOrderStatus, EstadoPublico> = {
  CREATED: { label: "Orden creada", tono: "pending" },
  STARTED: { label: "En producción", tono: "active" },
  COMPLETED: { label: "Producción completada", tono: "done" },
  CANCELLED: { label: "Orden anulada", tono: "void" },
};

export function estadoPublico(status: ProductionOrderStatus): EstadoPublico {
  return ESTADOS[status];
}

export interface HitoSeguimiento {
  label: string;
  /** Nulo mientras no ha ocurrido. */
  fecha: string | null;
  hecho: boolean;
}

/**
 * La línea de tiempo de una orden.
 *
 * Una orden anulada no enseña «Producción iniciada» en gris: nunca llegó a
 * fabricarse y dejar el hito ahí sugeriría que algo se hizo. Se cuentan los dos
 * hechos que sí ocurrieron.
 */
export function hitosDe(seguimiento: PublicTracking): HitoSeguimiento[] {
  if (seguimiento.status === "CANCELLED") {
    return [
      { label: "Orden creada", fecha: seguimiento.created_at, hecho: true },
      { label: "Orden anulada", fecha: seguimiento.cancelled_at, hecho: true },
    ];
  }

  return [
    { label: "Orden creada", fecha: seguimiento.created_at, hecho: true },
    {
      label: "Producción iniciada",
      fecha: seguimiento.started_at,
      hecho: seguimiento.started_at !== null,
    },
    {
      label: "Producción completada",
      fecha: seguimiento.completed_at,
      hecho: seguimiento.completed_at !== null,
    },
  ];
}

/**
 * Fecha y hora legibles.
 *
 * El backend manda ISO 8601 con zona; se muestra en la del navegador, que es la
 * del taller. Un valor que no se pueda interpretar se deja fuera en vez de
 * escribir «Invalid Date» en una pantalla que mira un cliente.
 */
export function fechaLegible(iso: string | null): string | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  return fecha.toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
