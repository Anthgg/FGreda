import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  asegurarFrescura,
  esperarGuardado,
  invalidarCotizacion,
  useComprobacionesEnCurso,
  V2_LABOR_KEY,
} from "@/features/cotizadorV2/claves";

/**
 * La garantía de que un campo solo se alinea con un dato POSTERIOR a su guardado.
 *
 * Cuarta revisión de Codex. Esperar a `invalidateQueries` no garantiza que el
 * dato haya llegado: si el refetch FALLA, el error se traga y la invalidación
 * resuelve con el dato viejo. El campo recibía `ok` y se alineaba con lo guardado
 * viejo. La revisión apuntaba además a la cancelación por otra invalidación; eso
 * NO ocurre en esta versión —la cancelada se engancha al fetch nuevo— y la
 * primera prueba lo deja fijado. Todas usan un `QueryClient` real, porque lo que
 * se prueba es precisamente su comportamiento.
 */

const COTIZACION = 7;
const CLAVE = [...V2_LABOR_KEY, COTIZACION] as const;

let clientes: QueryClient[] = [];
afterEach(() => {
  for (const cliente of clientes) cliente.clear();
  clientes = [];
});

/** Una consulta ACTIVA —con observador— cuyo fetch controla la prueba. */
function consultaControlada() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clientes.push(client);
  const pendientes: { resolver: (valor: number) => void; rechazar: (e: Error) => void }[] = [];
  let valorDelServidor = 1;
  const observador = new QueryObserver(client, {
    queryKey: CLAVE,
    queryFn: () =>
      new Promise<number>((resolver, rechazar) => {
        pendientes.push({ resolver, rechazar });
      }),
  });
  const desuscribir = observador.subscribe(() => undefined);
  return {
    client,
    pendientes,
    fijarServidor: (valor: number) => {
      valorDelServidor = valor;
    },
    responder: (indice: number) => pendientes[indice]!.resolver(valorDelServidor),
    fallar: (indice: number) => pendientes[indice]!.rechazar(new Error("refetch caido")),
    datos: () => client.getQueryData<number>(CLAVE),
    desuscribir,
  };
}

async function hastaQue(condicion: () => boolean) {
  for (let i = 0; i < 50 && !condicion(); i += 1) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

describe("las premisas, comprobadas en TanStack real", () => {
  it("una invalidación cancelada por otra NO resuelve antes: se engancha al fetch nuevo", async () => {
    // La cuarta revisión de Codex daba por hecho lo contrario, y esta prueba lo
    // desmintió: en esta versión, una cancelación silenciosa «piggybacks onto
    // that promise» (query-core, query.ts). La primera espera al dato del fetch
    // nuevo. Si una versión futura cambiara esto, `asegurarFrescura` lo cubre.
    const q = consultaControlada();
    await hastaQue(() => q.pendientes.length === 1);
    q.responder(0);
    await hastaQue(() => q.datos() === 1);

    const primera = q.client.invalidateQueries({ queryKey: CLAVE });
    await hastaQue(() => q.pendientes.length >= 2);
    void q.client.invalidateQueries({ queryKey: CLAVE });
    await hastaQue(() => q.pendientes.length >= 3);

    let resuelta = false;
    void primera.then(() => {
      resuelta = true;
    });
    await new Promise((r) => setTimeout(r, 5));
    expect(resuelta).toBe(false);

    q.fijarServidor(2);
    q.responder(q.pendientes.length - 1);
    await primera;
    expect(q.datos()).toBe(2);
    q.desuscribir();
  });

  it("un refetch que FALLA resuelve la invalidación igual, con el dato viejo", async () => {
    // Esta es la mitad cierta del hallazgo, y la que justifica comprobar la
    // frescura: el error se traga (`catch(noop)`), la invalidación «termina» y,
    // si el campo se fiara de eso, se alinearía con lo guardado viejo.
    const q = consultaControlada();
    await hastaQue(() => q.pendientes.length === 1);
    q.responder(0);
    await hastaQue(() => q.datos() === 1);

    const invalidacion = q.client.invalidateQueries({ queryKey: CLAVE });
    await hastaQue(() => q.pendientes.length >= 2);
    q.fallar(1);

    await expect(invalidacion).resolves.toBeUndefined();
    expect(q.datos()).toBe(1);
    q.desuscribir();
  });
});

describe("asegurarFrescura", () => {
  it("con el dato posterior al guardado ya presente, es fresco", async () => {
    const q = consultaControlada();
    await hastaQue(() => q.pendientes.length === 1);
    q.responder(0);
    await hastaQue(() => q.datos() === 1);
    // El dato llega DESPUES del instante del guardado: se simula esperando un tic.
    await new Promise((r) => setTimeout(r, 2));

    const promesa = asegurarFrescura(q.client, COTIZACION);
    await hastaQue(() => q.pendientes.length === 2);
    q.fijarServidor(2);
    q.responder(1);

    await expect(promesa).resolves.toBe(true);
    expect(q.datos()).toBe(2);
    q.desuscribir();
  });

  it("si otra invalidación CANCELA el refetch, sigue esperando el dato fresco", async () => {
    const q = consultaControlada();
    await hastaQue(() => q.pendientes.length === 1);
    q.responder(0);
    await hastaQue(() => q.datos() === 1);
    await new Promise((r) => setTimeout(r, 2));

    // El guardado de ESTE campo termina y empieza su refetch.
    void q.client.invalidateQueries({ queryKey: CLAVE });
    const promesa = asegurarFrescura(q.client, COTIZACION);
    await hastaQue(() => q.pendientes.length >= 2);

    // Otro guardado invalida y CANCELA ese refetch antes de que responda.
    void q.client.invalidateQueries({ queryKey: CLAVE });
    await hastaQue(() => q.pendientes.length >= 3);

    let resuelta = false;
    void promesa.then(() => {
      resuelta = true;
    });
    await new Promise((r) => setTimeout(r, 5));
    // Antes, con el refetch cancelado, se daba por terminado aquí mismo.
    expect(resuelta).toBe(false);

    q.fijarServidor(3);
    q.responder(q.pendientes.length - 1);

    await expect(promesa).resolves.toBe(true);
    expect(q.datos()).toBe(3);
    q.desuscribir();
  });

  it("si el refetch FALLA, no es fresco: el campo no se alinea con el dato viejo", async () => {
    const q = consultaControlada();
    await hastaQue(() => q.pendientes.length === 1);
    q.responder(0);
    await hastaQue(() => q.datos() === 1);
    await new Promise((r) => setTimeout(r, 2));

    const promesa = asegurarFrescura(q.client, COTIZACION);
    await hastaQue(() => q.pendientes.length === 2);
    q.fallar(1);

    await expect(promesa).resolves.toBe(false);
    // El dato de la pantalla sigue siendo el viejo: por eso el campo no se alinea.
    expect(q.datos()).toBe(1);
    q.desuscribir();
  });

  it("no espera consultas de OTRA cotización", async () => {
    const q = consultaControlada();
    await hastaQue(() => q.pendientes.length === 1);
    // La consulta activa es de la cotización 7 y nunca responde; se pregunta por la 8.
    await expect(asegurarFrescura(q.client, 8)).resolves.toBe(true);
    q.desuscribir();
  });

  it("una CARGA INICIAL anterior al guardado no cuenta como fresca: espera otro fetch", async () => {
    // Quinta revisión de Codex. Sin datos previos, TanStack no cancela el fetch
    // en curso; si empezó antes del commit y responde después, su marca de
    // tiempo es posterior al guardado, pero su dato es ANTERIOR.
    const q = consultaControlada();
    await hastaQue(() => q.pendientes.length === 1);
    // El GET inicial sigue en vuelo cuando el guardado termina.
    await new Promise((r) => setTimeout(r, 2));
    const promesa = asegurarFrescura(q.client, COTIZACION);
    let resuelta = false;
    void promesa.then(() => {
      resuelta = true;
    });

    // Responde con lo que había ANTES del guardado.
    q.responder(0);
    await hastaQue(() => q.pendientes.length === 2);
    await new Promise((r) => setTimeout(r, 5));
    expect(q.datos()).toBe(1);
    expect(resuelta).toBe(false);

    // Solo el fetch que empezó después trae lo guardado.
    q.fijarServidor(2);
    q.responder(1);
    await expect(promesa).resolves.toBe(true);
    expect(q.datos()).toBe(2);
    q.desuscribir();
  });

  it("el error de una carga inicial anterior al guardado no lo marca como no fresco", async () => {
    const q = consultaControlada();
    await hastaQue(() => q.pendientes.length === 1);
    await new Promise((r) => setTimeout(r, 2));
    const promesa = asegurarFrescura(q.client, COTIZACION);

    q.fallar(0);
    await hastaQue(() => q.pendientes.length === 2);
    q.fijarServidor(2);
    q.responder(1);

    await expect(promesa).resolves.toBe(true);
    expect(q.datos()).toBe(2);
    q.desuscribir();
  });

  it("si el fetch posterior de una carga inicial falla, no es fresco", async () => {
    const q = consultaControlada();
    await hastaQue(() => q.pendientes.length === 1);
    const promesa = asegurarFrescura(q.client, COTIZACION);
    q.responder(0);
    await hastaQue(() => q.pendientes.length === 2);
    q.fallar(1);
    await expect(promesa).resolves.toBe(false);
    q.desuscribir();
  });

  it("no espera consultas desactivadas", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    clientes.push(client);
    const observador = new QueryObserver(client, {
      queryKey: CLAVE,
      queryFn: () => Promise.resolve(1),
      enabled: false,
    });
    const desuscribir = observador.subscribe(() => undefined);
    await expect(asegurarFrescura(client, COTIZACION)).resolves.toBe(true);
    desuscribir();
  });
});

describe("invalidarCotizacion", () => {
  it("tras una carga inicial en vuelo pide otro fetch, que empieza después del guardado", async () => {
    const q = consultaControlada();
    await hastaQue(() => q.pendientes.length === 1);

    const invalidacion = invalidarCotizacion(q.client, COTIZACION);
    // La carga inicial, anterior al guardado, responde con el dato viejo.
    q.responder(0);
    await hastaQue(() => q.pendientes.length === 2);
    expect(q.pendientes).toHaveLength(2);

    q.fijarServidor(2);
    q.responder(1);
    await invalidacion;
    expect(q.datos()).toBe(2);
    q.desuscribir();
  });
});

describe("comprobaciones de frescura en curso", () => {
  it("un guardado aceptado cuenta mientras su dato no ha llegado", async () => {
    const q = consultaControlada();
    await hastaQue(() => q.pendientes.length === 1);
    q.responder(0);
    await hastaQue(() => q.datos() === 1);

    const { result, unmount } = renderHook(() => useComprobacionesEnCurso(COTIZACION));
    expect(result.current).toBe(0);

    await new Promise((r) => setTimeout(r, 2));
    let resultado: Promise<unknown> | undefined;
    act(() => {
      resultado = esperarGuardado(
        { client: q.client, quotationId: COTIZACION },
        { mutateAsync: () => Promise.resolve() },
        "planificacion",
        { effective_work_days: 2 },
      );
    });
    // El PUT terminó y la comprobación ha lanzado su refetch: todavía «guardando».
    await act(async () => {
      await hastaQue(() => q.pendientes.length === 2);
    });
    expect(result.current).toBe(1);

    q.fijarServidor(2);
    q.responder(1);
    await act(async () => {
      await resultado;
    });
    expect(result.current).toBe(0);
    unmount();
    q.desuscribir();
  });
});

