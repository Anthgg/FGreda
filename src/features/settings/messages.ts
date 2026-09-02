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

    // ---- Fase 009I: ordenes de produccion ----------------------------
    case "PRODUCTION_ORDER_NOT_FOUND":
      return "La orden de produccion ya no existe. Actualice la lista.";
    case "PRODUCTION_ORDER_QUOTATION_NOT_CONFIRMED":
      return (
        "Solo una cotizacion confirmada puede originar una orden. Un borrador " +
        "todavia se edita y una anulada ya no se fabrica."
      );
    case "PRODUCTION_ORDER_LOCATION_INVALID":
      return "El almacen elegido no existe o esta desactivado.";
    case "PRODUCTION_ORDER_NOT_STARTABLE":
      return "Esta orden ya no esta en un estado que permita arrancarla.";
    // El detalle de POR QUE no puede arrancar no se saca de aqui: viaja en la
    // disponibilidad de la propia orden, que la pantalla vuelve a pedir tras el
    // intento fallido y muestra material por material.
    case "PRODUCTION_ORDER_NOT_READY":
      return (
        "Falta algo para poder producir. No se descontó ningún material: " +
        "revise la disponibilidad de abajo."
      );
    // Fase 009H.1. Dice qué falta y quién puede resolverlo: quien está en el
    // taller no cobra, así que "pendiente de pago" sin más lo dejaría mirando
    // una pantalla sin saber a quién acudir.
    case "PRODUCTION_ORDER_QUOTATION_NOT_PAID":
      return (
        "La cotización debe estar pagada para iniciar la producción. " +
        "Registre el cobro en la cotización de origen."
      );
    case "PRODUCTION_ORDER_NOT_COMPLETABLE":
      return "Solo una orden que ya arranco puede marcarse como completada.";
    case "PRODUCTION_ORDER_NOT_CANCELLABLE":
      return (
        "Una orden que ya arranco no se puede anular: el material consumido no " +
        "vuelve al almacen. Corrijalo con un ajuste de inventario."
      );
    // `NEGATIVE_STOCK_NOT_ALLOWED` ya esta traducido mas arriba, con el
    // inventario: es el mismo error mire quien lo mire.

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
 * Nombre visible de un campo, a partir de la ruta que manda el backend.
 *
 * Pydantic identifica el campo por su ruta en el payload —
 * `items.1.dimensions.depth`— y eso es exacto para depurar e inútil en
 * pantalla: dice en qué posición del JSON está el problema, no qué casilla
 * hay que corregir. El índice se convierte en «Producto 2» porque el usuario
 * cuenta desde uno, no desde cero.
 */
function describeField(field: string | null | undefined): string | null {
  if (!field) return null;
  const partes = field.split(".");
  const indice = partes.findIndex((parte) => /^\d+$/.test(parte));
  const producto = indice >= 0 ? `Producto ${Number(partes[indice]) + 1}` : null;
  const nombre = FIELD_LABELS[partes[partes.length - 1] ?? ""] ?? null;
  if (!nombre) return producto;
  return producto ? `${producto} · ${nombre}` : nombre;
}

/** Cómo se llama cada campo en la pantalla, no en el payload. */
const FIELD_LABELS: Record<string, string> = {
  width: "Ancho",
  height: "Alto",
  length: "Largo",
  depth: "Profundidad",
  quantity: "Cantidad",
  markup_percent: "Margen",
  exchange_rate: "Tipo de cambio",
  currency_code: "Moneda",
  material_grams_per_piece: "Gramos por pieza",
  materials_applied: "Costo de materiales",
  commercial_sale_unit_price: "Precio neto manual",
  production_factor: "Factor de producción",
  name: "Nombre",
  customer_id: "Cliente",
  product_id: "Producto",
  recipe_id: "Receta",
  kiln_id: "Horno",
  days_adjustment: "Ajuste de días",
  waiting_days: "Días de espera",
  tax_percent: "IGV",
  rounding_step: "Redondeo contractual",
};

/**
 * El motivo de Pydantic, dicho en castellano.
 *
 * Los mensajes por defecto vienen en inglés («Input should be greater than
 * 0»). Mostrarlos tal cual deja media frase en otro idioma en una aplicación
 * que por lo demás habla español, y el usuario tiene que adivinar.
 */
const REASON_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/Input should be greater than or equal to (.+)/i, "debe ser $1 o más"],
  [/Input should be less than or equal to (.+)/i, "no puede pasar de $1"],
  [/Input should be greater than (.+)/i, "debe ser mayor que $1"],
  [/Input should be less than (.+)/i, "debe ser menor que $1"],
  [/Field required/i, "es obligatorio"],
  [/Input should be a valid (integer|number|decimal)/i, "debe ser un número"],
  [/Input should be a valid string/i, "debe ser texto"],
  [/Input should be a valid boolean/i, "debe ser sí o no"],
  [/String should have at most (\d+) characters/i, "no puede pasar de $1 caracteres"],
  [/String should have at least (\d+) characters/i, "necesita al menos $1 caracteres"],
  [/Decimal input should have no more than (\d+) decimal places/i,
    "admite como mucho $1 decimales"],
  [/Input should be '?([A-Z]{3})'? or '?([A-Z]{3})'?/,
    "sólo admite $1 o $2"],
  [/Extra inputs are not permitted/i, "no se admite aquí"],
  [/value is not a valid/i, "no tiene un valor válido"],
];

function describeReason(reason: string): string | null {
  const texto = reason.replace(/^Value error,\s*/i, "").trim();
  if (!texto) return null;
  for (const [patron, plantilla] of REASON_PATTERNS) {
    const encontrado = texto.match(patron);
    if (encontrado) {
      return plantilla.replace(/\$(\d)/g, (_, n: string) => encontrado[Number(n)] ?? "");
    }
  }
  // Un motivo que ya viene en castellano se respeta; uno que parece un código
  // interno se descarta antes que enseñar jerga.
  if (/^[A-Z][A-Z0-9_]{5,}$/.test(texto)) return null;
  return texto;
}

/**
 * Un motivo de validación, dicho en castellano y con el campo que le toca.
 *
 * Pydantic devuelve el texto de la excepción, y cuando el backend valida con
 * `raise ValueError("EXCHANGE_RATE_REQUIRED")` ese texto llega como «Value
 * error, EXCHANGE_RATE_REQUIRED». Concatenarlo tal cual metía el código en
 * pantalla por una puerta lateral: el aviso humano ya estaba puesto, pero el
 * error del recálculo lo enseñaba igual justo debajo.
 *
 * Se busca el código dentro del texto y se traduce con el mismo catálogo
 * central que el resto; si no se reconoce, se traduce el motivo de Pydantic;
 * si tampoco, se descarta.
 */
function describeDetail(detail: { field?: string | null; reason: string }): string | null {
  const codigo = detail.reason.match(/[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+/)?.[0];
  const traducido = codigo ? describeWarning(codigo) : null;
  if (traducido) return traducido;
  const motivo = describeReason(detail.reason);
  if (motivo === null) return null;
  const campo = describeField(detail.field);
  return campo ? `${campo}: ${motivo}` : motivo;
}

/** True cuando el error se debe a una edicion concurrente. */
export function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.code === CONFLICT_CODE;
}
