/**
 * Cómo se enseña, en pantalla, la persona que firmó un documento.
 *
 * El nombre llega ya resuelto y congelado desde BGreda: el navegador no
 * consulta perfiles, no compone identidades y no resuelve identificadores.
 * Lo único que decide aquí es qué escribir cuando no hay nada que escribir.
 *
 * Los documentos anteriores a la Fase 009K.2 no registraron a nadie. No se les
 * puede atribuir un autor sin inventarlo, así que dicen que no consta. Que lo
 * digan todas las pantallas igual, y desde un solo sitio, es la diferencia
 * entre un hueco honesto y tres versiones de la misma ausencia.
 *
 * El texto coincide a propósito con el que el backend imprime en el PDF
 * (`ACTOR_NO_REGISTRADO`): la pantalla y el papel no pueden discrepar.
 */

/** Lo que se enseña cuando el documento no registró a nadie. */
export const SIN_ACTOR = "No registrado";

/** El nombre congelado del actor, o que no consta. Nunca inventa uno. */
export function nombreDeActor(snapshot: string | null | undefined): string {
  const limpio = (snapshot ?? "").trim();
  return limpio || SIN_ACTOR;
}
