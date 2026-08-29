/**
 * Reglas de la tabla de factores de ocupación de un horno.
 *
 * Viven aparte del componente porque son lógica pura y se prueban sin montar
 * React: qué tramos se ofrecen por omisión, cómo se leen los del backend, qué
 * hace válida una tabla y cómo se convierte en payload.
 */

import type { KilnOccupancyFactorIn, KilnOccupancyFactorOut } from "@/types/firings";

/**
 * Tramos con los que arranca el editor. Es una PLANTILLA DE INTERFAZ, no un
 * requisito del dominio: el backend acepta cualquier reparto contiguo de 1 % a
 * 100 %, con los tramos que sean y del ancho que sean.
 */
const DEFAULT_BRACKETS = 10;

export interface FactorRow {
  min: string;
  max: string;
  factor: string;
}

/** Plantilla inicial: diez tramos de 10 %, con el multiplicador por rellenar. */
export function defaultFactorRows(): FactorRow[] {
  return Array.from({ length: DEFAULT_BRACKETS }, (_, i) => ({
    min: String(i * 10 + 1),
    max: String((i + 1) * 10),
    factor: "",
  }));
}

export function rowsFromFactors(factors: KilnOccupancyFactorOut[]): FactorRow[] {
  if (factors.length === 0) return defaultFactorRows();
  return [...factors]
    .sort((a, b) => a.min_percentage - b.min_percentage)
    .map((f) => ({
      min: String(f.min_percentage),
      max: String(f.max_percentage),
      factor: String(f.factor),
    }));
}

const isInt = (value: string) => /^\d+$/.test(value.trim());
const isPositiveDecimal = (value: string) =>
  /^\d+(\.\d+)?$/.test(value.trim()) && Number(value) > 0;

/**
 * Repite en el navegador las reglas que el backend impone, para avisar antes
 * de enviar. El backend sigue siendo la autoridad: esto sólo evita un viaje
 * que ya se sabe que va a fallar.
 */
export function validateFactorRows(rows: FactorRow[]): string | null {
  if (rows.length === 0) return "La tabla de factores no puede estar vacía.";
  for (const row of rows) {
    if (!isInt(row.min) || !isInt(row.max)) {
      return "Los tramos se expresan en porcentajes enteros.";
    }
    if (!isPositiveDecimal(row.factor)) {
      return "Cada tramo necesita un multiplicador mayor que cero.";
    }
    if (Number(row.max) < Number(row.min)) {
      return "Un tramo no puede terminar antes de empezar.";
    }
  }
  const sorted = [...rows].sort((a, b) => Number(a.min) - Number(b.min));
  if (Number(sorted[0]?.min) !== 1) return "El primer tramo debe empezar en 1 %.";
  if (Number(sorted[sorted.length - 1]?.max) !== 100) {
    return "El último tramo debe terminar en 100 %.";
  }
  for (let i = 1; i < sorted.length; i += 1) {
    if (Number(sorted[i]?.min) !== Number(sorted[i - 1]?.max) + 1) {
      return `Hay un hueco o solapamiento: el tramo ${i + 1} debería empezar en ${Number(sorted[i - 1]?.max) + 1} %.`;
    }
  }
  return null;
}

export function rowsToPayload(rows: FactorRow[]): KilnOccupancyFactorIn[] {
  return [...rows]
    .sort((a, b) => Number(a.min) - Number(b.min))
    .map((row) => ({
      min_percentage: Number(row.min),
      max_percentage: Number(row.max),
      factor: row.factor.trim(),
    }));
}

