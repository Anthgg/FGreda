/**
 * Helpers matemáticos y de coordenadas para el layout físico del horno.
 *
 * Convención M2 del Backend:
 * --------------------------
 * - (x_cm, y_cm) representa la esquina inferior izquierda del ÁREA RESERVADA.
 * - Eje X: 0 -> kiln_width_cm (ancho del horno, izquierda a derecha).
 * - Eje Y: 0 -> kiln_depth_cm (profundidad del horno, frente a fondo).
 * - En SVG: el origen (0, 0) está en la esquina superior izquierda.
 *   Por lo tanto, la coordenada vertical del SVG para la esquina superior izquierda
 *   del rectángulo es: svg_y = kiln_depth_cm - (y_cm + reserved_y_size).
 * - Al convertir de vuelta: y_cm = kiln_depth_cm - (svg_y + reserved_y_size).
 */

export interface ReservedFootprint {
  x_size: number;
  y_size: number;
  z_size: number;
  piece_x: number;
  piece_y: number;
  piece_z: number;
  separation: number;
}

export interface BoundingBoxCm {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

export function getReservedFootprint(
  pieceLength: number | string,
  pieceWidth: number | string,
  pieceHeight: number | string,
  separation: number | string,
  rotationDegrees: number,
): ReservedFootprint {
  const len = Number(pieceLength);
  const wid = Number(pieceWidth);
  const hgt = Number(pieceHeight);
  const sep = Number(separation);

  const reservedLength = len + sep;
  const reservedWidth = wid + sep;
  const reservedHeight = hgt + sep;

  let x_size: number;
  let y_size: number;
  let piece_x: number;
  let piece_y: number;

  if (rotationDegrees === 0) {
    x_size = reservedLength;
    y_size = reservedWidth;
    piece_x = len;
    piece_y = wid;
  } else if (rotationDegrees === 90) {
    x_size = reservedWidth;
    y_size = reservedLength;
    piece_x = wid;
    piece_y = len;
  } else {
    // Si llegara rotación distinta, default a 0
    x_size = reservedLength;
    y_size = reservedWidth;
    piece_x = len;
    piece_y = wid;
  }

  return {
    x_size,
    y_size,
    z_size: reservedHeight,
    piece_x,
    piece_y,
    piece_z: hgt,
    separation: sep,
  };
}

/**
 * Convierte coordenada Y de backend (origen inferior) a coordenada SVG (origen superior).
 * Retorna la coordenada Y de la esquina superior del rectángulo SVG.
 */
export function cmToSvgY(y_cm: number, reserved_y_size: number, kiln_depth: number): number {
  return kiln_depth - (y_cm + reserved_y_size);
}

/**
 * Convierte coordenada Y de SVG (esquina superior) a coordenada Y de backend (esquina inferior).
 */
export function svgToCmY(svg_y: number, reserved_y_size: number, kiln_depth: number): number {
  return kiln_depth - (svg_y + reserved_y_size);
}

/**
 * Redondea y normaliza un número a máximo 6 decimales para ajustarse al tipo Numeric(18,6) del backend.
 * Evita drift acumulativo y notación científica o ceros innecesarios.
 */
export function toDecimal6(val: number | string): string {
  const num = typeof val === "number" ? val : Number(val);
  if (Number.isNaN(num)) return "0";
  // Redondeo exacto a 6 decimales
  const factor = 1_000_000;
  const rounded = Math.round((num + Number.EPSILON) * factor) / factor;
  return rounded.toString();
}

/**
 * Verifica si el área reservada de una pieza cabe completamente dentro de los límites del horno.
 */
export function checkPlacementBounds(
  x_cm: number,
  y_cm: number,
  x_size: number,
  y_size: number,
  kiln_width: number,
  kiln_depth: number,
): boolean {
  const eps = 1e-6;
  if (x_cm < -eps || y_cm < -eps) return false;
  if (x_cm + x_size > kiln_width + eps) return false;
  if (y_cm + y_size > kiln_depth + eps) return false;
  return true;
}

/**
 * Verifica si dos cajas delimitadoras en el mismo nivel colisionan (se solapan en su interior).
 * El contacto adyacente en el borde exacto está permitido.
 */
export function checkCollision(boxA: BoundingBoxCm, boxB: BoundingBoxCm): boolean {
  const eps = 1e-6;
  if (boxA.right <= boxB.left + eps || boxA.left >= boxB.right - eps) return false;
  if (boxA.top <= boxB.bottom + eps || boxA.bottom >= boxB.top - eps) return false;
  return true;
}

/**
 * Verifica si la altura reservada de una pieza excede la altura útil del nivel.
 */
export function checkHeightExceeded(
  pieceHeight: number | string,
  separation: number | string,
  usableHeight: number | string,
): boolean {
  const eps = 1e-6;
  const totalHeight = Number(pieceHeight) + Number(separation);
  return totalHeight > Number(usableHeight) + eps;
}

/**
 * Paleta de colores accesibles y estilos deterministas por orden para no depender únicamente del color.
 */
export interface OrderStyle {
  bgClass: string;
  fillColor: string;
  strokeColor: string;
  textColor: string;
  borderStyle: "solid" | "dashed" | "double";
  hatchPattern: string;
  badgeTone: "neutral" | "positive" | "warning" | "danger";
}

const ORDER_STYLES: OrderStyle[] = [
  {
    bgClass: "bg-sky-100/90",
    fillColor: "#0284c7",
    strokeColor: "#0369a1",
    textColor: "text-sky-950",
    borderStyle: "solid",
    hatchPattern: "none",
    badgeTone: "neutral",
  },
  {
    bgClass: "bg-emerald-100/90",
    fillColor: "#059669",
    strokeColor: "#047857",
    textColor: "text-emerald-950",
    borderStyle: "dashed",
    hatchPattern: "diagonal",
    badgeTone: "positive",
  },
  {
    bgClass: "bg-amber-100/90",
    fillColor: "#d97706",
    strokeColor: "#b45309",
    textColor: "text-amber-950",
    borderStyle: "solid",
    hatchPattern: "dots",
    badgeTone: "warning",
  },
  {
    bgClass: "bg-purple-100/90",
    fillColor: "#9333ea",
    strokeColor: "#7e22ce",
    textColor: "text-purple-950",
    borderStyle: "double",
    hatchPattern: "cross",
    badgeTone: "neutral",
  },
  {
    bgClass: "bg-rose-100/90",
    fillColor: "#e11d48",
    strokeColor: "#be123c",
    textColor: "text-rose-950",
    borderStyle: "solid",
    hatchPattern: "horizontal",
    badgeTone: "danger",
  },
  {
    bgClass: "bg-indigo-100/90",
    fillColor: "#4f46e5",
    strokeColor: "#4338ca",
    textColor: "text-indigo-950",
    borderStyle: "dashed",
    hatchPattern: "vertical",
    badgeTone: "neutral",
  },
  {
    bgClass: "bg-teal-100/90",
    fillColor: "#0d9488",
    strokeColor: "#0f766e",
    textColor: "text-teal-950",
    borderStyle: "double",
    hatchPattern: "grid",
    badgeTone: "positive",
  },
  {
    bgClass: "bg-orange-100/90",
    fillColor: "#ea580c",
    strokeColor: "#c2410c",
    textColor: "text-orange-950",
    borderStyle: "solid",
    hatchPattern: "none",
    badgeTone: "warning",
  },
];

export function getOrderStyle(key: number | string): OrderStyle {
  const str = String(key);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % ORDER_STYLES.length;
  return ORDER_STYLES[index]!;
}
