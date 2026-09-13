import { useEffect, useMemo } from "react";
import { useMutationState, useQueryClient, type Mutation } from "@tanstack/react-query";

import { anunciarDescarte, useBorradoresSinGuardar } from "@/components/borradores";
import {
  firmaDeGuardado,
  guardadosDeCotizacion,
  type TipoDeGuardado,
} from "@/features/cotizadorV2/claves";

/**
 * El estado REAL de los guardados de una cotización. Fase 010G.
 *
 * Sustituye a un `useIsMutating()` que la revisión adversarial de Codex tumbó por
 * tres motivos, los tres comprobados:
 *
 * 1. **contaba todas las mutaciones de la aplicación**, no las de esta
 *    cotización: guardar algo en otra pantalla encendía «Guardando cambios»;
 * 2. **un error volvía a cero** y el indicador pasaba a «Todos los cambios
 *    guardados» cuando el backend acababa de RECHAZAR el cambio. El error vivía
 *    solo en el panel que lanzó la escritura; si se había cambiado de paso, no
 *    quedaba rastro y recargar lo perdía sin preguntar;
 * 3. **no veía lo tecleado sin salir del campo**: sin blur no hay petición, y la
 *    protección de salida no tenía nada que proteger.
 *
 * Ahora las escrituras llevan la clave de su cotización y se leen de la caché de
 * mutaciones, que sobrevive al desmontaje de quien las lanzó. Y los campos
 * diferidos declaran sus borradores en un registro aparte.
 *
 * ## Cuándo un error deja de estar pendiente
 *
 * Cuando el MISMO dato se guarda después con éxito —el mismo tipo, la misma fila,
 * los mismos campos— o cuando el usuario descarta el aviso a sabiendas. Guardar
 * otro dato no lo resuelve: el nombre de la cotización no arregla unos días
 * efectivos que no llegaron.
 */

export interface GuardadoFallido {
  readonly firma: string;
  readonly tipo: TipoDeGuardado;
  readonly error: unknown;
}

export interface EstadoDeGuardado {
  /** Escrituras de esta cotización todavía en vuelo. */
  readonly enVuelo: number;
  /** Cambios que el backend rechazó y nadie ha vuelto a guardar ni descartado. */
  readonly fallidos: readonly GuardadoFallido[];
  /** Campos que enseñan un valor todavía no enviado. */
  readonly borradores: number;
  /** Si salir ahora podría perder algo. */
  readonly hayRiesgo: boolean;
  /** Quita el aviso de un fallo. Es una decisión consciente de perder ese cambio. */
  descartar: (firma: string) => void;
}

interface Resumen {
  firma: string;
  tipo: TipoDeGuardado;
  status: Mutation["state"]["status"];
  submittedAt: number;
  error: unknown;
}

export function useEstadoDeGuardado(quotationId: number): EstadoDeGuardado {
  const client = useQueryClient();
  const borradores = useBorradoresSinGuardar();

  const escrituras = useMutationState<Resumen>({
    filters: { mutationKey: guardadosDeCotizacion(quotationId) },
    select: (mutation) => {
      const tipo = String(mutation.options.mutationKey?.[3]) as TipoDeGuardado;
      return {
        firma: firmaDeGuardado(tipo, mutation.state.variables, mutation.mutationId),
        tipo,
        status: mutation.state.status,
        submittedAt: mutation.state.submittedAt,
        error: mutation.state.error,
      };
    },
  });

  const { enVuelo, fallidos } = useMemo(() => {
    // La ÚLTIMA escritura de cada dato manda: si es un error, está pendiente.
    const ultima = new Map<string, Resumen>();
    let pendientes = 0;
    for (const escritura of escrituras) {
      if (escritura.status === "pending") pendientes += 1;
      const previa = ultima.get(escritura.firma);
      if (!previa || escritura.submittedAt >= previa.submittedAt) {
        ultima.set(escritura.firma, escritura);
      }
    }
    const conError = [...ultima.values()]
      .filter((escritura) => escritura.status === "error")
      .map(({ firma, tipo, error }) => ({ firma, tipo, error }));
    return { enVuelo: pendientes, fallidos: conError };
  }, [escrituras]);

  // Poda. Las escrituras se recuerdan sin límite para que un error no se
  // olvide solo, pero eso guardaba también cada éxito para siempre
  // (re-revisión de Codex). Se conserva solo lo que todavía dice algo: lo que
  // está en vuelo y el ÚLTIMO error de cada dato. Una firma con algo en vuelo no
  // se toca: si la escritura antigua fallara después de que la nueva tuviera
  // éxito, borrar la nueva haría aparecer un error falso.
  useEffect(() => {
    const cache = client.getMutationCache();
    const todas = cache.findAll({ mutationKey: guardadosDeCotizacion(quotationId) });
    const firmaDe = (m: (typeof todas)[number]) =>
      firmaDeGuardado(String(m.options.mutationKey?.[3]), m.state.variables, m.mutationId);
    const conVuelo = new Set(todas.filter((m) => m.state.status === "pending").map(firmaDe));
    const ultima = new Map<string, (typeof todas)[number]>();
    for (const m of todas) {
      const firma = firmaDe(m);
      const previa = ultima.get(firma);
      if (!previa || m.state.submittedAt >= previa.state.submittedAt) ultima.set(firma, m);
    }
    for (const m of todas) {
      const firma = firmaDe(m);
      if (conVuelo.has(firma)) continue;
      const esUltimoError = ultima.get(firma) === m && m.state.status === "error";
      if (!esUltimoError) cache.remove(m);
    }
  }, [client, quotationId, escrituras]);

  const hayRiesgo = enVuelo > 0 || fallidos.length > 0 || borradores > 0;

  // Proteger recargar y cerrar mientras haya riesgo. Un único oyente mientras
  // dura el riesgo: se registra al empezar y se retira al terminar, no en cada
  // cambio de conteo, así que no hay un hueco en que el conteo pase por cero
  // entre dos escrituras y la salida quede sin protección.
  useEffect(() => {
    if (!hayRiesgo) return;
    const avisar = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
      // Algunos navegadores solo preguntan si `returnValue` tiene contenido.
      evento.returnValue = "";
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [hayRiesgo]);

  const descartar = (firma: string) => {
    const cache = client.getMutationCache();
    for (const mutation of cache.findAll({ mutationKey: guardadosDeCotizacion(quotationId) })) {
      const tipo = String(mutation.options.mutationKey?.[3]);
      if (firmaDeGuardado(tipo, mutation.state.variables, mutation.mutationId) === firma) {
        cache.remove(mutation);
      }
    }
    // Y el campo que enseña lo rechazado vuelve a lo guardado. Solo ese.
    anunciarDescarte(firma);
  };

  return { enVuelo, fallidos, borradores, hayRiesgo, descartar };
}
