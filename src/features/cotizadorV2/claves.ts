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
