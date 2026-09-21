/**
 * Fase 010I. Aritmética EXACTA de cantidades de inventario, sólo para mostrar.
 *
 * El backend manda las cantidades como texto con hasta doce decimales. Pasarlas
 * a `number` para restar perdería precisión justo en los saldos pequeños —un
 * esmalte de 0,1 g—, así que se opera con enteros grandes a escala fija.
 *
 * Nada de esto decide: el saldo de verdad lo calcula el backend al registrar.
 * Aquí sólo se estima lo que quedaría, para que la persona lo vea antes de
 * confirmar.
 */

const ESCALA = 12;
const FACTOR = 10n ** BigInt(ESCALA);

/** Si el texto es un decimal positivo o cero bien escrito («12», «0.5»). */
export function esDecimalValido(texto: string): boolean {
  return /^\d+(\.\d+)?$/.test(texto.trim());
}

/** Si es un decimal ESTRICTAMENTE positivo. */
export function esPositivo(texto: string): boolean {
  return esDecimalValido(texto) && aEscalado(texto) > 0n;
}

function aEscalado(texto: string): bigint {
  const limpio = texto.trim();
  const negativo = limpio.startsWith("-");
  const sinSigno = negativo ? limpio.slice(1) : limpio;
  const [entera = "0", fraccion = ""] = sinSigno.split(".");
  const fraccionAjustada = (fraccion + "0".repeat(ESCALA)).slice(0, ESCALA);
  const valor = BigInt(entera || "0") * FACTOR + BigInt(fraccionAjustada || "0");
  return negativo ? -valor : valor;
}

function desdeEscalado(valor: bigint): string {
  const negativo = valor < 0n;
  const absoluto = negativo ? -valor : valor;
  const entera = absoluto / FACTOR;
  const fraccion = (absoluto % FACTOR).toString().padStart(ESCALA, "0").replace(/0+$/, "");
  const texto = fraccion ? `${entera}.${fraccion}` : `${entera}`;
  return negativo ? `-${texto}` : texto;
}

/** `a - b`, exacto. */
export function restar(a: string, b: string): string {
  return desdeEscalado(aEscalado(a) - aEscalado(b));
}

/** Suma exacta de una lista. */
export function sumar(valores: readonly string[]): string {
  return desdeEscalado(valores.reduce((total, valor) => total + aEscalado(valor), 0n));
}

/** Si `a < 0`. */
export function esNegativo(a: string): boolean {
  return aEscalado(a) < 0n;
}

/** Quita los ceros de relleno del backend: «450.000000000000» → «450». */
export function normalizar(texto: string | null | undefined): string {
  if (texto === null || texto === undefined || texto === "") return "—";
  if (!/^-?\d+(\.\d+)?$/.test(texto.trim())) return texto;
  return desdeEscalado(aEscalado(texto));
}
