/**
 * Helper de formateo decimal basado exclusivamente en manipulacion de strings.
 *
 * Nunca convierte valores de negocio a IEEE-754 (Float/Number) para evitar
 * perdida de precision en decimales de alta escala como 0.016906843137 o
 * porcentajes precisos.
 */

/**
 * Recorta ceros sobrantes al final de un decimal y opcionalmente limita los
 * decimales para visualizacion.
 */
export function formatDecimal(
  value: string | null | undefined,
  maxDecimals?: number,
): string {
  if (value === null || value === undefined || value === "") return "—";
  const str = String(value).trim();
  if (!str.includes(".")) {
    return str;
  }
  const parts = str.split(".");
  const integerPart = parts[0] ?? "0";
  const decimalPart = parts[1] ?? "";
  if (!decimalPart) return integerPart;

  if (maxDecimals !== undefined) {
    const sliced = decimalPart.slice(0, maxDecimals);
    const cleaned = sliced.replace(/0+$/, "");
    return cleaned ? `${integerPart}.${cleaned}` : integerPart;
  }
  const cleaned = decimalPart.replace(/0+$/, "");
  return cleaned ? `${integerPart}.${cleaned}` : integerPart;
}

/**
 * Suma una lista de valores decimales representados como string con precision
 * fija de 4 decimales sin usar parseFloat.
 */
export function sumDecimalStrings(values: string[]): string {
  let totalScaled = 0n;
  const SCALE = 10000n;

  for (const raw of values) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const parts = trimmed.split(".");
    const intPart = parts[0] ? BigInt(parts[0]) : 0n;
    let fracPartStr = (parts[1] || "").slice(0, 4);
    while (fracPartStr.length < 4) {
      fracPartStr += "0";
    }
    const fracPart = BigInt(fracPartStr);
    const sign = trimmed.startsWith("-") ? -1n : 1n;
    const valueScaled = intPart * SCALE + fracPart * sign;
    totalScaled += valueScaled;
  }

  const isNeg = totalScaled < 0n;
  const absVal = isNeg ? -totalScaled : totalScaled;
  const intResult = absVal / SCALE;
  const fracResult = absVal % SCALE;
  const fracStr = fracResult.toString().padStart(4, "0").replace(/0+$/, "");

  const resStr = fracStr ? `${intResult}.${fracStr}` : `${intResult}`;
  return isNeg ? `-${resStr}` : resStr;
}
