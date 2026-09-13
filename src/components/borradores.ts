import { useEffect, useId, useRef, useSyncExternalStore } from "react";

/**
 * Registro de campos con cambios que todavía NO han salido hacia el servidor.
 *
 * Fase 010G, a raíz de la revisión adversarial de Codex. Los campos del
 * Cotizador V2 guardan al SALIR del campo; mientras alguien escribe no hay
 * ninguna petición en vuelo. Así que la protección contra recargar o cerrar, que
 * miraba solo las peticiones pendientes, no veía nada: teclear «2» en los días
 * efectivos y pulsar F5 sin haber salido del campo perdía el cambio en silencio.
 *
 * Cada campo diferido declara aquí si lo que enseña difiere de lo guardado. El
 * asistente lo suma a las escrituras en vuelo y a los errores sin resolver para
 * decidir si avisa antes de salir.
 *
 * Es un almacén de módulo y no un contexto porque los campos viven en paneles
 * distintos, montados y desmontados por separado, y lo único que hace falta
 * saber desde fuera es cuántos hay.
 */

const sucios = new Set<string>();
const oyentes = new Set<() => void>();

function avisar(): void {
  for (const oyente of oyentes) oyente();
}

function suscribir(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

function marcar(id: string, sucio: boolean): void {
  const estaba = sucios.has(id);
  if (sucio === estaba) return;
  if (sucio) sucios.add(id);
  else sucios.delete(id);
  avisar();
}

/**
 * Lo que un campo diferido recibe cuando SU guardado termina.
 *
 * Tercera revisión de Codex. El campo intentaba ADIVINAR si su envío había
 * terminado comparando lo guardado con lo enviado, y ninguna regla de
 * comparación servía para todo: «cambió» pintaba el valor intermedio de un
 * guardado anterior, y «coincide» no reconocía nunca un valor que el backend
 * normaliza —`20,5000004` se guarda como `20.500000`—, así que el pie decía
 * «guardado» con lo NO guardado a la vista. Ahora el campo no adivina: quien
 * guarda le devuelve si el servidor lo aceptó (`ok`) y si la pantalla ya tiene
 * el dato posterior a ese guardado (`fresco`), y el campo solo se alinea con lo
 * guardado cuando las dos cosas son ciertas.
 */
export interface ResultadoDeGuardado {
  readonly ok: boolean;
  /** A qué dato afectó, para que un descarte revierta solo ese campo. */
  readonly firma: string;
  /**
   * Si lo guardado que ve la pantalla es POSTERIOR a este guardado. Solo
   * entonces el campo puede alinearse con ello. `false` con `ok: true` es un
   * guardado que el servidor aceptó pero cuyo refetch no llegó —falló o se
   * agotaron los intentos—: el campo sigue enseñando lo enviado, que es lo que
   * el servidor guardó, en vez de alinearse con un dato viejo.
   */
  readonly fresco?: boolean;
}

/**
 * Sigue un envío y avisa al terminar, solo si sigue siendo el último del campo.
 *
 * Con dos envíos del mismo campo en fila, el que termina primero es el viejo:
 * su resultado ya no dice nada de lo que el campo enseña.
 */
export function seguirEnvio(
  resultado: unknown,
  sigueVigente: () => boolean,
  alTerminar: (resultado: ResultadoDeGuardado) => void,
): void {
  if (!resultado || typeof (resultado as Promise<unknown>).then !== "function") return;
  void (resultado as Promise<ResultadoDeGuardado | undefined>).then(
    (final) => {
      if (final && sigueVigente()) alTerminar(final);
    },
    // Una promesa que rechaza —quien guarde sin `esperarGuardado`— cuenta como
    // fallo sin firma: el campo conserva lo tecleado y no se da nada por hecho.
    () => {
      if (sigueVigente()) alTerminar({ ok: false, firma: "" });
    },
  );
}

let descarte: { readonly n: number; readonly firma: string } = { n: 0, firma: "" };

/**
 * Avisa de que el usuario descartó un guardado rechazado, y de CUÁL.
 *
 * Solo el campo cuyo último envío falló con esa firma vuelve a lo guardado.
 * Tercera revisión de Codex: la señal global revertía también un campo con un
 * envío EN VUELO que iba a tener éxito, y durante unos segundos enseñaba el
 * valor viejo como si lo hubiera afectado el descarte.
 */
export function anunciarDescarte(firma: string): void {
  descarte = { n: descarte.n + 1, firma };
  avisar();
}

/** El último descarte anunciado, para que un campo compare su firma. */
export function useUltimoDescarte(): { readonly n: number; readonly firma: string } {
  return useSyncExternalStore(
    suscribir,
    () => descarte,
    () => descarte,
  );
}

/** Cuántos campos enseñan ahora mismo un valor que no está guardado. */
export function useBorradoresSinGuardar(): number {
  return useSyncExternalStore(
    suscribir,
    () => sucios.size,
    () => 0,
  );
}

/**
 * Declara un campo diferido en el registro.
 *
 * `sucio` es si lo que se ve difiere de lo guardado. `confirmarAlSalir` se llama
 * si el campo se DESMONTA con cambios: volver atrás con el botón del navegador o
 * cambiar de ruta no pasa por un blur, y sin esto lo tecleado desaparecía con el
 * componente. Se guarda en una referencia para que el desmontaje use la versión
 * más reciente sin volver a registrarse en cada tecla.
 */
export function useBorradorProtegido(sucio: boolean, confirmarAlSalir: () => void): void {
  const id = useId();
  const ultimoConfirmar = useRef(confirmarAlSalir);
  const ultimoSucio = useRef(sucio);

  useEffect(() => {
    ultimoConfirmar.current = confirmarAlSalir;
    ultimoSucio.current = sucio;
    marcar(id, sucio);
  });

  useEffect(
    () => () => {
      if (ultimoSucio.current) ultimoConfirmar.current();
      marcar(id, false);
    },
    [id],
  );
}

/** Solo para pruebas: deja el registro vacío entre casos. */
export function vaciarRegistroDeBorradores(): void {
  if (sucios.size === 0) return;
  sucios.clear();
  avisar();
}
