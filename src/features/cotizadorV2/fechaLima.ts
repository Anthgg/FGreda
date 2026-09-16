/**
 * La fecha de un instante en el calendario de Lima. Fase 010H.
 *
 * El backend manda los instantes en UTC. A las 21:00 de Lima ya es el día
 * siguiente en UTC, y enseñar esa fecha diría que la cotización se emitió un
 * día después de lo que dice el PDF. Solo presenta: no decide vencimientos.
 */

export function fechaLima(instante: string | null | undefined): string {
  if (!instante) return "";
  const fecha = new Date(instante);
  if (Number.isNaN(fecha.getTime())) return "";
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(fecha);
}

