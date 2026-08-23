/**
 * Productos que pueden ser componente de una receta.
 *
 * Un insumo (`RAW_MATERIAL`) o un preparado interno (`PREPARED_MATERIAL`) sí
 * entran en una fórmula. Una pieza terminada —una jarra, un plato— y los
 * servicios no: ofrecerlos solo ensucia el buscador y permite errores.
 */

import type { ProductType } from "@/types/masters";

export const COMPONENT_PRODUCT_TYPES: readonly ProductType[] = [
  "RAW_MATERIAL",
  "PREPARED_MATERIAL",
];
