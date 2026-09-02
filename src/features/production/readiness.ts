/**
 * Cómo se dice en pantalla que una orden no puede arrancar.
 *
 * Es traducción y nada más. El backend decide si la orden está lista y por qué
 * no lo está; aquí se convierte su código en una frase. La cuenta —cuánto hace
 * falta, cuánto hay, si alcanza— **no se rehace en el navegador**: una segunda
 * implementación de la regla es una segunda regla, y el día que discrepen
 * ganaría la que no consume material.
 */

import type {
  ProductionOrderStatus,
  ProductionReadinessCode,
  ReadinessIssue,
} from "@/types/production";

const STATUS_LABEL: Record<ProductionOrderStatus, string> = {
  CREATED: "Creada",
  STARTED: "En proceso",
  COMPLETED: "Completada",
  CANCELLED: "Anulada",
};

const STATUS_TONE: Record<ProductionOrderStatus, "warning" | "positive" | "neutral"> = {
  CREATED: "warning",
  STARTED: "warning",
  COMPLETED: "positive",
  CANCELLED: "neutral",
};

export function describeStatus(status: ProductionOrderStatus): string {
  return STATUS_LABEL[status];
}

export function statusTone(
  status: ProductionOrderStatus,
): "warning" | "positive" | "neutral" {
  return STATUS_TONE[status];
}

const ISSUE_LABEL: Record<ProductionReadinessCode, string> = {
  MISSING_RECIPE: "Falta asignar receta o material preparado",
  MISSING_MATERIAL_GRAMS: "Falta el consumo de material por pieza",
  MISSING_QUANTITY: "La línea no tiene cantidad",
  PREPARED_PRODUCT_NOT_RESOLVABLE: "La receta no lleva a un material preparado utilizable",
  PREPARED_STOCK_MISSING: "No hay existencia del material preparado",
  INSUFFICIENT_STOCK: "Stock insuficiente",
  UNSUPPORTED_UOM_CONVERSION: "No se puede convertir la unidad con los datos disponibles",
  INVALID_STOCK_LOCATION: "El almacén de la orden ya no sirve para descontar",
};

export function describeIssue(issue: ReadinessIssue): string {
  return ISSUE_LABEL[issue.code] ?? "La orden no puede arrancar todavía";
}

/**
 * La explicación larga, cuando el código por sí solo no basta.
 *
 * Se devuelve `null` si no hay nada que añadir: repetir el título con otras
 * palabras no ayuda a nadie a desbloquear la orden.
 */
export function explainIssue(issue: ReadinessIssue): string | null {
  switch (issue.code) {
    case "MISSING_RECIPE":
      return (
        "La cotización no dice qué material lleva esta pieza. No se deduce " +
        "del precio ni de las medidas: hay que asignarle una receta."
      );
    case "MISSING_MATERIAL_GRAMS":
      return "Hay receta, pero nadie indicó cuántos gramos lleva cada pieza.";
    case "PREPARED_PRODUCT_NOT_RESOLVABLE":
      return "La receta apunta a un producto que no es un material preparado.";
    case "PREPARED_STOCK_MISSING":
      return "Ese material no se ha preparado nunca en este almacén.";
    case "UNSUPPORTED_UOM_CONVERSION":
      return (
        "El material se lleva en una unidad distinta de los gramos que pide " +
        "la receta, y la equivalencia depende del lote concreto de preparación."
      );
    case "INSUFFICIENT_STOCK":
    case "MISSING_QUANTITY":
    case "INVALID_STOCK_LOCATION":
      return null;
  }
}

/**
 * Cuánto hace falta y cuánto hay, tal como lo mandó el backend.
 *
 * Las cantidades viajan como texto y aquí se muestran como texto. Convertirlas
 * a número para «formatearlas» perdería decimales en cuanto un requerimiento
 * tenga más de los que aguanta un `number`.
 */
export function describeShortfall(issue: ReadinessIssue): string | null {
  if (issue.required_quantity === null || issue.available_quantity === null) return null;
  const unidad = issue.uom ? ` ${issue.uom}` : "";
  return `Necesita ${issue.required_quantity}${unidad} · disponible ${issue.available_quantity}${unidad}`;
}

/** Los bloqueos que afectan a UNA línea concreta. */
export function issuesForLine(issues: ReadinessIssue[], lineId: number): ReadinessIssue[] {
  return issues.filter((issue) => issue.production_order_line_id === lineId);
}

/**
 * Los bloqueos de existencia, que no son de ninguna línea en particular.
 *
 * Dos líneas que piden el mismo preparado comparten un saldo y un veredicto:
 * repetir el aviso en cada una haría creer que son dos faltantes distintos.
 */
export function stockIssues(issues: ReadinessIssue[]): ReadinessIssue[] {
  return issues.filter((issue) => issue.production_order_line_id === null);
}

/**
 * Si procede ofrecer cada acción.
 *
 * Esto NO es la autoridad: el backend rechaza cualquier transición ilegal
 * aunque el botón llegara a aparecer. Aquí sólo se evita ofrecer algo que se
 * sabe que va a fallar.
 */
export function canStart(status: ProductionOrderStatus, ready: boolean): boolean {
  return status === "CREATED" && ready;
}

export function canComplete(status: ProductionOrderStatus): boolean {
  return status === "STARTED";
}

/**
 * Anular sólo antes de arrancar.
 *
 * Una orden arrancada ya gastó material, y anularla no lo devuelve. Si hubo un
 * error, se corrige con un ajuste de inventario, que deja su propio
 * responsable.
 */
export function canCancel(status: ProductionOrderStatus): boolean {
  return status === "CREATED";
}
