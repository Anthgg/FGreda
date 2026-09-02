import { describe, expect, it } from "vitest";

import { estadoPublico, fechaLegible, hitosDe } from "@/features/tracking/estado";
import type { PublicTracking } from "@/types/tracking";

function seguimiento(parcial: Partial<PublicTracking> = {}): PublicTracking {
  return {
    company_name: "LABERINTO S.A.C.",
    order_code: "OP-2026-000002",
    status: "CREATED",
    created_at: "2026-09-02T11:06:00Z",
    started_at: null,
    completed_at: null,
    cancelled_at: null,
    items: [],
    ...parcial,
  };
}

describe("cómo se lee un estado fuera del taller", () => {
  it("dice si la pieza se está haciendo, no el vocabulario de la casa", () => {
    // Dentro se dice «Creada» y «En proceso» porque quien lo lee conoce el
    // taller. Quien escanea, no: «Creada» no le dice si ya la están haciendo.
    expect(estadoPublico("CREATED").label).toBe("Orden creada");
    expect(estadoPublico("STARTED").label).toBe("En producción");
    expect(estadoPublico("COMPLETED").label).toBe("Producción completada");
    expect(estadoPublico("CANCELLED").label).toBe("Orden anulada");
  });

  it("los cuatro estados tienen tono, sin ninguno en el genérico", () => {
    const tonos = (["CREATED", "STARTED", "COMPLETED", "CANCELLED"] as const).map(
      (estado) => estadoPublico(estado).tono,
    );
    expect(new Set(tonos).size).toBe(4);
  });
});

describe("la línea de tiempo", () => {
  it("marca hecho lo que ocurrió y deja pendiente lo que no", () => {
    const hitos = hitosDe(seguimiento({ status: "STARTED", started_at: "2026-09-02T11:07:00Z" }));

    expect(hitos.map((h) => h.hecho)).toEqual([true, true, false]);
    expect(hitos[2]?.fecha).toBeNull();
  });

  it("una orden anulada no enseña «Producción iniciada» en gris", () => {
    // Nunca llegó a fabricarse. Dejar el hito ahí, aunque sea apagado,
    // sugeriría que algo se hizo y luego se deshizo.
    const hitos = hitosDe(
      seguimiento({ status: "CANCELLED", cancelled_at: "2026-09-02T12:00:00Z" }),
    );

    expect(hitos.map((h) => h.label)).toEqual(["Orden creada", "Orden anulada"]);
    expect(hitos.every((h) => h.hecho)).toBe(true);
  });

  it("una completada cuenta los tres hitos", () => {
    const hitos = hitosDe(
      seguimiento({
        status: "COMPLETED",
        started_at: "2026-09-02T11:07:00Z",
        completed_at: "2026-09-02T11:11:00Z",
      }),
    );

    expect(hitos).toHaveLength(3);
    expect(hitos.every((h) => h.hecho)).toBe(true);
  });
});

describe("las fechas", () => {
  it("una fecha que no se puede interpretar no se enseña", () => {
    // Antes que escribir «Invalid Date» en una pantalla que mira un cliente,
    // no se escribe nada y el hito queda como pendiente.
    expect(fechaLegible("no es una fecha")).toBeNull();
    expect(fechaLegible(null)).toBeNull();
  });

  it("una fecha válida se escribe legible", () => {
    expect(fechaLegible("2026-09-02T11:06:00Z")).toMatch(/2026/);
  });
});
