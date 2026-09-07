import type { CotizadorDraft, CotizadorItemDraft } from "@/features/cotizador/draft";
import type { KilnMode } from "@/types/quotationBuilder";

/**
 * Fase 009K.3. Cambiar de modo de horno sin dejar restos del modo anterior.
 *
 * Vive aparte de la pantalla porque es la unica parte del cambio que puede
 * equivocarse en silencio: si al volver a «todo junto» quedara una eleccion
 * por producto, el backend seguiria planificando con ella y el total no
 * cuadraria con lo que la pantalla dice.
 */

/** Hornos distintos que las piezas usan hoy, sin repetir y sin los vacios. */
export function kilnsInUse(items: readonly CotizadorItemDraft[]): string[] {
  const usados = items.flatMap((item) => [
    item.lowKilnSelected ? item.lowKilnId : "",
    item.highKilnSelected ? item.highKilnId : "",
  ]);
  return [...new Set(usados.filter((value) => value.trim()))];
}

/**
 * Devuelve el borrador con el modo cambiado y las elecciones coherentes.
 *
 * **Hacia «por producto»** cada pieza hereda el horno comun como punto de
 * partida: empezar en blanco obligaria a volver a elegir lo que ya estaba
 * elegido, y quien solo quiera separar UNA pieza tendria que rellenar todas.
 *
 * **Hacia «todo junto»** hay dos casos y la diferencia importa:
 *
 * - si todas las piezas coincidian en un horno, ese pasa a ser el comun. No
 *   se pierde nada porque no habia nada que decidir;
 * - si habia hornos distintos, el comun queda VACIO. Tomar el primero seria
 *   elegir por el usuario en el unico momento en que su eleccion se pierde:
 *   las demas piezas cambiarian de horno sin que nadie lo dijera, y con ellas
 *   su tarifa, sus hornadas y sus dias.
 *
 * En ambos casos las elecciones por pieza se limpian: mientras el modo sea
 * comun, el horno de cabecera es la unica autoridad.
 */
export function applyKilnMode(draft: CotizadorDraft, kilnMode: KilnMode): CotizadorDraft {
  if (kilnMode === draft.kilnMode) return draft;

  if (kilnMode === "PER_PRODUCT") {
    return {
      ...draft,
      kilnMode,
      items: draft.items.map((item) => ({
        ...item,
        lowKilnId: item.lowKilnId || draft.kilnId,
        highKilnId: item.highKilnId || draft.kilnId,
      })),
    };
  }

  const usados = kilnsInUse(draft.items);
  return {
    ...draft,
    kilnMode,
    kilnId: usados.length === 1 ? (usados[0] ?? "") : "",
    items: draft.items.map((item) => ({ ...item, lowKilnId: "", highKilnId: "" })),
  };
}
