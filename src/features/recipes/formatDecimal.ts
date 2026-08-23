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
 * Suma una lista de valores decimales representados como string con precisión
 * fija configurable (por defecto 6 decimales) sin usar parseFloat ni Number.
 */
export function sumDecimalStrings(
  values: (string | null | undefined)[],
  scale: number = 6,
): string {
  let totalScaled = 0n;
  const multiplier = 10n ** BigInt(scale);

  for (const raw of values) {
    if (raw === null || raw === undefined) continue;
    const trimmed = String(raw).trim();
    if (!trimmed) continue;

    const isNegative = trimmed.startsWith("-");
    const cleanStr = isNegative ? trimmed.slice(1) : trimmed;
    const parts = cleanStr.split(".");
    const intPart = parts[0] ? BigInt(parts[0]) : 0n;
    let fracPartStr = (parts[1] || "").slice(0, scale);
    while (fracPartStr.length < scale) {
      fracPartStr += "0";
    }
    const fracPart = BigInt(fracPartStr || "0");
    const valueScaled = intPart * multiplier + fracPart;
    totalScaled += isNegative ? -valueScaled : valueScaled;
  }

  const isNeg = totalScaled < 0n;
  const absVal = isNeg ? -totalScaled : totalScaled;
  const intResult = absVal / multiplier;
  const fracResult = absVal % multiplier;
  const fracStr = fracResult.toString().padStart(scale, "0").replace(/0+$/, "");

  const resStr = fracStr ? `${intResult}.${fracStr}` : `${intResult}`;
  return isNeg ? `-${resStr}` : resStr;
}

/**
 * Suma dos valores decimales en formato string.
 */
export function addDecimalStrings(
  a: string | null | undefined,
  b: string | null | undefined,
  scale: number = 6,
): string {
  return sumDecimalStrings([a, b], scale);
}
