/**
 * Fase 010I. Fechas y horas de Lima para los formularios del seguimiento.
 *
 * Misma política que el backend (`BUSINESS_TZ`): Perú es UTC-5 fijo, sin horario
 * de verano. Un campo `datetime-local` no lleva zona, así que lo que la persona
 * escribe se interpreta SIEMPRE como hora de Lima, esté donde esté el navegador,
 * y se manda al backend como instante con su desplazamiento.
 */

const DESPLAZAMIENTO_LIMA_MS = -5 * 60 * 60 * 1000;
const SUFIJO_LIMA = "-05:00";

/** Holgura del backend para el reloj del navegador (la misma: 5 minutos). */
export const HOLGURA_RELOJ_MS = 5 * 60 * 1000;

/** Un instante como valor de `datetime-local` en hora de Lima: «2026-09-18T14:05». */
export function aCampoLima(instante: Date | string): string {
  const fecha = typeof instante === "string" ? new Date(instante) : instante;
  const enLima = new Date(fecha.getTime() + DESPLAZAMIENTO_LIMA_MS);
  return enLima.toISOString().slice(0, 16);
}

/**
 * Un instante EXACTO, con segundos, escrito en hora de Lima: se usa cuando la
 * persona deja la fecha propuesta («ahora»). El campo sólo guarda minutos, y
 * mandar «18:00:00» para algo registrado a las 18:00:40 lo pondría en el
 * seguimiento ANTES de lo que acababa de pasar.
 */
export function instanteLimaExacto(instante: Date = new Date()): string {
  const enLima = new Date(instante.getTime() + DESPLAZAMIENTO_LIMA_MS);
  return `${enLima.toISOString().slice(0, 23)}${SUFIJO_LIMA}`;
}

/** El valor de un `datetime-local` (hora de Lima) como instante ISO con zona. */
export function desdeCampoLima(valor: string): string {
  return `${valor}:00${SUFIJO_LIMA}`;
}

/** Si el campo tiene forma de fecha-hora completa. */
export function campoCompleto(valor: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor);
}

/**
 * Si la fecha cae en la ventana que acepta el backend: desde la creación de la
 * orden hasta ahora más la holgura. Es un aviso amable; quien decide es él.
 */
export function dentroDeLaVentana(valor: string, creadaEn: string, ahora = new Date()): boolean {
  if (!campoCompleto(valor)) return false;
  const instante = new Date(desdeCampoLima(valor)).getTime();
  // El campo no tiene segundos: la creación se compara al minuto, o una nota
  // escrita en el mismo minuto en que nació la orden parecería anterior a ella.
  const creada = Math.floor(new Date(creadaEn).getTime() / 60_000) * 60_000;
  return instante >= creada && instante <= ahora.getTime() + HOLGURA_RELOJ_MS;
}

/** «18/09/2026 14:05», en Lima. Sólo presenta. */
export function fechaHoraLima(instante: string | null | undefined): string {
  if (!instante) return "—";
  const fecha = new Date(instante);
  if (Number.isNaN(fecha.getTime())) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(fecha);
}
