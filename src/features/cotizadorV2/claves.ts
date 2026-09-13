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
  const refrescos: Promise<void>[] = [];
  for (const clave of [
    QUOTER_V2_KEY,
    V2_LINES_KEY,
    V2_LABOR_KEY,
    V2_ILLUSTRATION_KEY,
    V2_FIRING_KEY,
    V2_PRICING_KEY,
  ]) {
    refrescos.push(client.invalidateQueries({ queryKey: [...clave, quotationId] }));
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

/** Cuántas veces se vuelve a esperar un dato que un refetch ajeno cancelo. */
const INTENTOS_DE_FRESCURA = 5;

/**
 * Espera a que las consultas ACTIVAS de la cotización tengan un dato obtenido
 * después de este instante, y dice si lo consiguió.
 *
 * Se llama justo cuando `mutateAsync` resuelve. En ese momento el `onSuccess`
 * ya disparó la invalidación, que cancela los refetch anteriores al commit, así
 * que cualquier fetch en curso o futuro empezó DESPUÉS del guardado: lo que
 * resuelva a partir de aquí es fresco. Para cada consulta vieja se engancha al
 * fetch en curso sin cancelarlo (`cancelRefetch: false`) o lanza uno, y vuelve
 * a mirar, hasta cinco veces. En esta versión de TanStack un fetch cancelado
 * por otra invalidación se engancha al nuevo; el bucle no depende de ese
 * detalle interno.
 *
 * Devuelve `false` si alguna consulta FALLÓ al refrescar o se agotaron los
 * intentos: el guardado se hizo, pero la pantalla no tiene su dato.
 *
 * Solo las activas: las de un panel desmontado quedan invalidadas y se
 * refrescan al volver a montarse, y ningún campo suyo espera nada.
 */
export async function asegurarFrescura(client: QueryClient, quotationId: number): Promise<boolean> {
  const desde = Date.now();
  const filtro = {
    type: "active" as const,
    predicate: (consulta: Query) => esDeLaCotizacion(consulta.queryKey, quotationId),
  };
  for (let intento = 0; intento < INTENTOS_DE_FRESCURA; intento += 1) {
    const consultas = client.getQueryCache().findAll(filtro);
    if (consultas.some((consulta) => consulta.state.errorUpdatedAt >= desde)) return false;
    const viejas = consultas.filter((consulta) => consulta.state.dataUpdatedAt < desde);
    if (viejas.length === 0) return true;
    // `refetchQueries` y no `consulta.fetch`: pasa por la misma via que el resto
    // de la aplicacion, y la regla de arquitectura que reserva las llamadas de
    // red al cliente centralizado no tiene que abrir una excepcion. Se traga los
    // errores; por eso se mira `errorUpdatedAt` en la vuelta siguiente.
    await Promise.all(
      viejas.map((consulta) =>
        client.refetchQueries(
          { queryKey: consulta.queryKey, exact: true, type: "active" },
          { cancelRefetch: false },
        ),
      ),
    );
  }
  const consultas = client.getQueryCache().findAll(filtro);
  return (
    !consultas.some((consulta) => consulta.state.errorUpdatedAt >= desde) &&
    consultas.every((consulta) => consulta.state.dataUpdatedAt >= desde)
  );
}

/**
 * Guarda y devuelve el resultado al campo que lo pidió, sin rechazar nunca.
 *
 * `ok` dice si el SERVIDOR aceptó el cambio; `fresco`, si la pantalla ya tiene
 * el dato posterior a ese cambio, comprobado con `asegurarFrescura`. El campo
 * solo se alinea con lo guardado cuando las dos cosas son ciertas. Un fallo no
 * rechaza la promesa: devuelve `ok: false` y la firma, para que un descarte
 * sepa a qué campo revertir.
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
  const fresco = await asegurarFrescura(contexto.client, contexto.quotationId);
  return { ok: true, firma, fresco };
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
