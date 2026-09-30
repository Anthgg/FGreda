/**
 * Los multiplicadores que se ofrecen como factor comercial. Fase 010O.10.
 *
 * Salen del rango CONGELADO en la cotización —`factor_min`, `factor_max`—, no
 * de una lista escrita aquí. El suelo de ×2 es una regla cerrada del negocio,
 * pero el techo no: ×3 es solo el valor por defecto y la casa puede subirlo a
 * ×4 o a ×10 desde Configuración. Una lista fija dejaría fuera los factores que
 * el propio taller acaba de habilitar.
 *
 * Sin rango no hay opciones: inventar un ×2–×3 de reserva sería decidir en la
 * pantalla algo que la cotización no dice. Quien llame decide qué hacer con una
 * lista vacía.
 *
 * Aquí no se calcula ningún precio. Se enumeran los factores entre dos
 * extremos; el precio que sale de cada uno lo calcula el backend.
 */

/**
 * El paso entre dos factores de la lista.
 *
 * Se abre cuando el rango crece para que la lista siga siendo usable: de ×2 a
 * ×3 en pasos de 0,25 son cinco opciones; de ×2 a ×10 en pasos de uno, nueve.
 * Con pasos de 0,25 serían treinta y tres.
 */
export function pasoDeFactor(minimo: number, maximo: number): number {
  const rango = maximo - minimo;
  if (rango <= 2) return 0.25;
  if (rango <= 5) return 0.5;
  return 1;
}

/**
 * Los factores elegibles, de menor a mayor.
 *
 * El guardado entra aunque no caiga en ningún paso —un ×2,10 pactado a mano—:
 * es la diferencia entre verlo y que el control aparezca vacío.
 */
export function valoresDeFactor(
  actual: string | null,
  minimo: string | null,
  maximo: string | null,
): number[] {
  if (minimo === null || maximo === null) {
    return actual === null ? [] : [Number(actual)];
  }
  const suelo = Number(minimo);
  const techo = Number(maximo);
  if (!Number.isFinite(suelo) || !Number.isFinite(techo) || techo < suelo) {
    return actual === null ? [] : [Number(actual)];
  }
  const paso = pasoDeFactor(suelo, techo);

  const valores: number[] = [];
  for (let valor = suelo; valor <= techo + 1e-9; valor += paso) {
    valores.push(Number(valor.toFixed(2)));
  }
  if (valores.at(-1) !== techo) valores.push(techo);
  if (actual !== null && !valores.some((valor) => valor === Number(actual))) {
    valores.push(Number(actual));
  }
  return valores.sort((a, b) => a - b);
}

/** «×2.50». Siempre como multiplicador: «+150 %» se confunde con «+250 %». */
export function etiquetaDeFactor(valor: string | number): string {
  return `×${Number(valor).toFixed(2)}`;
}

/** Las opciones para un selector, con el factor guardado dentro. */
export function opcionesDeFactor(
  actual: string | null,
  minimo: string | null,
  maximo: string | null,
): { value: string; label: string }[] {
  return valoresDeFactor(actual, minimo, maximo).map((valor) => ({
    value: String(valor),
    label: etiquetaDeFactor(valor),
  }));
}

/**
 * La opción que corresponde al factor guardado, o `null` si no hay ninguno.
 *
 * El backend devuelve `3.000000` y la lista dice `3`: como texto no son el
 * mismo valor, y el control quedaba vacío sobre una cotización que sí tiene
 * factor. Se comparan como NÚMEROS.
 */
export function factorSeleccionado(
  actual: string | null,
  opciones: readonly { value: string }[],
): string | null {
  if (actual === null) return null;
  return (
    opciones.find((opcion) => Number(opcion.value) === Number(actual))?.value ??
    String(Number(actual))
  );
}
