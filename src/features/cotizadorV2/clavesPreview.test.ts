import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  V2_PREVIEW_KEY,
  V2_PRICING_KEY,
  asegurarFrescura,
  invalidarCotizacion,
} from "@/features/cotizadorV2/claves";
import { V2_PREVIEW_KEY as V2_PREVIEW_KEY_DEL_CICLO } from "@/features/cotizadorV2/useQuoterV2Lifecycle";

/**
 * El resumen de emisión tras un guardado (010O.3).
 *
 * El shell nuevo enseña los pendientes a la vista, y salen del resumen de
 * emisión. Dos promesas que tienen que cumplirse a la vez:
 *
 * 1. tras cualquier guardado el resumen se vuelve a pedir —si no, la lista de
 *    pendientes seguiría diciendo «falta el horno» con el horno ya elegido—;
 * 2. NADIE lo espera: ni el «Guardando…» del pie ni `asegurarFrescura`. Un
 *    campo no tiene por qué decir «guardando» durante un GET que no pinta.
 */

const ID = 7;

/** Una consulta ACTIVA cuya primera carga responde y las siguientes no terminan. */
async function consultaActiva(
  client: QueryClient,
  queryKey: readonly unknown[],
  dato: unknown,
) {
  const queryFn = vi
    .fn()
    .mockResolvedValueOnce(dato)
    .mockImplementation(() => new Promise(() => {}));
  const observador = new QueryObserver(client, { queryKey, queryFn });
  const baja = observador.subscribe(() => {});
  await vi.waitFor(() => expect(client.getQueryData(queryKey)).toEqual(dato));
  return { queryFn, baja };
}

describe("el resumen de emisión tras un guardado", () => {
  const bajas: (() => void)[] = [];
  afterEach(() => {
    while (bajas.length > 0) bajas.pop()?.();
  });

  it("la clave es UNA: la de los hooks del ciclo de vida es la de claves.ts", () => {
    expect(V2_PREVIEW_KEY_DEL_CICLO).toBe(V2_PREVIEW_KEY);
  });

  it("invalidarCotizacion marca el resumen de ESA cotización, y solo el de esa", async () => {
    const client = new QueryClient();
    client.setQueryData([...V2_PREVIEW_KEY, ID], { blockers: [] });
    client.setQueryData([...V2_PREVIEW_KEY, 8], { blockers: [] });

    await invalidarCotizacion(client, ID);

    expect(client.getQueryState([...V2_PREVIEW_KEY, ID])?.isInvalidated).toBe(true);
    expect(client.getQueryState([...V2_PREVIEW_KEY, 8])?.isInvalidated).toBe(false);
  });

  it("un resumen activo se vuelve a pedir tras el guardado", async () => {
    const client = new QueryClient();
    const { queryFn, baja } = await consultaActiva(client, [...V2_PREVIEW_KEY, ID], {
      blockers: [],
    });
    bajas.push(baja);

    void invalidarCotizacion(client, ID);

    await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
  });

  it("el «guardando» de invalidarCotizacion no espera al resumen", async () => {
    const client = new QueryClient();
    // El refetch del resumen no termina nunca: si la promesa lo esperara, esta
    // prueba se colgaría.
    const { baja } = await consultaActiva(client, [...V2_PREVIEW_KEY, ID], { blockers: [] });
    bajas.push(baja);

    await expect(invalidarCotizacion(client, ID)).resolves.toBeUndefined();
  });

  it("asegurarFrescura no espera al resumen, aunque esté activo y en vuelo", async () => {
    const client = new QueryClient();
    const { baja } = await consultaActiva(client, [...V2_PREVIEW_KEY, ID], { blockers: [] });
    bajas.push(baja);
    void client.invalidateQueries({ queryKey: [...V2_PREVIEW_KEY, ID] });

    await expect(asegurarFrescura(client, ID)).resolves.toBe(true);
  });

  it("control: asegurarFrescura SÍ espera a una consulta de la cotización", async () => {
    // Sin este control, la prueba anterior pasaría igual si asegurarFrescura no
    // esperara a nada. El precio es de la cotización: con su refetch colgado,
    // la frescura no llega.
    const client = new QueryClient();
    const { baja } = await consultaActiva(client, [...V2_PRICING_KEY, ID], { total: "1" });
    bajas.push(baja);
    void client.invalidateQueries({ queryKey: [...V2_PRICING_KEY, ID] });

    const resultado = await Promise.race([
      asegurarFrescura(client, ID).then(() => "terminó"),
      new Promise((resolver) => setTimeout(() => resolver("sigue esperando"), 50)),
    ]);
    expect(resultado).toBe("sigue esperando");
  });
});
