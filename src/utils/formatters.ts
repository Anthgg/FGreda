/**
 * Utilidades de formateo para la presentación visual del Cotizador V2.
 * 
 * Centraliza la forma en que se presentan los importes, horas, volúmenes,
 * porcentajes y números generales, sin alterar los tipos numéricos de la base.
 * Garantiza que `5.8500000` se vea como `S/ 5.85` o `5.85` dependiendo del contexto.
 */

/**
 * Formatea un importe monetario.
 * Asegura que se muestre con dos decimales y su símbolo correspondiente.
 * 
 * @param value Valor numérico (ej. "2695.850000")
 * @param currencyCode Código de moneda (ej. "PEN" o "USD")
 */
export function formatMoney(value: string | number | null | undefined, currencyCode: string = "PEN"): string {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);

  // Formato "en-US" usa comas para miles y puntos para decimales.
  const formatted = new Intl.NumberFormat("en-US", {
    useGrouping: false, minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);

  if (currencyCode === "PEN") {
    return `S/ ${formatted}`;
  } else if (currencyCode === "USD") {
    return `US$ ${formatted}`;
  }
  return `${currencyCode} ${formatted}`;
}

/**
 * Formatea un porcentaje.
 *
 * @param value Valor numérico (ej. "70.941285")
 * @param fractionDigits Cantidad máxima de decimales a mostrar (por defecto 2)
 */
export function formatPercent(value: string | number | null | undefined, fractionDigits: number = 2): string {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);

  const formatted = new Intl.NumberFormat("en-US", {
    useGrouping: false, minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits
  }).format(num);

  return `${formatted} %`;
}

/**
 * Formatea un número técnico eliminando ceros innecesarios a la derecha, pero
 * respetando los miles.
 *
 * @param value Valor numérico (ej. "1.250000", "24200.00")
 */
export function formatNumber(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);

  return new Intl.NumberFormat("en-US", {
    useGrouping: false, maximumFractionDigits: 6
  }).format(num);
}

/**
 * Formatea volúmenes (cm³).
 */
export function formatVolume(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);

  return `${new Intl.NumberFormat("en-US", { useGrouping: false, maximumFractionDigits: 2 }).format(num)} cm³`;
}

/**
 * Formatea horas de trabajo.
 */
export function formatHours(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);

  return `${new Intl.NumberFormat("en-US", { useGrouping: false, maximumFractionDigits: 2 }).format(num)} h`;
}

/**
 * Formatea medidas o dimensiones (cm).
 */
export function formatDimension(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);

  return `${new Intl.NumberFormat("en-US", { useGrouping: false, maximumFractionDigits: 2 }).format(num)} cm`;
}
