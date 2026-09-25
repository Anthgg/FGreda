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
 * Se trabaja sobre la cadena y se redondea a la mitad hacia arriba con
 * `BigInt`, que es lo que hace la hoja de cálculo del negocio: 23.356401 se
 * muestra como 23.36, no como 23.35. Truncar daría importes un céntimo por
 * debajo y quien comparase con el documento vería una diferencia.
 */
export function formatDecimalString(value: string | null | undefined, decimals: number): string {
  if (value === null || value === undefined || value === "") return "—";
  const limpio = sinExponente(value.trim());
  if (!/^-?\d*(\.\d+)?$/.test(limpio)) return "—";

  const negative = limpio.startsWith("-");
  const cuerpo = negative ? limpio.slice(1) : limpio;
  const [enteraCruda = "0", decimalCruda = ""] = cuerpo.split(".");
  const entera = enteraCruda === "" ? "0" : enteraCruda;

  // Un digito de mas para poder mirar el que decide el redondeo.
  const relleno = decimalCruda.padEnd(decimals + 1, "0");
  const conservados = relleno.slice(0, decimals);
  const siguiente = relleno.charCodeAt(decimals) - 48;

  let digitos = BigInt(entera + conservados);
  if (siguiente >= 5) digitos += 1n;

  const texto = digitos.toString().padStart(decimals + 1, "0");
  const corte = texto.length - decimals;
  const signo = negative && digitos !== 0n ? "-" : "";

  if (decimals <= 0) return `${signo}${texto}`;
  return `${signo}${texto.slice(0, corte)}.${texto.slice(corte)}`;
}

/**
 * «0E-12» → «0.000000000000». Un `Decimal` de Python que resulta de multiplicar
 * por cero se serializa en notación científica (el costo de una persona del
 * taller: horas × 0), y leído tal cual el importe salía «—». Se desplaza la coma
 * sobre la cadena, sin pasar por coma flotante. Lo que no es notación científica
 * vuelve igual.
 */
function sinExponente(texto: string): string {
  const partes = /^(-?)(\d*)(?:\.(\d*))?[eE]([+-]?\d+)$/.exec(texto);
  if (!partes) return texto;
  const [, signo = "", entera = "", fraccion = "", exponenteCrudo = "0"] = partes;
  if (entera === "" && fraccion === "") return texto;
  const exponente = Number(exponenteCrudo);
  if (!Number.isSafeInteger(exponente) || Math.abs(exponente) > 400) return texto;
  const digitos = `${entera}${fraccion}`;
  const coma = entera.length + exponente;
  if (coma <= 0) return `${signo}0.${"0".repeat(-coma)}${digitos}`;
  if (coma >= digitos.length) return `${signo}${digitos}${"0".repeat(coma - digitos.length)}`;
  return `${signo}${digitos.slice(0, coma)}.${digitos.slice(coma)}`;
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
