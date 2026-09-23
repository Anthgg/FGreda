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

import type {
  KilnBatchLayoutLevelIn,
  KilnBatchLayoutPlacementIn,
} from "@/types/kilnBatches";

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

/**
 * Genera una huella canónica determinista del borrador para idempotencia en reintentos de guardado.
 */
export function canonicalLayoutFingerprint(
  expectedVersion: number,
  levels: KilnBatchLayoutLevelIn[],
  placements: KilnBatchLayoutPlacementIn[],
): string {
  const sortedLevels = [...levels].sort((a, b) => a.level_index - b.level_index);
  const sortedPlacements = [...placements].sort((a, b) => {
    if (a.batch_assignment_id !== b.batch_assignment_id) {
      return a.batch_assignment_id - b.batch_assignment_id;
    }
    if (a.group_index !== b.group_index) {
      return a.group_index - b.group_index;
    }
    if (a.level_index !== b.level_index) {
      return a.level_index - b.level_index;
    }
    if (a.x_cm !== b.x_cm) {
      return a.x_cm.localeCompare(b.x_cm);
    }
    return a.y_cm.localeCompare(b.y_cm);
  });
  return JSON.stringify({
    expected_version: expectedVersion,
    levels: sortedLevels,
    placements: sortedPlacements,
  });
}

export interface LevelMoveValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Valida si una pieza cabe físicamente en un nivel destino:
 * 1. Altura reservada <= altura útil del nivel destino.
 * 2. Límites del horno (si las dimensiones del horno están configuradas).
 * 3. Colisión con otras piezas en el nivel destino en la misma posición (x, y).
 */
export function validateLevelMove(
  placement: {
    id?: string | number | undefined;
    x_cm: string | number;
    y_cm: string | number;
    piece_length_cm_snapshot: string | number;
    piece_width_cm_snapshot: string | number;
    piece_height_cm_snapshot: string | number;
    separation_cm_snapshot: string | number;
    rotation_degrees: number;
  },
  targetLevel: KilnBatchLayoutLevelIn,
  otherPlacementsInTargetLevel: Array<{
    id?: string | number | undefined;
    x_cm: string | number;
    y_cm: string | number;
    piece_length_cm_snapshot: string | number;
    piece_width_cm_snapshot: string | number;
    piece_height_cm_snapshot: string | number;
    separation_cm_snapshot: string | number;
    rotation_degrees: number;
  }>,
  kilnWidth: number,
  kilnDepth: number,
): LevelMoveValidationResult {
  const fp = getReservedFootprint(
    placement.piece_length_cm_snapshot,
    placement.piece_width_cm_snapshot,
    placement.piece_height_cm_snapshot,
    placement.separation_cm_snapshot,
    placement.rotation_degrees,
  );

  const destUsableHeight = Number(targetLevel.usable_height_cm);
  if (fp.z_size > destUsableHeight) {
    return {
      valid: false,
      error: `La pieza no cabe en ese nivel: la altura de la pieza (${fp.z_size} cm) supera la altura útil del nivel (${destUsableHeight} cm).`,
    };
  }

  const xNum = Number(placement.x_cm);
  const yNum = Number(placement.y_cm);

  if (kilnWidth > 0 && kilnDepth > 0) {
    const inBounds = checkPlacementBounds(xNum, yNum, fp.x_size, fp.y_size, kilnWidth, kilnDepth);
    if (!inBounds) {
      return {
        valid: false,
        error: `La pieza no cabe en ese nivel: excede los límites físicos del horno en la posición (${xNum}, ${yNum}) cm.`,
      };
    }
  }

  const targetBox = {
    left: xNum,
    right: xNum + fp.x_size,
    bottom: yNum,
    top: yNum + fp.y_size,
  };

  for (const other of otherPlacementsInTargetLevel) {
    if (other.id === placement.id) continue;
    const otherFp = getReservedFootprint(
      other.piece_length_cm_snapshot,
      other.piece_width_cm_snapshot,
      other.piece_height_cm_snapshot,
      other.separation_cm_snapshot,
      other.rotation_degrees,
    );
    const otherBox = {
      left: Number(other.x_cm),
      right: Number(other.x_cm) + otherFp.x_size,
      bottom: Number(other.y_cm),
      top: Number(other.y_cm) + otherFp.y_size,
    };
    if (checkCollision(targetBox, otherBox)) {
      return {
        valid: false,
        error: `La pieza no cabe en ese nivel: colisiona con otra pieza existente en la posición (${xNum}, ${yNum}) cm.`,
      };
    }
  }

  return { valid: true };
}

export interface KilnDimensionsResult {
  width: number;
  depth: number;
  height: number;
  isValid: boolean;
}

/**
 * Extrae y valida las dimensiones físicas reales del horno a partir del layout
 * o del contrato del batch/kiln para la creación inicial.
 * Rechaza 0, negativos, NaN, undefined y null.
 */
export function extractKilnDimensions(
  layout?: {
    kiln_width_cm_snapshot?: string | null;
    kiln_depth_cm_snapshot?: string | null;
    kiln_height_cm_snapshot?: string | null;
  } | null,
  batch?: {
    kiln_width_cm_snapshot?: string | null;
    kiln_depth_cm_snapshot?: string | null;
    kiln_height_cm_snapshot?: string | null;
    usable_width_cm?: string | null;
    usable_depth_cm?: string | null;
    usable_height_cm?: string | null;
    kiln?: {
      usable_width_cm?: string | null;
      usable_depth_cm?: string | null;
      usable_height_cm?: string | null;
    } | null;
  } | null,
): KilnDimensionsResult {
  let wStr = layout?.kiln_width_cm_snapshot;
  let dStr = layout?.kiln_depth_cm_snapshot;
  let hStr = layout?.kiln_height_cm_snapshot;

  if (!wStr || Number(wStr) <= 0) {
    wStr =
      batch?.kiln_width_cm_snapshot ??
      batch?.usable_width_cm ??
      batch?.kiln?.usable_width_cm ??
      undefined;
  }
  if (!dStr || Number(dStr) <= 0) {
    dStr =
      batch?.kiln_depth_cm_snapshot ??
      batch?.usable_depth_cm ??
      batch?.kiln?.usable_depth_cm ??
      undefined;
  }
  if (!hStr || Number(hStr) <= 0) {
    hStr =
      batch?.kiln_height_cm_snapshot ??
      batch?.usable_height_cm ??
      batch?.kiln?.usable_height_cm ??
      undefined;
  }

  const width = Number(wStr);
  const depth = Number(dStr);
  const height = Number(hStr);

  const isValid =
    !isNaN(width) &&
    width > 0 &&
    !isNaN(depth) &&
    depth > 0 &&
    !isNaN(height) &&
    height > 0;

  return {
    width: isValid ? width : 0,
    depth: isValid ? depth : 0,
    height: isValid ? height : 0,
    isValid,
  };
}


