import type { QueryClient } from "@tanstack/react-query";

/**
 * Las claves de caché del Cotizador V2, y qué invalida qué.
 *
 * Viven juntas y en su propio fichero porque la respuesta a «¿qué hay que
 * refrescar cuando cambia esto?» no puede estar repartida entre cinco módulos
 * que se importan en cadena.
 *
 * ## Por qué una mutación tiene que invalidar más de lo que tocó
 *
 * El backend RECALCULA en cascada. Añadir una pieza mueve el volumen, y con él
 * las hornadas, el reparto de la quema y cada precio unitario; asignar una
 * tarea mueve la mano de obra, el reparto del espacio y otra vez el precio.
 * Una mutación que solo invalidara su propia clave dejaría al asistente
 * enseñando un total viejo junto a unas líneas nuevas, y las dos cifras no
 * cuadrarían.
 *
 * Eso pasaba desapercibido mientras cada consulta se refrescaba al montarse:
 * cambiar de paso disparaba una petición nueva y el número llegaba fresco de
 * casualidad. En cuanto se puso `staleTime` para dejar de pedir dos veces lo
 * mismo, la casualidad dejó de funcionar. La cascada se declara aquí.
 */

/** La cabecera y el listado. Clave propia, distinta de la de Legacy. */
export const QUOTER_V2_KEY = ["quotations-v2"] as const;

export const V2_MATERIALS_KEY = ["quoter-v2", "materials"] as const;
export const V2_LINES_KEY = ["quoter-v2", "lines"] as const;
export const V2_WORKERS_KEY = ["quoter-v2", "workers"] as const;
export const V2_TECHNIQUES_KEY = ["quoter-v2", "techniques"] as const;
export const V2_LABOR_KEY = ["quoter-v2", "labor"] as const;
export const V2_ILLUSTRATION_KEY = ["quoter-v2", "illustration"] as const;
export const V2_FIRING_KEY = ["quoter-v2", "firing"] as const;
export const V2_PRICING_KEY = ["quoter-v2", "pricing"] as const;

/**
 * Cuánto vale una respuesta antes de volver a pedirla.
 *
 * Desde 010G una misma consulta tiene DOS observadores: el asistente la mira
 * para saber si el paso está completo, y el panel del paso la mira para
 * pintarla. Sin esto, montar el segundo disparaba una petición idéntica a la
 * que acababa de resolverse: dos viajes por paso, cinco por ficha.
 *
 * No afecta a la frescura de lo que se ve, porque invalidar ignora este plazo y
 * `invalidarCotizacion` se llama en cada cambio. Solo tapa el refresco
 * redundante de un dato recién traído que nadie ha tocado entre medias.
 */
export const V2_STALE_TIME = 30_000;

/**
 * Todo lo que cuelga de UNA cotización, marcado para volver a pedirse.
 *
 * Se llama después de cualquier cambio dentro de la cotización, sea del paso
 * que sea. Invalidar de más cuesta una petición; invalidar de menos cuesta
 * enseñar un precio que ya no es el que el backend calculó.
 *
 * No toca los maestros —trabajadores, técnicas, materiales valorizados—: esos
 * no cambian porque alguien edite una línea, y refrescarlos aquí sería pedir
 * cuatro listas enteras cada vez que se teclea un peso.
 */
export function invalidarCotizacion(client: QueryClient, quotationId: number): void {
  for (const clave of [
    QUOTER_V2_KEY,
    V2_LINES_KEY,
    V2_LABOR_KEY,
    V2_ILLUSTRATION_KEY,
    V2_FIRING_KEY,
    V2_PRICING_KEY,
  ]) {
    void client.invalidateQueries({ queryKey: [...clave, quotationId] });
  }
}

/**
 * Qué escribe una mutación de la cotización. Cada tipo es un sitio distinto
 * donde un guardado puede fallar, y el asistente los nombra al avisar.
 */
export type TipoDeGuardado =
  | "cabecera"
  | "linea-anadir"
  | "linea-editar"
  | "linea-borrar"
  | "tarea-anadir"
  | "tarea-editar"
  | "tarea-borrar"
  | "planificacion"
  | "ilustracion"
  | "quema"
  | "precio";

/** Raíz de las escrituras de UNA cotización. Filtra el estado de guardado. */
export const guardadosDeCotizacion = (quotationId: number) =>
  ["cotizacion-v2", "guardado", quotationId] as const;

/** Clave de una escritura concreta. */
export const claveDeGuardado = (quotationId: number, tipo: TipoDeGuardado) =>
  [...guardadosDeCotizacion(quotationId), tipo] as const;

/**
 * Cuánto tiempo se recuerda una escritura terminada.
 *
 * Para siempre, mientras dure la pestaña. Por defecto TanStack olvida una
 * mutación sin observadores a los cinco minutos, y un error que se olvida es
 * una protección que desaparece sola: el aviso de «no se pudo guardar» se
 * esfumaba y la recarga volvía a perder el cambio sin preguntar.
 */
export const RECORDAR_GUARDADO = Number.POSITIVE_INFINITY;

function claves(objeto: unknown): string {
  return objeto && typeof objeto === "object" ? Object.keys(objeto).sort().join(",") : "";
}

/**
 * A qué DATO afecta una escritura, para saber si un éxito posterior resuelve un error.
 *
 * Un fallo al guardar los días efectivos queda resuelto cuando esos días se
 * guardan después con éxito, no cuando se guarda el nombre de la cotización. Por
 * eso la firma distingue el tipo, la fila afectada y los campos que viajaban.
 *
 * Un alta es siempre distinta de otra, y por eso su firma es el INTENTO
 * (`mutationId`), no su contenido. Re-revisión de Codex: con la firma por
 * contenido, fallar al añadir «Taza» y añadir después otra «Taza» idéntica con
 * éxito borraba el error de la primera. Una línea que no se pudo añadir no se da
 * por añadida porque se añada otra; su aviso solo se quita descartándolo.
 */
export function firmaDeGuardado(tipo: string, variables: unknown, intento: number): string {
  const v = variables as Record<string, unknown> | number | null | undefined;
  switch (tipo) {
    case "linea-editar":
    case "tarea-editar": {
      const objeto = (v ?? {}) as Record<string, unknown>;
      const fila = objeto.lineId ?? objeto.laborId;
      return `${tipo}:${String(fila)}:${claves(objeto.payload)}`;
    }
    case "linea-borrar":
    case "tarea-borrar":
      return `${tipo}:${String(v)}`;
    case "linea-anadir":
    case "tarea-anadir":
      return `${tipo}:#${intento}`;
    case "planificacion":
      return tipo;
    default:
      return `${tipo}:${claves(v)}`;
  }
}

/** Dónde se arregla cada tipo de escritura, y cómo se le llama al usuario. */
export const DESTINO_DE_GUARDADO: Record<
  TipoDeGuardado,
  { paso: "cliente" | "productos" | "materiales" | "mano-de-obra" | "quema" | "precio"; que: string }
> = {
  cabecera: { paso: "cliente", que: "los datos de la cotización" },
  "linea-anadir": { paso: "productos", que: "una línea nueva" },
  "linea-editar": { paso: "productos", que: "una línea de producto" },
  "linea-borrar": { paso: "productos", que: "quitar una línea" },
  "tarea-anadir": { paso: "mano-de-obra", que: "una tarea nueva" },
  "tarea-editar": { paso: "mano-de-obra", que: "una tarea" },
  "tarea-borrar": { paso: "mano-de-obra", que: "quitar una tarea" },
  planificacion: { paso: "mano-de-obra", que: "los días efectivos" },
  ilustracion: { paso: "mano-de-obra", que: "la ilustración" },
  quema: { paso: "quema", que: "la quema" },
  precio: { paso: "precio", que: "el factor comercial" },
};
