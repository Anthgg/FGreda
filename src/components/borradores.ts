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
