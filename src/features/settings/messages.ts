/**
 * Traduccion de errores del backend a mensajes utiles.
 *
 * El frontend no interpreta reglas: solo convierte el codigo que devuelve la
 * API en algo legible.
 */

import { ApiError, ErrorCode } from "@/api/client";
import { describeWarning } from "@/features/quotations/domainWarnings";

export const CONFLICT_CODE = "SETTINGS_VERSION_CONFLICT";

export function describeError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Ocurrio un error inesperado. Intente nuevamente.";
  }
  if (error.isUnreachable) {
    return "No se pudo conectar con el servidor. Verifique su conexion e intente de nuevo.";
  }

  switch (error.code) {
    case CONFLICT_CODE:
      return (
        "Otra persona modifico esta configuracion mientras usted editaba. " +
        "Recargue para ver los cambios y vuelva a aplicar los suyos."
      );
    case "AUTH_INSUFFICIENT_ROLE":
      return "Su rol no permite modificar esta configuracion.";
    case ErrorCode.NOT_AUTHENTICATED:
    case ErrorCode.SESSION_EXPIRED:
      return "Su sesion expiro. Vuelva a iniciar sesion.";
    case "LOGO_EMPTY":
      return "El archivo esta vacio.";
    case "LOGO_TOO_LARGE":
      return error.message;
    case "LOGO_TYPE_NOT_ALLOWED":
      return "Formato no admitido. Use PNG, JPG o WEBP.";
    case "LOGO_TYPE_MISMATCH":
    case "LOGO_EXTENSION_MISMATCH":
      return "El archivo no corresponde a su extension. Verifique la imagen.";
    case "STORAGE_NOT_CONFIGURED":
      return "El almacenamiento de archivos no esta configurado en el servidor.";
    case "VALIDATION_ERROR":
      return describeValidation(error);

    // El backend responde este codigo cuando la ruta no existe. Visto desde la
    // pantalla parece que el modulo esta roto, cuando casi siempre significa
    // que la aplicacion apunta a un backend que no tiene esa version de la API.
    case "NOT_FOUND":
      return (
        "El servidor no reconoce esta ruta. Verifique que la aplicacion apunte " +
        "al backend correcto."
      );

    case "MASTER_NOT_FOUND":
      return "El registro ya no existe. Actualice la lista.";
    case "MASTER_VALUE_EXISTS":
      return "Ya existe un registro con esa clave.";
    case "MASTER_INVALID_REFERENCE":
      return "Alguna referencia enviada no existe en los catalogos.";
    case "NEGATIVE_STOCK_NOT_ALLOWED":
      return "El movimiento dejaria existencia negativa.";
    case "PRODUCT_WITHOUT_UOM":
      return "El producto no tiene unidad de medida y no puede llevar existencia.";
    case "IMPORT_FILE_INVALID":
      return "El archivo no se pudo leer como Excel.";
    case "IMPORT_BATCH_NOT_FOUND":
      return "La importacion ya no existe.";
    case "IMPORT_INVALID_STATE":
      return "La importacion no admite esta operacion en su estado actual.";
    case "IMPORT_ROWS_PENDING":
      return error.message;
    case "INVALID_DNI":
    case "INVALID_RUC":
      return error.message;
    case "IDENTITY_NOT_FOUND":
      return "No se encontro informacion para ese documento.";
    case "IDENTITY_LOOKUP_UNAVAILABLE":
      return "La consulta no esta disponible en este momento. Intente mas tarde.";

    // ---- Fase 009E: costeo comercial ---------------------------------
    // El backend ya manda estos con texto humano, pero se fijan aqui para
    // que un cambio de redaccion alla no se lleve por delante la pantalla.
    case "QUOTATION_BUILDER_NOT_EDITABLE":
      return "Esta cotizacion ya no es un borrador, asi que sus precios quedaron fijados.";
    case "QUOTATION_BUILDER_CONFLICT":
      return (
        "Otra persona modifico este borrador mientras usted trabajaba. " +
        "Vuelva a cargarlo para ver los cambios."
      );
    case "QUOTATION_BUILDER_SOURCE_CHANGED":
      return (
        "Algun costo cambio desde el ultimo calculo. Guarde el recalculo antes " +
        "de confirmar para que el precio corresponda a los costos de hoy."
      );
    case "QUOTATION_BUILDER_INCOMPLETE":
      return "Faltan datos en alguna linea. Revise los avisos de cada producto.";
    case "FIXED_COST_ALLOCATION_BASE_ZERO":
      return (
        "Ningun producto tiene costo, asi que no hay sobre que repartir los " +
        "gastos fijos. Revise recetas, quemas y mano de obra."
      );
    case "PRODUCT_PRICE_UPDATE_NOT_ALLOWED":
      return "No se puede cambiar el precio del maestro desde la cotizacion.";

    default:
      return safeFallback(error.message);
  }
}

/**
 * Ultimo filtro antes de la pantalla.
 *
 * Para casi todos los codigos el backend manda una frase util y se muestra tal
 * cual. Pero un codigo que nadie mapeo puede llegar con el mensaje vacio o con
 * el propio codigo por texto, y ninguna de esas dos cosas ayuda a nadie:
 * `FIXED_COST_ALLOCATION_BASE_ZERO` no le dice al usuario que hacer. En ese
 * caso se prefiere una frase generica y honesta.
 */
function safeFallbackOrNull(message: string): string | null {
  const texto = message.trim();
  // «Value error, X» es envoltura de Pydantic: sin la X util, no dice nada.
  const sinEnvoltura = texto.replace(/^Value error,\s*/i, "").trim();
  if (!sinEnvoltura) return null;
  if (/^[A-Z][A-Z0-9_]{5,}$/.test(sinEnvoltura)) return null;
  return sinEnvoltura;
}

function safeFallback(message: string): string {
  const texto = message.trim();
  const pareceCodigo = /^[A-Z][A-Z0-9_]{5,}$/.test(texto);
  if (!texto || pareceCodigo) {
    return "No se pudo completar la operacion. Intente nuevamente.";
  }
  return texto;
}

/** Convierte los detalles de validacion en una linea legible. */
function describeValidation(error: ApiError): string {
  if (!error.details.length) return safeFallback(error.message);
  const legibles = error.details.map(describeDetail).filter((texto) => texto !== null);
  if (!legibles.length) {
    return "Faltan datos o hay valores fuera de rango. Revisa el formulario.";
  }
  return legibles.join(". ");
}

/**
 * Un motivo de validacion, dicho en castellano.
 *
 * Pydantic devuelve el texto de la excepcion, y cuando el backend valida con
 * `raise ValueError("EXCHANGE_RATE_REQUIRED")` ese texto llega como
 * «Value error, EXCHANGE_RATE_REQUIRED». Concatenarlo tal cual metia el codigo
 * en pantalla por una puerta lateral: el aviso humano ya estaba puesto, pero
 * el error del recalculo lo enseñaba igual justo debajo.
 *
 * Se busca el codigo dentro del texto y se traduce con el mismo catalogo
 * central que el resto; si no se reconoce, se descarta.
 */
function describeDetail(detail: { field?: string | null; reason: string }): string | null {
  const codigo = detail.reason.match(/[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+/)?.[0];
  const traducido = codigo ? describeWarning(codigo) : null;
  if (traducido) return traducido;
  const limpio = safeFallbackOrNull(detail.reason);
  if (limpio === null) return null;
  return detail.field ? `${detail.field}: ${limpio}` : limpio;
}

/** True cuando el error se debe a una edicion concurrente. */
export function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.code === CONFLICT_CODE;
}
