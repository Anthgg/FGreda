import { formatMoney } from "@/features/quotations/money";

/**
 * En qué moneda va cada importe del Cotizador V2. Fase 010O.3.
 *
 * El motor económico del backend trabaja con DOS monedas a la vez, y una
 * pantalla que las confunda miente aunque cada número sea correcto:
 *
 * - **costos** —materiales, mano de obra, quema, espacio, adicionales, costo
 *   real, costo de producción, ganancia estimada— viven en la moneda BASE del
 *   taller. Es `BASE_CURRENCY = "PEN"` en `app/core/pricing.py`: el inventario
 *   y los maestros se valorizan en soles;
 * - **precios al cliente** —unitario, subtotal, IGV, total— van en la moneda
 *   de la cotización, ya convertidos con el tipo de cambio congelado.
 *
 * En una cotización en dólares, «Total US$ 1 200» junto a «Nos cuesta S/ 2 000»
 * es la verdad. Escribir los dos con `US$` —que es lo que hacía el resumen
 * anterior— inventa una ganancia que no existe.
 *
 * Aquí no se convierte ni se suma nada: solo se elige qué símbolo lleva cada
 * cifra. La conversión es del backend.
 */

/** La moneda base del taller. La del backend, no una preferencia de pantalla. */
export const MONEDA_BASE = "PEN";

/** Lo que hace falta de una cotización para escribir sus precios. */
export interface MonedaDeCotizacion {
  readonly currency_code: string | null;
  /** El símbolo congelado al crearla. Si existe, manda sobre la tabla actual. */
  readonly currency_symbol?: string | null;
}

/** Un COSTO interno. Siempre en moneda base, sea cual sea la de la cotización. */
export function formatCosto(valor: string | null | undefined): string {
  return formatMoney(valor, MONEDA_BASE);
}

/** Un PRECIO al cliente, en la moneda de la cotización y con su símbolo congelado. */
export function formatPrecio(
  valor: string | null | undefined,
  moneda: MonedaDeCotizacion | null | undefined,
): string {
  return formatMoney(valor, moneda?.currency_code ?? MONEDA_BASE, {
    symbolSnapshot: moneda?.currency_symbol ?? null,
  });
}
