import { useEffect, useRef } from "react";

/**
 * Lo mínimo que un diálogo modal le debe al teclado. Fase 010H.
 *
 * Revisión de Codex: los diálogos de emitir, anular y enviar a producción tenían
 * `role="dialog"` y Escape, pero el foco se quedaba detrás del velo. Con teclado
 * o lector de pantalla se podía seguir tabulando por la ficha —y pulsar
 * «Duplicar» con el diálogo de anular abierto—.
 *
 * - al abrir, el foco entra en el diálogo;
 * - Tab y Mayús+Tab dan la vuelta dentro de él;
 * - al cerrar, el foco vuelve al botón que lo abrió.
 */
const ENFOCABLES =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useDialogoAccesible<T extends HTMLElement>(abierto: boolean) {
  const contenedor = useRef<T | null>(null);

  useEffect(() => {
    if (!abierto) return;
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const nodo = contenedor.current;
    const primero = nodo?.querySelector<HTMLElement>(ENFOCABLES);
    (primero ?? nodo)?.focus();

    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key !== "Tab" || !nodo) return;
      const enfocables = Array.from(nodo.querySelectorAll<HTMLElement>(ENFOCABLES));
      if (enfocables.length === 0) {
        evento.preventDefault();
        return;
      }
      const inicio = enfocables[0];
      const fin = enfocables[enfocables.length - 1];
      if (evento.shiftKey && document.activeElement === inicio) {
        evento.preventDefault();
        fin?.focus();
      } else if (!evento.shiftKey && document.activeElement === fin) {
        evento.preventDefault();
        inicio?.focus();
      }
    };
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      previo?.focus();
    };
  }, [abierto]);

  return contenedor;
}
