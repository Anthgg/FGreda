/**
 * Los siete pasos del Cotizador V2 y cuándo cada uno está listo.
 *
 * Fase 010G. Hasta aquí los módulos existían y funcionaban, pero apilados: la
 * ficha mostraba cinco paneles a la vez y quien cotizaba tenía que saber en qué
 * orden mirarlos. Esto los convierte en un camino.
 *
 * ## Tres severidades, no dos
 *
 * La diferencia no es cosmética, es lo que decide si alguien puede seguir
 * trabajando:
 *
 * - **error** — falta un dato sin el cual el paso no significa nada. Un
 *   producto sin piezas no es un producto. Impide avanzar;
 * - **aviso** — algo que conviene mirar y que NO impide cotizar. Un esmalte de
 *   referencia sin existencia es legítimo: cotizar no consume stock, y
 *   bloquear aquí dejaría el borrador muerto por una decisión de almacén;
 * - **recomendación** — el sistema ve una alternativa mejor y la dice. «Esto
 *   cabe en un horno más chico» es una frase, no una orden.
 *
 * Convertir cada aviso en bloqueo es la forma más rápida de que nadie pueda
 * usar el sistema; convertir cada error en aviso es la forma más rápida de
 * emitir una cotización sin cliente.
 *
 * ## El paso actual vive en la URL
 *
 * No se persiste en la base —no hace falta una migración para guardar un número
 * que se puede inferir— y así el botón «atrás» del navegador funciona, recargar
 * no pierde el sitio y compartir un enlace lleva al mismo lugar. Si el paso de
 * la URL no existe, se cae al primero que esté incompleto.
 */

import type { V2Firing } from "@/types/quoterV2Firing";
import type { V2LaborPage } from "@/types/quoterV2Labor";
import type { V2QuotationProductsPage } from "@/types/quoterV2Materials";
import type { V2Pricing } from "@/types/quoterV2Pricing";
import type { V2Quotation } from "@/types/quoterV2";

export const PASOS = [
  { id: "cliente", titulo: "Cliente", detalle: "A quién se cotiza y en qué moneda." },
  { id: "productos", titulo: "Productos", detalle: "Qué piezas, cuántas y de qué medida." },
  { id: "materiales", titulo: "Materiales", detalle: "Pasta y esmalte de cada pieza." },
  { id: "mano-de-obra", titulo: "Mano de obra", detalle: "Técnicas, horas, ilustración y días." },
  { id: "quema", titulo: "Quema", detalle: "Horno, hornadas y gas." },
  { id: "precio", titulo: "Margen y precio", detalle: "Costo, factor y totales." },
  { id: "resumen", titulo: "Resumen", detalle: "Todo junto, antes de emitir." },
] as const;

export type PasoId = (typeof PASOS)[number]["id"];

export type Severidad = "error" | "aviso" | "recomendacion";

export interface Senal {
  readonly severidad: Severidad;
  readonly mensaje: string;
}

export interface EstadoPaso {
  readonly id: PasoId;
  /** Si falta algo imprescindible. Impide avanzar. */
  readonly completo: boolean;
  readonly senales: readonly Senal[];
}

/** Los datos que hacen falta para juzgar el estado de los siete pasos. */
export interface DatosDelFlujo {
  readonly cotizacion: V2Quotation | undefined;
  readonly productos: V2QuotationProductsPage | undefined;
  readonly manoDeObra: V2LaborPage | undefined;
  readonly quema: V2Firing | undefined;
  readonly precio: V2Pricing | undefined;
}

/**
 * Un paso cuyos datos todavia no han llegado NO esta completo.
 *
 * Parece obvio y no lo era: como cada validacion colgaba de `if (dato && ...)`,
 * un `undefined` —la primera pintada, o una peticion que fallo— dejaba la lista
 * de senales vacia y el paso se daba por bueno. El resumen llegaba a anunciar
 * que una cotizacion sin horno, sin dias y sin factor podia emitirse.
 *
 * Se dice una vez aqui en vez de repetir la comprobacion en los siete sitios,
 * que es justo como se cuela el octavo.
 */
const sinDatos = (id: PasoId): EstadoPaso => ({
  id,
  completo: false,
  senales: [{ severidad: "error", mensaje: "Todavia no se pudo leer este paso." }],
});

const error = (mensaje: string): Senal => ({ severidad: "error", mensaje });
const aviso = (mensaje: string): Senal => ({ severidad: "aviso", mensaje });
const recomendacion = (mensaje: string): Senal => ({ severidad: "recomendacion", mensaje });

/**
 * Los avisos del backend que en este flujo son RECOMENDACIONES y no problemas.
 *
 * El backend devuelve una lista plana de códigos porque no sabe en qué pantalla
 * se van a leer. Aquí se les da severidad: «cabe en un horno más chico» es una
 * sugerencia y «no hay tarifas configuradas» es algo que alguien tiene que ir a
 * arreglar.
 */
const RECOMENDACIONES = new Set([
  "V2_FIRING_SMALLER_KILN_FITS",
  "V2_FIRING_LARGER_KILN_SUGGESTED",
]);

function esPositivo(valor: string | null | undefined): boolean {
  return valor !== null && valor !== undefined && Number(valor) > 0;
}

function pasoCliente(datos: DatosDelFlujo): EstadoPaso {
  const ctz = datos.cotizacion;
  if (!ctz) return sinDatos("cliente");
  const senales: Senal[] = [];
  if (ctz.customer_id === null) {
    senales.push(error("Falta el cliente de la cotización."));
  }
  if (ctz.currency_code !== "PEN" && !esPositivo(ctz.exchange_rate)) {
    // En moneda extranjera el tipo de cambio es obligatorio: sin él la
    // cotización no puede convertirse y el motor tendría que leer el de hoy,
    // que es justo lo que los snapshots impiden.
    senales.push(error("En moneda extranjera hace falta el tipo de cambio."));
  }
  return { id: "cliente", completo: !senales.some((s) => s.severidad === "error"), senales };
}

function pasoProductos(datos: DatosDelFlujo): EstadoPaso {
  if (!datos.productos) return sinDatos("productos");
  const senales: Senal[] = [];
  const lineas = datos.productos.items;
  if (lineas.length === 0) {
    senales.push(error("Añada al menos un producto."));
  }
  if (lineas.some((linea) => linea.quantity <= 0)) {
    senales.push(error("Alguna línea no tiene piezas."));
  }
  if (lineas.some((linea) => Number(linea.total_volume_cm3) <= 0)) {
    // Sin medidas la pieza no ocupa horno, y entonces la quema no se le
    // reparte. Se avisa y no se bloquea: medir después es legítimo.
    senales.push(aviso("Alguna pieza no tiene medidas y no ocupará horno."));
  }
  return { id: "productos", completo: !senales.some((s) => s.severidad === "error"), senales };
}

function pasoMateriales(datos: DatosDelFlujo): EstadoPaso {
  if (!datos.productos) return sinDatos("materiales");
  const senales: Senal[] = [];
  const lineas = datos.productos.items;
  const sinPasta = lineas.filter((linea) => linea.body_material_id === null).length;
  if (lineas.length > 0 && sinPasta === lineas.length) {
    senales.push(error("Ninguna pieza tiene pasta asignada."));
  } else if (sinPasta > 0) {
    // Que UNA pieza se quede sin pasta no bloquea —puede ser comprada y solo
    // quemada— pero costearia sus materiales en cero sin que nada lo dijera.
    senales.push(
      aviso(
        sinPasta === 1
          ? "Una pieza no tiene pasta asignada: sus materiales cuestan cero."
          : `${sinPasta} piezas no tienen pasta asignada: sus materiales cuestan cero.`,
      ),
    );
  }
  for (const linea of lineas) {
    if (linea.warnings.includes("V2_GLAZE_REFERENCE_WITHOUT_STOCK")) {
      // Cotizar NO consume existencia: el esmalte sin stock sirve como
      // referencia de costeo y producción elegirá el real.
      senales.push(aviso("El esmalte de referencia no tiene existencia. No impide cotizar."));
      break;
    }
  }
  if (lineas.some((linea) => linea.body_material_id !== null && !esPositivo(linea.body_unit_weight)))
    senales.push(aviso("Alguna pieza tiene pasta pero no dice cuánta lleva."));
  return { id: "materiales", completo: !senales.some((s) => s.severidad === "error"), senales };
}

function pasoManoDeObra(datos: DatosDelFlujo): EstadoPaso {
  const pagina = datos.manoDeObra;
  if (!pagina) return sinDatos("mano-de-obra");
  const senales: Senal[] = [];
  if (pagina.items.length === 0) {
    // Una cotización sin mano de obra es rara pero no imposible: una pieza
    // comprada y solo quemada existe. Se avisa.
    senales.push(aviso("No hay trabajo asignado todavía."));
  }
  if (pagina.workday_load.some((carga) => carga.exceeds_workday)) {
    senales.push(
      aviso("A alguien se le asignaron más horas de las que caben en su jornada. Usted decide."),
    );
  }
  if (pagina.effective_work_days === null) {
    // Sin días efectivos no entra el espacio, y el precio sale corto. Es una
    // decisión humana: el sistema sugiere el mínimo y no elige.
    senales.push(error("Falta decidir los días efectivos de taller."));
  } else if (pagina.effective_work_days === 0) {
    // Cero es una decisión válida —un encargo que no ocupa taller— pero deja el
    // costo de espacio en cero, y eso se dice en vez de pasar callando.
    senales.push(aviso("Con cero días efectivos no se cobra nada por el espacio."));
  }
  return { id: "mano-de-obra", completo: !senales.some((s) => s.severidad === "error"), senales };
}

function pasoQuema(datos: DatosDelFlujo): EstadoPaso {
  const quema = datos.quema;
  if (!quema) return sinDatos("quema");
  const senales: Senal[] = [];
  if (quema.kiln_id === null) {
    senales.push(error("Elija el horno de la cotización."));
  }
  for (const codigo of quema.warnings) {
    if (codigo === "V2_FIRING_KILN_NOT_SELECTED") continue;
    if (codigo === "V2_FIRING_RATES_MISSING") {
      senales.push(error("El horno no tiene tarifas configuradas: la quema costearía cero."));
      continue;
    }
    if (codigo === "V2_FIRING_NO_PROCESS_SELECTED") {
      senales.push(error("No hay ninguna quema seleccionada: ni baja ni alta."));
      continue;
    }
    senales.push(
      RECOMENDACIONES.has(codigo)
        ? recomendacion(MENSAJE_QUEMA[codigo] ?? codigo)
        : aviso(MENSAJE_QUEMA[codigo] ?? codigo),
    );
  }
  return { id: "quema", completo: !senales.some((s) => s.severidad === "error"), senales };
}

const MENSAJE_QUEMA: Record<string, string> = {
  V2_FIRING_OVER_CAPACITY: "La carga supera el horno: se necesita más de una hornada.",
  V2_FIRING_RETAIL_OVER_CAPACITY:
    "Marcada como Por menor y supera la capacidad. Decida usted: mantenerla, cambiar de horno o pasarla a Por mayor.",
  V2_FIRING_SMALLER_KILN_FITS: "Esta producción cabe en un horno más chico.",
  V2_FIRING_LARGER_KILN_SUGGESTED: "Se recomienda un horno más grande.",
  V2_FIRING_KILN_UNAVAILABLE: "El horno se dio de baja después. El costo sigue siendo el congelado.",
  V2_FIRING_NO_VOLUME: "Ninguna pieza tiene medidas, así que la carga del horno es cero.",
  V2_FIRING_LINE_WITHOUT_DIMENSIONS: "Alguna línea no tiene medidas y no ocupa horno.",
};

function pasoPrecio(datos: DatosDelFlujo): EstadoPaso {
  const precio = datos.precio;
  if (!precio) return sinDatos("precio");
  const senales: Senal[] = [];
  if (precio.commercial_factor === null) {
    senales.push(error("Elija el factor comercial."));
  }
  if (precio.warnings.includes("V2_PRICING_SELLING_BELOW_REAL_COST")) {
    senales.push(aviso("El precio está por debajo del costo real: se vendería a pérdida."));
  }
  if (precio.warnings.includes("V2_PRICING_TAX_NOT_SET")) {
    senales.push(aviso("La configuración de la empresa no declara IGV."));
  }
  return { id: "precio", completo: !senales.some((s) => s.severidad === "error"), senales };
}

function pasoResumen(datos: DatosDelFlujo): EstadoPaso {
  if (!datos.precio) return sinDatos("resumen");
  const senales: Senal[] = [];
  if (!esPositivo(datos.precio.total)) {
    senales.push(aviso("Todavía no hay un total que resumir."));
  }
  return { id: "resumen", completo: true, senales };
}

const EVALUADORES: Record<PasoId, (datos: DatosDelFlujo) => EstadoPaso> = {
  cliente: pasoCliente,
  productos: pasoProductos,
  materiales: pasoMateriales,
  "mano-de-obra": pasoManoDeObra,
  quema: pasoQuema,
  precio: pasoPrecio,
  resumen: pasoResumen,
};

/** El estado de los siete pasos, en orden. */
export function evaluarPasos(datos: DatosDelFlujo): EstadoPaso[] {
  return PASOS.map((paso) => EVALUADORES[paso.id](datos));
}

/** Si un texto de la URL es uno de los siete pasos. */
export function esPasoValido(valor: string | undefined): valor is PasoId {
  return PASOS.some((paso) => paso.id === valor);
}

/**
 * El primer paso incompleto, o el último si todo está listo.
 *
 * Es a donde se lleva a quien abre un borrador sin decir el paso, o con uno que
 * no existe. Llevarlo al primero siempre le haría repasar lo que ya hizo;
 * llevarlo al último le escondería lo que falta.
 */
export function primerPasoIncompleto(estados: readonly EstadoPaso[]): PasoId {
  return estados.find((estado) => !estado.completo)?.id ?? "resumen";
}
