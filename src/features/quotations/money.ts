/**
 * Formateo de importes con su moneda. Único sitio del frontend que decide
 * cómo se escribe el dinero.
 *
 * Antes de 009F había cinco `money()` distintos y catorce `"S/"` escritos a
 * mano. Mientras todo estaba en soles daba igual; en cuanto una cotización se
 * emite en dólares, cada uno de esos catorce sitios es un lugar donde un
 * importe en dólares puede aparecer encabezado por `S/`. El número sería
 * correcto y la etiqueta mentiría, que es la peor combinación posible.
 *
 * Aquí NO se calcula nada. El backend es la autoridad de la conversión, del
 * IGV, del redondeo y de los totales; esto sólo elige un símbolo y coloca los
 * decimales.
 */

import { formatDecimalString } from "@/features/firings/labels";

/** Monedas en las que se puede emitir una cotización. */
export type CurrencyCode = "PEN" | "USD";

/**
 * Símbolo por moneda.
 *
 * `US$` y no `$`: en Perú un `$` suelto se lee como sol tan a menudo como como
 * dólar, y aquí la diferencia es de casi cuatro a uno. Un símbolo ambiguo en
 * un documento que el cliente firma no es un detalle de estilo.
 */
const SYMBOLS: Record<string, string> = {
  PEN: "S/",
  USD: "US$",
};

/**
 * El símbolo de una moneda.
 *
 * Si el backend congeló un símbolo en la cotización se respeta ese, porque una
 * confirmada tiene que verse igual el año que viene aunque cambie esta tabla.
 * Para lo demás manda el código: `currency_code` es la autoridad semántica y
 * el símbolo es presentación.
 */
export function currencySymbol(
  code: string | null | undefined,
  snapshot?: string | null,
): string {
  if (snapshot) return snapshot;
  if (!code) return SYMBOLS.PEN as string;
  return SYMBOLS[code] ?? code;
}

/**
 * Un importe con su moneda, listo para pintar.
 *
 * El valor llega como cadena decimal desde el backend y se formatea como
 * cadena: convertirlo a `number` para mostrarlo es el primer paso hacia
 * sumarlo con `+`, y ahí es donde el dinero pierde céntimos.
 */
export function formatMoney(
  value: string | null | undefined,
  code: string | null | undefined,
  options: { symbolSnapshot?: string | null; decimals?: number } = {},
): string {
  const symbol = currencySymbol(code, options.symbolSnapshot);
  return `${symbol} ${formatDecimalString(value, options.decimals ?? 2)}`;
}

/**
 * La frase que explica el tipo de cambio, en la dirección correcta.
 *
 * «1 USD = S/ 3.75» y no «3.75» a secas, porque el número solo no dice si hay
 * que multiplicar o dividir, y esa es exactamente la duda que hace que alguien
 * cotice cuatro veces de más.
 */
export function exchangeRateLabel(rate: string | null | undefined): string | null {
  if (!rate) return null;
  return `1 USD = ${formatMoney(rate, "PEN")}`;
}

/** Nombre visible de la moneda, para etiquetas y selectores. */
export const CURRENCY_LABEL: Record<CurrencyCode, string> = {
  PEN: "Soles (S/)",
  USD: "Dólares (US$)",
};

/** Opciones del selector de moneda del Cotizador. */
export const CURRENCY_OPTIONS = [
  { value: "PEN", label: CURRENCY_LABEL.PEN },
  { value: "USD", label: CURRENCY_LABEL.USD },
];
