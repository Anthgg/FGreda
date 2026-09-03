import { ApiError } from "@/api/client";
import type { PrototypeApproval, PrototypeIssue, PrototypeStatus } from "@/types/prototypes";

export const statusLabel: Record<PrototypeStatus, string> = {
  CREATED: "Creado",
  STARTED: "En fabricación",
  COMPLETED: "Completado",
  CANCELLED: "Anulado",
};

export const approvalLabel: Record<PrototypeApproval, string> = {
  PENDING: "Pendiente de evaluación",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
};

export function describePrototypeIssue(issue: PrototypeIssue): string {
  switch (issue.code) {
    case "INVALID_STATE":
      return "El estado actual no permite iniciar la fabricación.";
    case "NO_QUOTATION":
      return "Vincula una cotización pagada antes de iniciar la fabricación.";
    case "QUOTATION_UNPAID":
      return "La cotización vinculada está pendiente de pago.";
    case "NO_STOCK_LOCATION":
      return "Selecciona el almacén del que saldrán los materiales.";
    case "NO_MATERIALS":
      return "Añade al menos un material físico al prototipo.";
    case "STOCK_MISSING":
      return `${issue.product_name ?? "El material"} no tiene existencia en este almacén.`;
    case "INSUFFICIENT_STOCK":
      return `${issue.product_name ?? "Material"}: se requieren ${issue.required_quantity ?? "—"} ${issue.uom ?? ""} y hay ${issue.available_quantity ?? "0"} ${issue.uom ?? ""}.`;
  }
}

export function describePrototypeError(error: unknown): string {
  if (!(error instanceof ApiError)) return "Ocurrió un error inesperado. Intente nuevamente.";
  if (error.isUnreachable) return "No se pudo conectar con el servidor. Verifique su conexión.";
  switch (error.code) {
    case "PROTOTYPE_NOT_FOUND": return "El prototipo ya no existe. Actualice la lista.";
    case "PROTOTYPE_NOT_EDITABLE": return "Solo se puede editar un prototipo que todavía no ha arrancado.";
    case "PROTOTYPE_NOT_STARTABLE": return "El prototipo ya no está en un estado que permita arrancarlo.";
    case "PROTOTYPE_NOT_READY": return "Aún faltan condiciones para fabricar. Revise cada causa de disponibilidad.";
    case "PROTOTYPE_NOT_COMPLETABLE": return "Solo un prototipo en fabricación puede completarse.";
    case "PROTOTYPE_NOT_DECIDABLE": return "Solo un prototipo completado y pendiente puede evaluarse.";
    case "PROTOTYPE_NOT_CANCELLABLE": return "Una muestra ya iniciada no puede anularse: el material ya fue consumido.";
    case "PROTOTYPE_MATERIAL_NOT_CONSUMABLE": return "Elija una materia prima o un material preparado.";
    case "PROTOTYPE_MATERIAL_DUPLICATED": return "Un material no puede repetirse en el mismo prototipo.";
    case "PROTOTYPE_MATERIAL_WITHOUT_UOM": return "El material no tiene unidad base y no puede descontarse.";
    case "PROTOTYPE_PRODUCT_NOT_IN_QUOTATION": return "El producto elegido no pertenece a la cotización vinculada.";
    case "PROTOTYPE_LINEAGE_INVALID": return "No se puede crear esta iteración desde el prototipo elegido.";
    case "PROTOTYPE_ALREADY_SUPERSEDED": return "Este prototipo ya tiene una iteración posterior.";
    case "AUTH_INSUFFICIENT_ROLE": return "Su rol no permite realizar esta acción.";
    case "VALIDATION_ERROR": return "Revise los campos ingresados.";
    default: return "No se pudo completar la operación. Revise los datos e intente nuevamente.";
  }
}

