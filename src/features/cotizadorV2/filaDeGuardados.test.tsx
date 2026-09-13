import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { updateV2QuotationProduct } from "@/api/quoterV2Materials";
import { useUpdateV2QuotationProduct } from "@/features/cotizadorV2/useQuoterV2Materials";

vi.mock("@/api/quoterV2Materials", () => ({
  addV2QuotationProduct: vi.fn(),
  deleteV2QuotationProduct: vi.fn(),
  fetchV2Materials: vi.fn(),
  fetchV2QuotationProducts: vi.fn(),
  updateV2QuotationProduct: vi.fn(),
  upsertV2Material: vi.fn(),
}));

/**
 * Las escrituras de una cotización salen de una en una, en el orden pedido.
 *
 * Lo encontró la E2E de la revisión: `alto = 20` y, 165 ms después,
 * `alto = 20.5`, enviados a la vez, llegaron al backend en orden inverso y quedó
 * `20`. Ver `alcanceDeGuardado` en `claves.ts`.
 */

const COTIZACION = 11;
const actualizar = vi.mocked(updateV2QuotationProduct);

let clientes: QueryClient[] = [];
afterEach(() => {
  for (const cliente of clientes) cliente.clear();
  clientes = [];
  actualizar.mockReset();
});

function montar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clientes.push(client);
  const envoltorio = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useUpdateV2QuotationProduct(COTIZACION), { wrapper: envoltorio });
}

function peticionesControladas() {
  const pendientes: { resolver: () => void; rechazar: (e: Error) => void }[] = [];
  actualizar.mockImplementation(
    () =>
      new Promise((resolver, rechazar) => {
        pendientes.push({ resolver: () => resolver({} as never), rechazar });
      }),
  );
  return pendientes;
}

const esperarTics = () => new Promise((r) => setTimeout(r, 10));

describe("fila de guardados de una cotización", () => {
  it("una segunda escritura no sale hasta que termina la primera", async () => {
    const pendientes = peticionesControladas();
    const { result } = montar();

    let primera: Promise<unknown> | undefined;
    let segunda: Promise<unknown> | undefined;
    act(() => {
      primera = result.current.mutateAsync({ lineId: 3, payload: { height_cm: "20" } });
      segunda = result.current.mutateAsync({ lineId: 3, payload: { height_cm: "20.5" } });
    });
    await act(esperarTics);

    // La segunda espera su turno: una sola petición en el servidor.
    expect(actualizar).toHaveBeenCalledTimes(1);
    expect(actualizar).toHaveBeenLastCalledWith(COTIZACION, 3, { height_cm: "20" });

    await act(async () => {
      pendientes[0]!.resolver();
      await primera;
      await esperarTics();
    });
    // Solo entonces sale la segunda, que es la que queda la última.
    expect(actualizar).toHaveBeenCalledTimes(2);
    expect(actualizar).toHaveBeenLastCalledWith(COTIZACION, 3, { height_cm: "20.5" });

    await act(async () => {
      pendientes[1]!.resolver();
      await segunda;
    });
  });

  it("un fallo no atasca la fila: la siguiente escritura sale igual", async () => {
    const pendientes = peticionesControladas();
    const { result } = montar();

    let primera: Promise<unknown> | undefined;
    let segunda: Promise<unknown> | undefined;
    act(() => {
      primera = result.current.mutateAsync({ lineId: 3, payload: { height_cm: "20" } }).catch(() => "fallo");
      segunda = result.current.mutateAsync({ lineId: 3, payload: { height_cm: "20.5" } });
    });
    await act(esperarTics);
    expect(actualizar).toHaveBeenCalledTimes(1);

    await act(async () => {
      pendientes[0]!.rechazar(new Error("500"));
      await expect(primera).resolves.toBe("fallo");
      await esperarTics();
    });
    expect(actualizar).toHaveBeenCalledTimes(2);

    await act(async () => {
      pendientes[1]!.resolver();
      await segunda;
    });
  });

  it("toda escritura con clave de guardado de la cotización va en su fila", () => {
    // Una mutación nueva sin `scope` volvería a enviar en paralelo, y la
    // carrera solo se ve bajo carga. Se comprueba en el código, no en runtime.
    const carpeta = join(process.cwd(), "src", "features", "cotizadorV2");
    let conClave = 0;
    for (const nombre of readdirSync(carpeta).filter((n) => /^useQuoterV2.*\.ts$/.test(n))) {
      const lineas = readFileSync(join(carpeta, nombre), "utf-8").split(/\r?\n/);
      lineas.forEach((linea, i) => {
        if (!linea.includes("mutationKey: claveDeGuardado(")) return;
        conClave += 1;
        expect(lineas[i + 1], `${nombre}:${i + 2}`).toMatch(/scope: alcanceDeGuardado\(/);
      });
    }
    expect(conClave).toBe(11);
  });
});
