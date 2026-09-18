/**
 * Fase 010I. Cómo se dicen en pantalla los estados, las clases de material y
 * los errores de la ejecución real de una orden V2.
 *
 * Es traducción y nada más: el backend decide y manda códigos estables; aquí
 * se convierten en frases. No se compara nunca el texto del mensaje del
 * backend, sólo su código.
 */

import { ApiError } from "@/api/client";
import { describeError } from "@/features/settings/messages";
import type {
  FiringKind,
  ProductionConsumptionKind,
  ProductionTimelineEventType,
} from "@/types/production";

const KIND_LABEL: Record<ProductionConsumptionKind, string> = {
  BODY: "Pasta",
  GLAZE: "Esmalte",
  OTHER: "Otro insumo",
};

export function describeConsumptionKind(kind: ProductionConsumptionKind): string {
  return KIND_LABEL[kind] ?? kind;
}

/** «pasta y esmalte», en minúscula para ir dentro de una frase. */
export function listaDeClases(kinds: readonly ProductionConsumptionKind[]): string {
  const nombres = kinds.map((kind) => describeConsumptionKind(kind).toLowerCase());
  if (nombres.length <= 1) return nombres.join("");
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

const FIRING_LABEL: Record<FiringKind, string> = {
  LOW: "Quema baja",
  HIGH: "Quema alta",
};

export function describeFiringKind(kind: FiringKind | null): string {
  return kind ? (FIRING_LABEL[kind] ?? kind) : "Quema";
}

const TIMELINE_LABEL: Record<ProductionTimelineEventType, string> = {
  STATUS: "Estado",
  CONSUMPTION: "Consumo real",
  NOTE: "Nota",
  FIRING_NOTE: "Quema",
  COMMUNICATION: "Comunicación registrada",
};

export function describeTimelineType(type: ProductionTimelineEventType): string {
  return TIMELINE_LABEL[type] ?? type;
}

/** Las clases que el backend dice que faltan, leídas del detalle del error. */
function clasesDelError(error: ApiError): ProductionConsumptionKind[] {
  return error.details
    .map((detalle) => (detalle as unknown as { kind?: string }).kind)
    .filter((kind): kind is ProductionConsumptionKind =>
      kind === "BODY" || kind === "GLAZE" || kind === "OTHER",
    );
}

/**
 * Dónde ocurrió el error. El mismo código se explica distinto según qué
 * intentaba hacer la persona: «no hay existencia» al registrar un consumo es
 * «no hay stock suficiente para ESTE consumo».
 */
export type ContextoProduccion = "consumo" | "nota" | "comunicacion" | "transicion";

export function describeProductionError(
  error: unknown,
  contexto: ContextoProduccion = "transicion",
): string {
  if (!(error instanceof ApiError)) return describeError(error);
  switch (error.code) {
    case "NEGATIVE_STOCK_NOT_ALLOWED":
      return contexto === "consumo"
        ? "No hay stock suficiente para registrar este consumo. Se volvió a leer el saldo: revíselo y ajuste la cantidad."
        : describeError(error);
    case "PRODUCTION_ORDER_NOT_CONSUMABLE":
      return (
        "Esta orden ya no admite consumos: sólo se registran en INICIO o EN " +
        "PROCESO, no en una orden finalizada o anulada."
      );
    case "PRODUCTION_CONSUMPTION_ORDER_NOT_V2":
      return "Esta orden descuenta su material al arrancar; no admite consumos a mano.";
    case "PRODUCTION_CONSUMPTION_MATERIAL_INVALID":
      return "Ese material no existe o está desactivado. Elija otro.";
    case "PRODUCTION_CONSUMPTION_LINE_INVALID":
      return "Esa pieza no pertenece a la cotización de esta orden.";
    case "PRODUCTION_ORDER_LOCATION_INVALID":
      return "El almacén elegido no existe o está desactivado.";
    case "PRODUCTION_CONSUMPTION_KEY_REUSED":
    case "PRODUCTION_NOTE_KEY_REUSED":
    case "PRODUCTION_COMMUNICATION_KEY_REUSED":
    case "PRODUCTION_ORDER_IDEMPOTENCY_KEY_REUSED":
      return (
        "Ese registro ya se había enviado con otros datos. Cierre el formulario " +
        "y vuelva a abrirlo para registrar uno nuevo."
      );
    case "PRODUCTION_ORDER_CONSUMPTION_MISSING": {
      const clases = clasesDelError(error);
      return clases.length
        ? `Falta registrar consumo real de: ${listaDeClases(clases)}. La orden no se finalizó.`
        : "Falta registrar el material real antes de finalizar. La orden no se finalizó.";
    }
    case "PRODUCTION_ORDER_HAS_CONSUMPTIONS":
      return (
        "La orden ya tiene material consumido y no puede anularse: anular no " +
        "devuelve el material al almacén. Si hubo un error, corríjalo con un " +
        "ajuste de inventario."
      );
    case "PRODUCTION_ORDER_NOT_COMPLETABLE":
      return "Sólo una orden EN PROCESO puede finalizarse.";
    case "PRODUCTION_ORDER_NOT_CANCELLABLE":
      return "Sólo una orden en INICIO puede anularse.";
    case "PRODUCTION_ORDER_NOT_STARTABLE":
      return "Esta orden ya no está en INICIO: no se puede iniciar otra vez.";
    case "PRODUCTION_ORDER_NOT_V2":
      return "El seguimiento con notas y comunicaciones es de las órdenes de cotizaciones V2.";
    case "PRODUCTION_NOTE_NOT_ALLOWED":
      return (
        "La orden no admite esta nota en su estado: una quema se registra desde " +
        "EN PROCESO, y una orden anulada no admite notas."
      );
    case "PRODUCTION_NOTE_KILN_INVALID":
      return "Ese horno no existe o está inactivo. Elija otro.";
    case "PRODUCTION_NOTE_OCCURRED_AT_INVALID":
    case "PRODUCTION_COMMUNICATION_SENT_AT_INVALID":
      return "La fecha debe estar entre la creación de la orden y ahora.";
    case "PRODUCTION_ORDER_V2_NOT_SENT":
      return "La cotización V2 todavía no se envió a producción.";
    case "PRODUCTION_ORDER_V2_FINGERPRINT_MISMATCH":
      return "La cotización V2 cambió desde que se envió a producción. Vuelva a cargarla.";
    default:
      return describeError(error);
  }
}

/**
 * Textos de partida. Son ayuda de PANTALLA y nada más: no hay catálogo en el
 * backend, no se guarda de cuál se partió y lo que se registra es el texto
 * final tal como quede.
 */
export const MENSAJES_SUGERIDOS: readonly { etiqueta: string; texto: string }[] = [
  { etiqueta: "En producción", texto: "Hola, tu pedido ya está en producción." },
  { etiqueta: "En proceso", texto: "Hola, tu pedido se encuentra en proceso." },
  { etiqueta: "En quema", texto: "Hola, tus piezas entraron a quema." },
  { etiqueta: "Listo", texto: "Hola, tu pedido está listo. Puedes pasar a recogerlo." },
];
