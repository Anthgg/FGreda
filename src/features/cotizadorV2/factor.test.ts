import { describe, expect, it } from "vitest";

import {
  etiquetaDeFactor,
  factorSeleccionado,
  opcionesDeFactor,
  pasoDeFactor,
  valoresDeFactor,
} from "@/features/cotizadorV2/factor";

/**
 * Los factores elegibles (010O.10) salen del rango congelado en la cotización,
 * nunca de un ×2–×3 escrito en la pantalla.
 */
describe("factores elegibles", () => {
  it("de ×2 a ×3 en pasos de 0,25", () => {
    expect(valoresDeFactor(null, "2.000000", "3.000000")).toEqual([2, 2.25, 2.5, 2.75, 3]);
  });

  it("el paso se abre cuando el rango crece", () => {
    expect(pasoDeFactor(2, 4)).toBe(0.25);
    expect(pasoDeFactor(2, 6)).toBe(0.5);
    expect(pasoDeFactor(2, 10)).toBe(1);
    expect(valoresDeFactor(null, "2", "10")).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("un techo que no cae en un paso entra igual", () => {
    expect(valoresDeFactor(null, "2", "3.1")).toEqual([2, 2.25, 2.5, 2.75, 3, 3.1]);
  });

  it("el factor guardado fuera de paso aparece, en su sitio", () => {
    expect(valoresDeFactor("2.100000", "2", "3")).toEqual([2, 2.1, 2.25, 2.5, 2.75, 3]);
  });

  it("sin rango congelado NO inventa uno", () => {
    expect(valoresDeFactor(null, null, null)).toEqual([]);
    expect(valoresDeFactor(null, "2", null)).toEqual([]);
    // Lo guardado se sigue viendo aunque no haya rango.
    expect(valoresDeFactor("2.5", null, null)).toEqual([2.5]);
  });

  it("un rango al revés no produce opciones", () => {
    expect(valoresDeFactor(null, "3", "2")).toEqual([]);
  });

  it("las etiquetas son multiplicadores, no porcentajes", () => {
    expect(etiquetaDeFactor("2.500000")).toBe("×2.50");
    expect(opcionesDeFactor(null, "2", "2.5").map((opcion) => opcion.label)).toEqual([
      "×2.00",
      "×2.25",
      "×2.50",
    ]);
  });

  it("el guardado se reconoce como número aunque llegue con ceros", () => {
    const opciones = opcionesDeFactor("3.000000", "2", "3");
    expect(factorSeleccionado("3.000000", opciones)).toBe("3");
    expect(factorSeleccionado(null, opciones)).toBeNull();
  });
});
