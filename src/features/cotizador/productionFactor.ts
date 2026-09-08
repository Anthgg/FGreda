/**
 * Fase 009K.4.1. Como se DICE el factor de produccion en el Cotizador.
 *
 * El factor existia y funcionaba desde 009K.3, pero la pantalla no dejaba ver
 * de quien es la decision. Se llamaba «factor comercial» —que en la base es
 * otra columna, `quotations.commercial_factor`— y debajo del control ponia
 * «Configuracion → Comercial», que se lee como «esto se decide en Ajustes».
 *
 * El reparto real es otro y es el que estas palabras tienen que sostener:
 *
 * - **Configuracion define CUANTO vale** el factor de la casa.
 * - **Cada cotizacion decide SI SE APLICA.**
 *
 * Se dice en tres sitios —la decision del paso 5, el desglose del paso 4 y el
 * resumen del paso 6— y por eso vive aqui: con tres textos escritos por
 * separado, tres pantallas acabarian llamando distinto a lo mismo.
 */

/** Etiqueta del concepto. Un solo nombre en todo el Cotizador. */
export const PRODUCTION_FACTOR_LABEL = "Factor de producción";

/** Apagado el multiplicador es UNO, nunca cero: cero no lo admite el motor. */
export const NEUTRAL_FACTOR = "1";

/**
 * El factor escrito como multiplicador: «3.00» y «3.0» se dicen «3», «2.50»
 * se dice «2.5».
 *
 * No lleva simbolo de moneda a proposito. El factor no son tres soles: son
 * tres veces el costo tecnico, y «S/ 3» invitaria a sumarlo al precio.
 */
export function factorMultiplier(value: string | null | undefined): string {
  const texto = String(value ?? "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(texto)) return NEUTRAL_FACTOR;
  if (!texto.includes(".")) return texto;
  const recortado = texto.replace(/0+$/, "").replace(/\.$/, "");
  return recortado === "" || recortado === "-" ? NEUTRAL_FACTOR : recortado;
}

/**
 * Estado del factor en una linea de lectura: «No aplicado · ×1» o
 * «Aplicado · ×3».
 *
 * `factor` es el que devuelve el backend, no uno calculado aqui. Apagado no se
 * mira siquiera: el neutro es parte del significado de estar apagado, y leerlo
 * del preview haria que un preview a medias dijera «no aplicado · ×3».
 */
export function factorStateLabel(
  enabled: boolean,
  factor: string | null | undefined,
): string {
  return enabled
    ? `Aplicado · ×${factorMultiplier(factor)}`
    : `No aplicado · ×${NEUTRAL_FACTOR}`;
}
