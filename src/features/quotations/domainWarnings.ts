/**
 * Avisos de dominio del Cotizador, en castellano.
 *
 * El backend devuelve códigos —`FIRING_REQUIRED`, `RECIPE_REQUIRED`— y esos
 * códigos **siguen siendo la autoridad**: los usa la lógica, los tests, los
 * logs y la auditoría, y no se tocan. Lo que no puede es enseñárselos al
 * usuario: nadie tiene que conocer los nombres internos del backend para
 * entender qué le falta a su cotización.
 *
 * Un mensaje útil dice tres cosas: qué pasa, qué falta, y dónde arreglarlo.
 * «Falta la quema» no sirve si el usuario no sabe que la quema se configura en
 * el paso Producción.
 *
 * Catálogo único a propósito. La alternativa —un `if (code === ...)` en cada
 * componente— hace que el mismo aviso se explique distinto en dos pantallas y
 * que añadir un código nuevo obligue a recordar todos los sitios.
 */

/** Paso del Cotizador donde se corrige cada aviso, cuando aplica. */
export type CotizadorStep = "DATOS" | "PIEZAS" | "PRODUCCION" | "COSTEO";

interface DomainWarning {
  message: string;
  /** Dónde se arregla. Sólo si el paso existe y se puede navegar a él. */
  step?: CotizadorStep;
}

const CATALOG: Record<string, DomainWarning> = {
  QUOTATION_NAME_REQUIRED: {
    message: "Ponle un nombre o referencia a la cotización para poder guardarla.",
    step: "DATOS",
  },
  CUSTOMER_REQUIRED: {
    message: "Selecciona un cliente antes de continuar con la cotización.",
    step: "DATOS",
  },
  ITEM_REQUIRED: {
    message: "Agrega al menos un producto a la cotización.",
    step: "PIEZAS",
  },
  QUANTITY_REQUIRED: {
    message: "Indica cuántas piezas se van a producir.",
    step: "PRODUCCION",
  },
  PRODUCTION_DIMENSIONS_REQUIRED: {
    message:
      "Faltan medidas de la pieza. El largo, el ancho y el alto son necesarios " +
      "para calcular cuánto ocupa en el horno.",
    step: "PIEZAS",
  },
  FIRING_REQUIRED: {
    message:
      "Falta configurar la quema. Selecciona al menos una quema baja o una quema alta.",
    step: "PRODUCCION",
  },
  FIRING_KILN_REQUIRED: {
    message: "Elige el horno de cada quema que hayas seleccionado.",
    step: "PRODUCCION",
  },
  KILN_REQUIRED: {
    message: "Elige el horno con el que se va a cotizar esta pieza.",
    step: "PRODUCCION",
  },
  // No es «se pasó de capacidad»: el Cotizador planifica varias hornadas solo.
  // Este aviso aparece cuando ni siquiera repartiéndolo cabe.
  KILN_CAPACITY_EXCEEDED: {
    message:
      "La pieza no cabe en el horno elegido ni repartiéndola en varias hornadas. " +
      "Revisa las medidas o elige un horno más grande.",
    step: "PRODUCCION",
  },
  RECIPE_REQUIRED: {
    message: "Falta seleccionar una receta para este producto.",
    step: "PRODUCCION",
  },
  MATERIAL_GRAMS_PER_PIECE_REQUIRED: {
    message: "Indica cuántos gramos de material necesita cada pieza.",
    step: "PRODUCCION",
  },
  MATERIAL_WITHOUT_COST: {
    message:
      "Algún insumo de la receta no tiene costo registrado, así que el material " +
      "sale más barato de lo real. Revísalo en Productos.",
  },
  CUSTOM_DIMENSIONS_NOT_ALLOWED_FOR_CONFIRMED_FIRING: {
    message:
      "Esta pieza usa el costo de una quema ya confirmada, que se calculó con " +
      "las medidas reales de esa hornada. Para cambiar las medidas, quita la " +
      "línea de quema confirmada.",
    step: "PRODUCCION",
  },
  MIXED_TAX_RATES: {
    message:
      "La cotización mezcla productos con distinto IGV. El encabezado muestra " +
      "una tasa promedio; cada línea conserva la suya.",
  },
  GLAZE_PIECE_WEIGHT_REQUIRED: {
    message:
      "El producto no tiene gramaje en el maestro, así que no se puede estimar " +
      "el esmalte. Regístralo en Productos.",
    step: "PRODUCCION",
  },
  GLAZE_ML_REQUIRES_PREPARATION: {
    message:
      "Para ver el esmalte en mililitros hace falta elegir un lote preparado: " +
      "la concentración es de cada lote, no de la unidad.",
    step: "PRODUCCION",
  },
  IGV_RATE_NOT_CONFIGURED: {
    message:
      "No hay IGV configurado ni en el producto ni en Configuración → Comercial, " +
      "así que se está cotizando sin impuesto.",
  },
  FIRING_LINE_REQUIRED: {
    message: "Elige la línea de quema confirmada de la que sale el costo.",
    step: "PRODUCCION",
  },
};

/**
 * Devuelve el aviso legible de un código, o `null` si no está en el catálogo.
 *
 * `null` y no el código: enseñar `FOO_BAR_REQUIRED` sería exactamente lo que
 * esto viene a evitar. Quien llame decide si lo omite o usa un texto genérico.
 */
export function describeWarning(code: string): string | null {
  return CATALOG[code]?.message ?? null;
}

/** Paso del Cotizador donde se corrige el aviso, si lo hay. */
export function warningStep(code: string): CotizadorStep | null {
  return CATALOG[code]?.step ?? null;
}

/**
 * Traduce una lista de códigos, descartando los que no reconoce.
 *
 * Un código sin traducir no se muestra crudo. Se pierde información, sí, pero
 * la alternativa es enseñar jerga: el usuario no puede hacer nada con
 * `WHATEVER_REQUIRED` y sí puede con los avisos que sí entiende.
 */
export function describeWarnings(codes: readonly string[]): string[] {
  return codes.map(describeWarning).filter((message): message is string => message !== null);
}

/** True si el código es conocido. Para tests y para decidir el fallback. */
export function isKnownWarning(code: string): boolean {
  return code in CATALOG;
}
