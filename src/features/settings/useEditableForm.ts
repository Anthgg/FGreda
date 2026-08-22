/**
 * Formulario editable con deteccion de cambios.
 *
 * Mantiene el borrador local, sabe si difiere de lo que devolvio el servidor y
 * permite descartar los cambios. No valida reglas de negocio: eso es del
 * backend.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Campos de control que no son contenido editable.
 *
 * `version` cambia cada vez que el servidor confirma una escritura. Incluirla
 * en la comparacion dejaria el formulario marcado como modificado justo
 * despues de guardar, que es cuando de verdad esta al dia.
 */
const METADATA_KEYS = new Set(["version", "updated_at"]);

function isEqual<T extends Record<string, unknown>>(a: T, b: T): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (METADATA_KEYS.has(key)) continue;
    const left = a[key] ?? null;
    const right = b[key] ?? null;
    if (typeof left === "object" && left !== null && typeof right === "object" && right !== null) {
      if (!isEqual(left as Record<string, unknown>, right as Record<string, unknown>)) return false;
    } else if (left !== right) {
      return false;
    }
  }
  return true;
}

export function useEditableForm<T extends Record<string, unknown>>(initial: T | undefined) {
  const [draft, setDraft] = useState<T | undefined>(initial);
  const baseline = useRef<T | undefined>(initial);

  // Cuando el servidor entrega datos nuevos se adopta como nueva referencia,
  // salvo que la persona usuaria tenga cambios sin guardar: en ese caso se
  // respeta su borrador y no se le borra lo escrito.
  useEffect(() => {
    if (initial === undefined) return;

    const base = baseline.current;
    // La comparacion es por valor, no por identidad: quien llama construye el
    // objeto en cada render, asi que comparar referencias provocaria un
    // setDraft por render y con el un bucle infinito.
    if (base !== undefined && isEqual(base, initial)) {
      baseline.current = initial;
      return;
    }

    const conCambiosPendientes = base !== undefined && !isEqual(base, draft ?? base);
    baseline.current = initial;
    if (!conCambiosPendientes) setDraft(initial);
  }, [initial, draft]);

  const setField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  }, []);

  const reset = useCallback(() => {
    setDraft(baseline.current);
  }, []);

  /**
   * Adopta la respuesta del servidor tras guardar.
   *
   * Deja borrador y referencia en el mismo estado, de modo que el formulario
   * queda limpio y la siguiente escritura parte de la version confirmada.
   */
  const commit = useCallback((next: T) => {
    baseline.current = next;
    setDraft(next);
  }, []);

  const isDirty = useMemo(() => {
    if (!draft || !baseline.current) return false;
    return !isEqual(baseline.current, draft);
  }, [draft]);

  return { draft, setField, setDraft, reset, commit, isDirty } as const;
}
