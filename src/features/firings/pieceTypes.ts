/**
 * Qué productos pueden ser una pieza de una hoja de quema.
 *
 * Lo que entra en un horno son piezas terminadas del catálogo. Dejar escribir
 * el nombre a mano invitaría a duplicar productos que ya existen —«plato
 * palta» y «Plato Palta» acabarían siendo dos cosas distintas para el sistema—,
 * así que la pieza se elige, no se teclea.
 *
 * Los materiales preparados quedan fuera a propósito: un esmalte es una receta,
 * no una pieza. El costo de horno y el del material no se mezclan.
 */

import type { ProductType } from "@/types/masters";

export const FIRING_PIECE_PRODUCT_TYPES: readonly ProductType[] = ["FINISHED_PRODUCT"];
