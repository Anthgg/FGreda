/**
 * Los códigos del ciclo de vida V2, en palabras de taller. Fase 010H.
 *
 * El backend manda CÓDIGOS —«V2_CONFIRM_KILN_REQUIRED»— porque no sabe en qué
 * pantalla se leerán. Un código sin traducir en una pantalla de dinero no le
 * dice a nadie qué hacer, así que cada uno lleva su frase y, cuando existe, el
 * paso del asistente donde se arregla.
 *
 * Un código desconocido NO se muestra crudo: cae en una frase genérica. La
 * prueba de este módulo recorre la lista exacta de códigos del backend.
 */

import type { PasoId } from "@/features/cotizadorV2/pasos";

export interface Pendiente {
  readonly mensaje: string;
  readonly paso: PasoId | null;
}

export const BLOQUEOS_DE_EMISION: Record<string, Pendiente> = {
  V2_CONFIRM_CUSTOMER_REQUIRED: { mensaje: "Falta elegir el cliente.", paso: "cliente" },
  V2_CONFIRM_CUSTOMER_INACTIVE: {
    mensaje: "El cliente está archivado o ya no tiene rol de cliente. Elija otro.",
    paso: "cliente",
  },
  V2_CONFIRM_NO_LINES: { mensaje: "No hay ningún producto.", paso: "productos" },
  V2_CONFIRM_LINE_PRODUCT_REQUIRED: {
    mensaje: "Un producto no tiene nombre.",
    paso: "productos",
  },
  V2_CONFIRM_LINE_QUANTITY_REQUIRED: {
    mensaje: "Un producto no tiene cantidad.",
    paso: "productos",
  },
  V2_CONFIRM_LINE_BODY_MATERIAL_REQUIRED: {
    mensaje: "Un producto no tiene pasta elegida.",
    paso: "materiales",
  },
  V2_CONFIRM_LINE_BODY_WEIGHT_REQUIRED: {
    mensaje: "Un producto no tiene peso de pasta por pieza.",
    paso: "materiales",
  },
  V2_CONFIRM_LINE_PROCESS_REQUIRED: {
    mensaje: "Una pieza de catálogo no tiene todos sus procesos requeridos.",
    paso: "mano-de-obra",
  },
  V2_CONFIRM_PROCESS_WORKER_REQUIRED: {
    mensaje: "Un proceso no tiene trabajador asignado.",
    paso: "mano-de-obra",
  },
  V2_CONFIRM_LINE_LABOR_REQUIRED: {
    mensaje: "Una pieza no tiene mano de obra: nadie la fabrica.",
    paso: "mano-de-obra",
  },
  V2_CONFIRM_LINE_PRICE_REQUIRED: {
    mensaje: "Un producto quedó sin precio unitario.",
    paso: "precio",
  },
  V2_CONFIRM_FACTOR_REQUIRED: { mensaje: "Falta el factor comercial.", paso: "precio" },
  V2_CONFIRM_FACTOR_OUT_OF_RANGE: {
    mensaje: "El factor comercial está fuera del rango permitido.",
    paso: "precio",
  },
  V2_CONFIRM_TAX_REQUIRED: {
    mensaje: "La cotización no tiene IGV. Revise la configuración comercial.",
    paso: null,
  },
  V2_CONFIRM_ROUNDING_REQUIRED: {
    mensaje: "La cotización no tiene redondeo comercial. Revise la configuración comercial.",
    paso: null,
  },
  V2_CONFIRM_CURRENCY_REQUIRED: { mensaje: "Falta la moneda.", paso: "cliente" },
  V2_CONFIRM_EXCHANGE_RATE_REQUIRED: {
    mensaje: "Falta el tipo de cambio para cotizar en moneda extranjera.",
    paso: "cliente",
  },
  V2_CONFIRM_VALIDITY_INVALID: {
    mensaje: "La vigencia de la cotización no es válida. Revise la configuración del Cotizador V2.",
    paso: null,
  },
  V2_CONFIRM_WORK_DAYS_REQUIRED: {
    mensaje: "Faltan los días efectivos de taller.",
    paso: "mano-de-obra",
  },
  V2_CONFIRM_KILN_REQUIRED: { mensaje: "Falta elegir el horno.", paso: "quema" },
  V2_CONFIRM_TOTAL_REQUIRED: { mensaje: "El total de la cotización es cero.", paso: "precio" },
};

export function describirBloqueo(codigo: string): Pendiente {
  return (
    BLOQUEOS_DE_EMISION[codigo] ?? {
      mensaje: "Hay un dato pendiente que impide emitir.",
      paso: null,
    }
  );
}

/** Lo que la duplicación no pudo traer porque el maestro de hoy ya no lo admite. */
export const AVISOS_DE_DUPLICACION: Record<string, string> = {
  V2_DUPLICATE_CUSTOMER_UNAVAILABLE: "El cliente está archivado: elija uno nuevo.",
  V2_DUPLICATE_PRODUCT_UNAVAILABLE: "Un producto ya no está activo y no se copió.",
  V2_DUPLICATE_BODY_MATERIAL_UNAVAILABLE:
    "Una pasta ya no está disponible: el producto se copió sin pasta.",
  V2_DUPLICATE_GLAZE_MATERIAL_UNAVAILABLE:
    "Un esmalte elegido ya no está disponible: se usa el esmalte de referencia.",
  V2_DUPLICATE_KILN_UNAVAILABLE: "El horno anterior ya no está activo: se usa el sugerido.",
  V2_DUPLICATE_LABOR_UNAVAILABLE:
    "Una tarea de mano de obra no se copió (trabajador o técnica inactivos).",
  V2_DUPLICATE_ILLUSTRATION_UNAVAILABLE: "La ilustración no se pudo copiar.",
  V2_DUPLICATE_PLANNING_UNAVAILABLE: "Los días efectivos no se copiaron: vuelva a decidirlos.",
};

export function describirAvisoDeDuplicacion(codigo: string, nombre: string | null): string {
  const frase = AVISOS_DE_DUPLICACION[codigo] ?? "Algo de la cotización original no se copió.";
  return nombre ? `${frase} (${nombre})` : frase;
}

export const EVENTOS_DE_HISTORIAL: Record<string, string> = {
  CREATED: "Creada",
  CONFIRMED: "Emitida",
  CANCELLED: "Anulada",
  DUPLICATED: "Duplicada en una cotización nueva",
  DUPLICATED_FROM: "Creada al duplicar otra cotización",
  SENT_TO_PRODUCTION: "Enviada a producción",
};

export function describirEvento(evento: string): string {
  return EVENTOS_DE_HISTORIAL[evento] ?? "Cambio registrado";
}
