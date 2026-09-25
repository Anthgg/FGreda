import { QueryClient, QueryClientProvider, type UseQueryResult } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmitirCotizacion } from "@/features/cotizadorV2Next/steps/review/EmitirCotizacion";
import { resumenDeEmision } from "@/test/v2next/shellFixtures";
import type { V2ConfirmationPreview } from "@/types/quoterV2";

/**
 * Emitir no puede adelantarse a un guardado (010O.11): con cambios en vuelo,
 * sin guardar o rechazados, el resumen que se ve ya no es el que se emitiría.
 */

const estado = vi.hoisted(() => ({
  enVuelo: 0,
  borradores: 0,
  fallidos: [] as unknown[],
}));

vi.mock("@/features/cotizadorV2/useEstadoDeGuardado", () => ({
  useEstadoDeGuardado: () => ({
    ...estado,
    hayRiesgo: estado.enVuelo > 0 || estado.borradores > 0 || estado.fallidos.length > 0,
    descartar: () => {},
  }),
}));

function pintar(resumen: Partial<UseQueryResult<V2ConfirmationPreview>>) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <EmitirCotizacion
        quotationId={7}
        resumen={
          {
            data: resumenDeEmision(),
            isFetching: false,
            refetch: vi.fn(),
            ...resumen,
          } as unknown as UseQueryResult<V2ConfirmationPreview>
        }
      />
    </QueryClientProvider>,
  );
}

describe("emitir espera a los guardados", () => {
  it("sin nada pendiente, se puede emitir", () => {
    Object.assign(estado, { enVuelo: 0, borradores: 0, fallidos: [] });
    pintar({});
    expect(screen.getByRole("button", { name: "Emitir cotización" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("Después ya no se edita.");
  });

  it("con un guardado en vuelo, espera", () => {
    Object.assign(estado, { enVuelo: 1, borradores: 0, fallidos: [] });
    pintar({});
    expect(screen.getByRole("button", { name: "Emitir cotización" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Espere a que terminen de guardarse");
  });

  it("con lo tecleado sin salir del campo, espera", () => {
    Object.assign(estado, { enVuelo: 0, borradores: 1, fallidos: [] });
    pintar({});
    expect(screen.getByRole("button", { name: "Emitir cotización" })).toBeDisabled();
  });

  it("con un guardado rechazado, pide resolverlo", () => {
    Object.assign(estado, { enVuelo: 0, borradores: 0, fallidos: [{}] });
    pintar({});
    expect(screen.getByRole("button", { name: "Emitir cotización" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("no se guardaron");
  });

  it("mientras el resumen se vuelve a pedir, espera", () => {
    Object.assign(estado, { enVuelo: 0, borradores: 0, fallidos: [] });
    pintar({ isFetching: true });
    expect(screen.getByRole("button", { name: "Emitir cotización" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Actualizando el resumen");
  });
});
