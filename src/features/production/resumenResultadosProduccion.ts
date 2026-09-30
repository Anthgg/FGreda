import { normalizar, sumar } from "@/features/production/decimales";
import type { ProductionOrderResult } from "@/types/production";

export function resumenResultadosProduccion(
  results: readonly Pick<ProductionOrderResult, "started_quantity" | "good_quantity" | "scrap_quantity">[],
): string {
  return `Iniciadas ${normalizar(sumar(results.map((item) => item.started_quantity)))} · Buenas ${normalizar(sumar(results.map((item) => item.good_quantity)))} · Merma ${normalizar(sumar(results.map((item) => item.scrap_quantity)))}`;
}
