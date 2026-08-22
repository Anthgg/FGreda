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
    default:
      return error.message;
  }
}

/** Convierte los detalles de validacion en una linea legible. */
function describeValidation(error: ApiError): string {
  if (!error.details.length) return error.message;
  return error.details
    .map((detail) => (detail.field ? `${detail.field}: ${detail.reason}` : detail.reason))
    .join(". ");
}

/** True cuando el error se debe a una edicion concurrente. */
export function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.code === CONFLICT_CODE;
}
