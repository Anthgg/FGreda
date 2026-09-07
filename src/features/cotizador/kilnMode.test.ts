import { describe, expect, it } from "vitest";

import { emptyCotizadorDraft, emptyCotizadorItem } from "@/features/cotizador/draft";
import type { CotizadorDraft } from "@/features/cotizador/draft";
import { applyKilnMode, kilnsInUse } from "@/features/cotizador/kilnMode";

/**
 * Fase 009K.3 — el cambio de modo, que es la parte que puede fallar callada.
 *
 * Elegir el modo no tiene misterio; lo que puede salir mal sin que se note es
 * lo que pasa con los hornos ya elegidos al cambiar. Dejar restos del modo
 * anterior haria que el backend planificara con ellos y el total no cuadrara
 * con lo que la pantalla dice; elegir por el usuario al volver a «todo junto»
 * cambiaria de horno piezas enteras en silencio.
 */

function borradorCon(items: CotizadorDraft["items"]): CotizadorDraft {
  return { ...emptyCotizadorDraft(), kilnId: "7", items };
}

function pieza(overrides: Partial<CotizadorDraft["items"][number]> = {}) {
  return { ...emptyCotizadorItem(), ...overrides };
}

describe("kilnsInUse", () => {
  it("no cuenta el horno de una quema que no esta seleccionada", () => {
    const items = [
      pieza({ lowKilnId: "1", lowKilnSelected: true, highKilnId: "2", highKilnSelected: false }),
    ];

    // El id de la quema alta sigue ahi —para que el usuario lo recupere si se
    // arrepiente— pero esa quema no existe, asi que su horno tampoco cuenta.
    expect(kilnsInUse(items)).toEqual(["1"]);
  });

  it("no repite un horno que usan varias piezas", () => {
    const items = [
      pieza({ lowKilnId: "4", lowKilnSelected: true, highKilnId: "4", highKilnSelected: true }),
      pieza({ lowKilnId: "4", lowKilnSelected: true, highKilnId: "", highKilnSelected: false }),
    ];

    expect(kilnsInUse(items)).toEqual(["4"]);
  });
});

describe("applyKilnMode", () => {
  it("hacia por producto cada pieza hereda el horno comun", () => {
    const draft = borradorCon([pieza({ lowKilnSelected: true, highKilnSelected: true })]);

    const siguiente = applyKilnMode(draft, "PER_PRODUCT");

    expect(siguiente.kilnMode).toBe("PER_PRODUCT");
    expect(siguiente.items[0]?.lowKilnId).toBe("7");
    expect(siguiente.items[0]?.highKilnId).toBe("7");
  });

  it("hacia por producto no pisa un horno que la pieza ya traia", () => {
    const draft = borradorCon([
      pieza({ lowKilnId: "9", lowKilnSelected: true, highKilnSelected: true }),
    ]);

    const siguiente = applyKilnMode(draft, "PER_PRODUCT");

    expect(siguiente.items[0]?.lowKilnId).toBe("9");
    expect(siguiente.items[0]?.highKilnId).toBe("7");
  });

  it("hacia todo junto conserva el horno si todas coincidian", () => {
    const draft = {
      ...borradorCon([
        pieza({ lowKilnId: "5", lowKilnSelected: true, highKilnId: "5", highKilnSelected: true }),
        pieza({ lowKilnId: "5", lowKilnSelected: true, highKilnId: "5", highKilnSelected: true }),
      ]),
      kilnMode: "PER_PRODUCT" as const,
      kilnId: "",
    };

    const siguiente = applyKilnMode(draft, "TOGETHER");

    expect(siguiente.kilnId).toBe("5");
    expect(siguiente.items.every((item) => item.lowKilnId === "" && item.highKilnId === "")).toBe(
      true,
    );
  });

  it("hacia todo junto NO elige el primero cuando habia hornos distintos", () => {
    const draft = {
      ...borradorCon([
        pieza({ lowKilnId: "5", lowKilnSelected: true, highKilnId: "5", highKilnSelected: true }),
        pieza({ lowKilnId: "8", lowKilnSelected: true, highKilnId: "8", highKilnSelected: true }),
      ]),
      kilnMode: "PER_PRODUCT" as const,
      kilnId: "",
    };

    const siguiente = applyKilnMode(draft, "TOGETHER");

    // Tomar el 5 cambiaria la segunda pieza de horno —y con el su tarifa, sus
    // hornadas y sus dias— sin que nadie lo hubiera pedido.
    expect(siguiente.kilnId).toBe("");
  });

  it("volver a todo junto no deja hornos por pieza", () => {
    const draft = {
      ...borradorCon([
        pieza({ lowKilnId: "5", lowKilnSelected: true, highKilnId: "8", highKilnSelected: true }),
      ]),
      kilnMode: "PER_PRODUCT" as const,
    };

    const siguiente = applyKilnMode(draft, "TOGETHER");

    expect(siguiente.items[0]?.lowKilnId).toBe("");
    expect(siguiente.items[0]?.highKilnId).toBe("");
  });

  it("elegir el modo que ya estaba no toca nada", () => {
    const draft = borradorCon([pieza({ lowKilnId: "3", lowKilnSelected: true })]);

    expect(applyKilnMode(draft, "TOGETHER")).toBe(draft);
  });
});
