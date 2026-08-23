/**
 * Vocabulario del modulo de quemas.
 *
 * La interfaz nunca muestra `LOW`, `HIGH` ni `DRAFT`: son valores del contrato,
 * no palabras del taller.
 */

import type { FiringStatus, FiringType } from "@/types/firings";

export const FIRING_TYPE_LABEL: Record<FiringType, string> = {
  LOW: "Baja",
  HIGH: "Alta",
};

export const FIRING_TYPE_OPTIONS: readonly { value: FiringType; label: string }[] = [
  { value: "LOW", label: "Baja" },
  { value: "HIGH", label: "Alta" },
];

export const FIRING_STATUS_LABEL: Record<FiringStatus, string> = {
  DRAFT: "Borrador",
  CONFIRMED: "Confirmada",
  CANCELLED: "Anulada",
};

export const FIRING_STATUS_TONE: Record<FiringStatus, "neutral" | "positive" | "warning"> = {
  DRAFT: "warning",
  CONFIRMED: "positive",
  CANCELLED: "neutral",
};

/**
 * Formatea un decimal recibido como texto sin pasar por `parseFloat`.
 *
 * Se trabaja sobre la cadena: se recorta o se rellena la parte decimal. Asi
 * "1041.384083" se muestra como "1041.38" sin que el numero pase nunca por la
 * coma flotante binaria.
 */
export function formatDecimalString(value: string | null | undefined, decimals: number): string {
  if (value === null || value === undefined || value === "") return "—";

  const negative = value.startsWith("-");
  const cuerpo = negative ? value.slice(1) : value;
  const [enteraCruda = "0", decimalCruda = ""] = cuerpo.split(".");
  const entera = enteraCruda === "" ? "0" : enteraCruda;

  if (decimals <= 0) return `${negative ? "-" : ""}${entera}`;

  const decimal =
    decimalCruda.length >= decimals
      ? decimalCruda.slice(0, decimals)
      : decimalCruda.padEnd(decimals, "0");

  return `${negative ? "-" : ""}${entera}.${decimal}`;
}

/** Porcentaje con un decimal, listo para mostrar. */
export function formatPercentage(value: string | null | undefined): string {
  const texto = formatDecimalString(value, 1);
  return texto === "—" ? texto : `${texto} %`;
}

/**
 * Multiplica dos decimales en texto sin coma flotante.
 *
 * Se usa para el volumen que se muestra mientras se captura una pieza, antes de
 * que el servidor responda. El calculo con valor de negocio sigue siendo del
 * backend: esto es solo una ayuda visual y por eso vive junto a las etiquetas.
 */
export function multiplyDecimalStrings(...valores: string[]): string {
  let escala = 0;
  let producto = 1n;

  for (const valor of valores) {
    const limpio = valor.trim();
    if (limpio === "" || !/^\d+(\.\d+)?$/.test(limpio)) return "";
    const [entera = "0", decimal = ""] = limpio.split(".");
    escala += decimal.length;
    producto *= BigInt(entera + decimal);
  }

  const texto = producto.toString().padStart(escala + 1, "0");
  if (escala === 0) return texto;
  const corte = texto.length - escala;
  return `${texto.slice(0, corte)}.${texto.slice(corte)}`.replace(/\.?0+$/, "");
}
