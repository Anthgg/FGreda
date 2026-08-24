/**
 * Traduccion de errores del backend a mensajes utiles.
 *
 * El frontend no interpreta reglas: solo convierte el codigo que devuelve la
 * API en algo legible.
 */

import { ApiError, ErrorCode } from "@/api/client";

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
    default:
      return error.message;
  }
}

/** Convierte los detalles de validacion en una linea legible. */
function describeValidation(error: ApiError): string {
  if (!error.details.length) return error.message;
  return error.details
    .map((detail) =>
      detail.field ? `${detail.field}: ${detail.reason}` : detail.reason,
    )
    .join(". ");
}

/** True cuando el error se debe a una edicion concurrente. */
export function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.code === CONFLICT_CODE;
}
