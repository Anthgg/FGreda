import { useSyncExternalStore } from "react";
import { useQueryClient, type Query, type QueryClient } from "@tanstack/react-query";

import type { ResultadoDeGuardado } from "@/components/borradores";

/**
 * Las claves de caché del Cotizador V2, y qué invalida qué.
 *
 * Viven juntas y en su propio fichero porque la respuesta a «¿qué hay que
 * refrescar cuando cambia esto?» no puede estar repartida entre cinco módulos
 * que se importan en cadena.
 *
 * ## Por qué una mutación tiene que invalidar más de lo que tocó
 *
 * El backend RECALCULA en cascada. Añadir una pieza mueve el volumen, y con él
 * las hornadas, el reparto de la quema y cada precio unitario; asignar una
 * tarea mueve la mano de obra, el reparto del espacio y otra vez el precio.
 * Una mutación que solo invalidara su propia clave dejaría al asistente
 * enseñando un total viejo junto a unas líneas nuevas, y las dos cifras no
 * cuadrarían.
 *
 * Eso pasaba desapercibido mientras cada consulta se refrescaba al montarse:
 * cambiar de paso disparaba una petición nueva y el número llegaba fresco de
 * casualidad. En cuanto se puso `staleTime` para dejar de pedir dos veces lo
 * mismo, la casualidad dejó de funcionar. La cascada se declara aquí.
 */

/** La cabecera y el listado. Clave propia, distinta de la de Legacy. */
export const QUOTER_V2_KEY = ["quotations-v2"] as const;

export const V2_MATERIALS_KEY = ["quoter-v2", "materials"] as const;
export const V2_LINES_KEY = ["quoter-v2", "lines"] as const;
export const V2_WORKERS_KEY = ["quoter-v2", "workers"] as const;
export const V2_TECHNIQUES_KEY = ["quoter-v2", "techniques"] as const;
export const V2_LABOR_KEY = ["quoter-v2", "labor"] as const;
export const V2_ILLUSTRATION_KEY = ["quoter-v2", "illustration"] as const;
export const V2_FIRING_KEY = ["quoter-v2", "firing"] as const;
export const V2_PRICING_KEY = ["quoter-v2", "pricing"] as const;

/**
 * Cuánto vale una respuesta antes de volver a pedirla.
 *
 * Desde 010G una misma consulta tiene DOS observadores: el asistente la mira
 * para saber si el paso está completo, y el panel del paso la mira para
 * pintarla. Sin esto, montar el segundo disparaba una petición idéntica a la
 * que acababa de resolverse: dos viajes por paso, cinco por ficha.
 *
 * No afecta a la frescura de lo que se ve, porque invalidar ignora este plazo y
 * `invalidarCotizacion` se llama en cada cambio. Solo tapa el refresco
 * redundante de un dato recién traído que nadie ha tocado entre medias.
 */
export const V2_STALE_TIME = 30_000;

/**
 * Todo lo que cuelga de UNA cotización, marcado para volver a pedirse.
 *
 * Se llama después de cualquier cambio dentro de la cotización, sea del paso
 * que sea. Invalidar de más cuesta una petición; invalidar de menos cuesta
 * enseñar un precio que ya no es el que el backend calculó.
 *
 * No toca los maestros —trabajadores, técnicas, materiales valorizados—: esos
 * no cambian porque alguien edite una línea, y refrescarlos aquí sería pedir
 * cuatro listas enteras cada vez que se teclea un peso.
 */
export function invalidarCotizacion(client: QueryClient, quotationId: number): Promise<void> {
  // Devuelve la promesa por si alguien quiere esperarla, pero las mutaciones NO
  // la esperan desde `onSuccess`. Esperarla no garantiza que el dato haya
  // llegado: si un refetch FALLA, TanStack se traga el error (`catch(noop)`) y
  // la promesa resuelve con el dato viejo. Esa garantía la da
  // `asegurarFrescura`, que la comprueba.
  //
  // Y una consulta en su CARGA INICIAL necesita un fetch más. Quinta revisión de
  // Codex, comprobada en `query-core/src/query.ts`: TanStack solo cancela un
  // fetch en curso si la consulta ya tiene datos; sin ellos devuelve la promesa
  // en curso. Ese GET empezó antes del guardado, y al resolver limpia la marca
  // de invalidación: la consulta se quedaba con datos ANTERIORES al cambio
  // hasta la siguiente invalidación. Se espera a que termine y se pide otro,
  // que ya empieza después.
  const cache = client.getQueryCache();
  const refrescos: Promise<void>[] = [];
  for (const clave of [
    QUOTER_V2_KEY,
    V2_LINES_KEY,
    V2_LABOR_KEY,
    V2_ILLUSTRATION_KEY,
    V2_FIRING_KEY,
    V2_PRICING_KEY,
  ]) {
    const queryKey = [...clave, quotationId];
    const consulta = cache.find({ queryKey, exact: true });
    const cargaInicialEnCurso =
      consulta !== undefined &&
      consulta.state.data === undefined &&
      consulta.state.fetchStatus === "fetching";
    const invalidacion = client.invalidateQueries({ queryKey });
    refrescos.push(
      cargaInicialEnCurso
        ? invalidacion.then(() =>
            client.refetchQueries({ queryKey, exact: true, type: "active" }, { cancelRefetch: false }),
          )
        : invalidacion,
    );
  }
  return Promise.all(refrescos).then(() => undefined);
}

/**
 * Qué escribe una mutación de la cotización. Cada tipo es un sitio distinto
 * donde un guardado puede fallar, y el asistente los nombra al avisar.
 */
export type TipoDeGuardado =
  | "cabecera"
  | "linea-anadir"
  | "linea-editar"
  | "linea-borrar"
  | "tarea-anadir"
  | "tarea-editar"
  | "tarea-borrar"
  | "planificacion"
  | "ilustracion"
  | "quema"
  | "precio";

/** Raíz de las escrituras de UNA cotización. Filtra el estado de guardado. */
export const guardadosDeCotizacion = (quotationId: number) =>
  ["cotizacion-v2", "guardado", quotationId] as const;

/** Clave de una escritura concreta. */
export const claveDeGuardado = (quotationId: number, tipo: TipoDeGuardado) =>
  [...guardadosDeCotizacion(quotationId), tipo] as const;

/**
 * La fila en la que esperan las escrituras de UNA cotización: de una en una, en
 * el orden en que se pidieron.
 *
 * Lo encontró la E2E de la revisión, en el trace de un fallo intermitente de
 * CASO 4: el campo «alto» envió `20` al salir y, 165 ms después, `20.5`. Las
 * dos peticiones viajaron a la vez, esperaron el bloqueo de la cabecera en el
 * backend y este las confirmó AL REVÉS: quedó `20`, el campo lo enseñó y el pie
 * dijo «Todos los cambios guardados». El usuario perdía su último cambio.
 *
 * El backend ya las ejecuta de una en una —bloqueo pesimista—, pero no en el
 * orden de llegada. Con un `scope` común, TanStack no envía una escritura hasta
 * que termina la anterior: el orden del servidor pasa a ser el del usuario y no
 * se pierde velocidad, porque en paralelo tampoco se ganaba. Mientras espera,
 * la escritura cuenta como pendiente: «Guardando cambios…» y salida protegida.
 */
export const alcanceDeGuardado = (quotationId: number) => ({ id: `cotizacion-v2:${quotationId}` });

/**
 * Cuánto tiempo se recuerda una escritura terminada.
 *
 * Para siempre, mientras dure la pestaña. Por defecto TanStack olvida una
 * mutación sin observadores a los cinco minutos, y un error que se olvida es
 * una protección que desaparece sola: el aviso de «no se pudo guardar» se
 * esfumaba y la recarga volvía a perder el cambio sin preguntar.
 */
export const RECORDAR_GUARDADO = Number.POSITIVE_INFINITY;

function claves(objeto: unknown): string {
  return objeto && typeof objeto === "object" ? Object.keys(objeto).sort().join(",") : "";
}

/**
 * A qué DATO afecta una escritura, para saber si un éxito posterior resuelve un error.
 *
 * Un fallo al guardar los días efectivos queda resuelto cuando esos días se
 * guardan después con éxito, no cuando se guarda el nombre de la cotización. Por
 * eso la firma distingue el tipo, la fila afectada y los campos que viajaban.
 *
 * Un alta es siempre distinta de otra, y por eso su firma es el INTENTO
 * (`mutationId`), no su contenido. Re-revisión de Codex: con la firma por
 * contenido, fallar al añadir «Taza» y añadir después otra «Taza» idéntica con
 * éxito borraba el error de la primera. Una línea que no se pudo añadir no se da
 * por añadida porque se añada otra; su aviso solo se quita descartándolo.
 */
export function firmaDeGuardado(tipo: string, variables: unknown, intento: number): string {
  const v = variables as Record<string, unknown> | number | null | undefined;
  switch (tipo) {
    case "linea-editar":
    case "tarea-editar": {
      const objeto = (v ?? {}) as Record<string, unknown>;
      const fila = objeto.lineId ?? objeto.laborId;
      return `${tipo}:${String(fila)}:${claves(objeto.payload)}`;
    }
    case "linea-borrar":
    case "tarea-borrar":
      return `${tipo}:${String(v)}`;
    case "linea-anadir":
    case "tarea-anadir":
      return `${tipo}:#${intento}`;
    case "planificacion":
      return tipo;
    default:
      return `${tipo}:${claves(v)}`;
  }
}

/** Dónde se arregla cada tipo de escritura, y cómo se le llama al usuario. */
export const DESTINO_DE_GUARDADO: Record<
  TipoDeGuardado,
  { paso: "cliente" | "productos" | "materiales" | "mano-de-obra" | "quema" | "precio"; que: string }
> = {
  cabecera: { paso: "cliente", que: "los datos de la cotización" },
  "linea-anadir": { paso: "productos", que: "una línea nueva" },
  "linea-editar": { paso: "productos", que: "una línea de producto" },
  "linea-borrar": { paso: "productos", que: "quitar una línea" },
  "tarea-anadir": { paso: "mano-de-obra", que: "una tarea nueva" },
  "tarea-editar": { paso: "mano-de-obra", que: "una tarea" },
  "tarea-borrar": { paso: "mano-de-obra", que: "quitar una tarea" },
  planificacion: { paso: "mano-de-obra", que: "los días efectivos" },
  ilustracion: { paso: "mano-de-obra", que: "la ilustración" },
  quema: { paso: "quema", que: "la quema" },
  precio: { paso: "precio", que: "el factor comercial" },
};

/** Si una clave de consulta pertenece a los datos de UNA cotización. */
function esDeLaCotizacion(queryKey: readonly unknown[], quotationId: number): boolean {
  if (queryKey[0] === QUOTER_V2_KEY[0]) return queryKey[1] === quotationId;
  if (queryKey[0] !== "quoter-v2") return false;
  const alcances = [V2_LINES_KEY, V2_LABOR_KEY, V2_ILLUSTRATION_KEY, V2_FIRING_KEY, V2_PRICING_KEY];
  return alcances.some((clave) => clave[1] === queryKey[1]) && queryKey[2] === quotationId;
}

/** Cuántas veces se vuelve a mirar una consulta que todavía no tiene su dato. */
const INTENTOS_DE_FRESCURA = 5;

function refetchExacto(client: QueryClient, consulta: Query): Promise<void> {
  // `refetchQueries` y no `consulta.fetch`: pasa por la misma vía que el resto
  // de la aplicación, y la regla de arquitectura que reserva las llamadas de
  // red al cliente centralizado no tiene que abrir una excepción. Sin cancelar:
  // si hay un fetch en curso, se engancha a él.
  return client.refetchQueries(
    { queryKey: consulta.queryKey, exact: true, type: "active" },
    { cancelRefetch: false },
  );
}

/**
 * Espera a que las consultas ACTIVAS de la cotización tengan un dato obtenido
 * por un fetch que empezó DESPUÉS del guardado, y dice si lo consiguió.
 *
 * Se llama justo cuando `mutateAsync` resuelve. La frescura no se infiere de
 * una marca de tiempo —la quinta revisión de Codex tumbó esa versión—, sino de
 * saber qué fetch empezó cuándo:
 *
 * - una consulta que YA TENÍA datos: la invalidación del `onSuccess` canceló su
 *   fetch anterior, así que el que está en curso empezó después del commit. Se
 *   engancha a él, o lanza uno si no hay ninguno;
 * - una consulta en su CARGA INICIAL, sin datos: TanStack no cancela ese fetch
 *   (no hay datos que conservar) y pudo empezar ANTES del guardado. Se espera a
 *   que termine sin creerle, y se lanza OTRO, que empieza con certeza después.
 *
 * Para cada consulta, la frontera son sus contadores de actualización justo
 * antes del fetch que cuenta —no marcas de tiempo: dos cosas en el mismo
 * milisegundo empataban—. Fresco si llegó un dato después; no fresco si llegó
 * un error y ningún dato. Un error de un fetch anterior al guardado no cuenta.
 *
 * Solo las activas: las de un panel desmontado quedan invalidadas y se
 * refrescan al volver a montarse, y ningún campo suyo espera nada.
 */
export async function asegurarFrescura(client: QueryClient, quotationId: number): Promise<boolean> {
  const filtro = {
    type: "active" as const,
    // Las desactivadas no se refrescan (`refetchQueries` las salta): esperarlas
    // agotaría los intentos y daría un «no fresco» que no dice nada.
    predicate: (consulta: Query) =>
      esDeLaCotizacion(consulta.queryKey, quotationId) && !consulta.isDisabled() && !consulta.isStatic(),
  };
  const frontera = new Map<Query, { datos: number; errores: number }>();
  const marcar = (consulta: Query) =>
    frontera.set(consulta, {
      datos: consulta.state.dataUpdateCount,
      errores: consulta.state.errorUpdateCount,
    });

  const sinDatos: Query[] = [];
  for (const consulta of client.getQueryCache().findAll(filtro)) {
    if (consulta.state.data === undefined) sinDatos.push(consulta);
    else marcar(consulta);
  }
  if (sinDatos.length > 0) {
    // Se deja terminar la carga inicial, que pudo empezar antes del guardado...
    await Promise.all(sinDatos.map((consulta) => refetchExacto(client, consulta)));
    // ...y la frontera de estas consultas pasa a ser el fetch que empieza AHORA.
    for (const consulta of sinDatos) marcar(consulta);
    await Promise.all(sinDatos.map((consulta) => refetchExacto(client, consulta)));
  }

  const estado = () => {
    let fallo = false;
    const viejas: Query[] = [];
    for (const [consulta, base] of frontera) {
      // Una consulta que dejó de estar activa ya no la espera ningún campo.
      if (!consulta.isActive()) continue;
      if (consulta.state.dataUpdateCount > base.datos) continue;
      if (consulta.state.errorUpdateCount > base.errores) fallo = true;
      else viejas.push(consulta);
    }
    return { fallo, viejas };
  };

  for (let intento = 0; intento < INTENTOS_DE_FRESCURA; intento += 1) {
    const { fallo, viejas } = estado();
    if (fallo) return false;
    if (viejas.length === 0) return true;
    await Promise.all(viejas.map((consulta) => refetchExacto(client, consulta)));
  }
  const { fallo, viejas } = estado();
  return !fallo && viejas.length === 0;
}

// --- comprobaciones de frescura en curso, por cotización ----------------------

const comprobaciones = new Map<number, number>();
const oyentesDeComprobacion = new Set<() => void>();

function cambiarComprobaciones(quotationId: number, delta: number): void {
  const siguiente = (comprobaciones.get(quotationId) ?? 0) + delta;
  if (siguiente <= 0) comprobaciones.delete(quotationId);
  else comprobaciones.set(quotationId, siguiente);
  for (const oyente of oyentesDeComprobacion) oyente();
}

/**
 * Cuántos guardados de la cotización esperan todavía a que su dato llegue.
 *
 * El PUT ya terminó, pero la pantalla todavía no enseña lo guardado. Quinta
 * revisión de Codex: sin esto el pie decía «Todos los cambios guardados» en
 * ese intervalo. Cuenta como «guardando», que es lo que el usuario ve.
 */
export function useComprobacionesEnCurso(quotationId: number): number {
  return useSyncExternalStore(
    (oyente) => {
      oyentesDeComprobacion.add(oyente);
      return () => oyentesDeComprobacion.delete(oyente);
    },
    () => comprobaciones.get(quotationId) ?? 0,
    () => 0,
  );
}

/**
 * Guarda y devuelve el resultado al campo que lo pidió, sin rechazar nunca.
 *
 * `ok` dice si el SERVIDOR aceptó el cambio; `fresco`, si la pantalla ya tiene
 * el dato posterior a ese cambio, comprobado con `asegurarFrescura`. El campo
 * solo se alinea con lo guardado cuando las dos cosas son ciertas. Mientras se
 * comprueba, cuenta como «guardando». Un fallo no rechaza la promesa: devuelve
 * `ok: false` y la firma, para que un descarte sepa a qué campo revertir.
 */
export async function esperarGuardado<V>(
  contexto: { client: QueryClient; quotationId: number },
  mutacion: { mutateAsync: (variables: V) => Promise<unknown> },
  tipo: TipoDeGuardado,
  variables: V,
): Promise<ResultadoDeGuardado> {
  // Las firmas de edición no dependen del intento; las altas no pasan por aquí.
  const firma = firmaDeGuardado(tipo, variables, 0);
  try {
    await mutacion.mutateAsync(variables);
  } catch {
    return { ok: false, firma };
  }
  cambiarComprobaciones(contexto.quotationId, +1);
  try {
    const fresco = await asegurarFrescura(contexto.client, contexto.quotationId);
    return { ok: true, firma, fresco };
  } finally {
    cambiarComprobaciones(contexto.quotationId, -1);
  }
}

/** `esperarGuardado` ya atado al cliente y a la cotización del componente. */
export function useEsperarGuardado(quotationId: number) {
  const client = useQueryClient();
  return <V>(
    mutacion: { mutateAsync: (variables: V) => Promise<unknown> },
    tipo: TipoDeGuardado,
    variables: V,
  ) => esperarGuardado({ client, quotationId }, mutacion, tipo, variables);
}
