/**
 * Utilidades puras para formateo y parseo de fechas sin desfase horario.
 *
 * Trabaja con cadenas canónicas en formato ISO "YYYY-MM-DD" para el backend
 * y las formatea como "DD/MM/YYYY" para la interfaz.
 */

export interface ParsedDate {
  year: number;
  month: number;
  day: number;
}

export function parseISODate(dateStr: string | null | undefined): ParsedDate | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;
  const yearStr = match[1];
  const monthStr = match[2];
  const dayStr = match[3];
  if (!yearStr || !monthStr || !dayStr) return null;
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}


export function formatDisplayDate(dateStr: string | null | undefined): string {
  const parsed = parseISODate(dateStr);
  if (!parsed) return "";
  const dd = String(parsed.day).padStart(2, "0");
  const mm = String(parsed.month).padStart(2, "0");
  const yyyy = String(parsed.year).padStart(4, "0");
  return `${dd}/${mm}/${yyyy}`;
}

export function formatISODate(year: number, month: number, day: number): string {
  const yyyy = String(year).padStart(4, "0");
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getTodayLocal(): { year: number; month: number; day: number; iso: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  return { year, month, day, iso: formatISODate(year, month, day) };
}
