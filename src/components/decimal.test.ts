import { describe, expect, it } from "vitest";

import {
  decimalCanonico,
  interpretarDecimal,
  interpretarEntero,
  paraEditar,
} from "@/components/decimal";

/**
 * La normalización numérica del Cotizador V2 (Fase 010G).
 *
 * Estas pruebas fijan las tres reglas que arrastrábamos sin resolver desde
 * 010C, y una por cada forma conocida de perder dinero en un campo de texto:
 *
 * 1. **la coma es un separador decimal**, no un error. Rechazarla le enseña un
 *    fallo a quien acaba de teclear algo correcto;
 * 2. **el campo vacío no es cero.** Borrar «20» para escribir «50» pasa por la
 *    cadena vacía, y convertirla en 0 pondría un importe a cero a mitad de una
 *    pulsación;
 * 3. **un texto inválido no vale `null`.** `null` significa «quítalo» en toda
 *    la familia V2; confundirlo con «esto no se entiende» borraría un valor
 *    pactado por un error de tecleo.
 */

describe("interpretación de un campo decimal", () => {
  it("acepta la coma peruana igual que el punto", () => {
    expect(interpretarDecimal("2,5")).toEqual({ tipo: "valido", canonico: "2.5" });
    expect(interpretarDecimal("2.5")).toEqual({ tipo: "valido", canonico: "2.5" });
  });

  it("los dos separadores dan el mismo número", () => {
    const conComa = interpretarDecimal("1,25");
    const conPunto = interpretarDecimal("1.25");
    expect(conComa).toEqual(conPunto);
    expect(conComa).toEqual({ tipo: "valido", canonico: "1.25" });
  });

  it("el campo vacío es ausencia, nunca cero", () => {
    expect(interpretarDecimal("")).toEqual({ tipo: "vacio" });
    expect(interpretarDecimal("   ")).toEqual({ tipo: "vacio" });
  });

  it("un número a medio escribir no es un número", () => {
    // Pasan la forma pero no son un valor: son el instante en que alguien
    // acaba de teclear el signo o el separador.
    for (const texto of ["-", ".", ","]) {
      expect(interpretarDecimal(texto).tipo).toBe("invalido");
    }
  });

  it("admite un decimal a medio escribir y lo manda sin el separador suelto", () => {
    // «2,» es lo que hay en pantalla justo antes de teclear el decimal: que se
    // acepte evita que el campo se ponga en rojo mientras se escribe. Pero lo
    // que sale hacia la API es «2», porque «2.» no es una forma canonica y
    // tabular justo ahi no puede mandar un separador colgando.
    expect(interpretarDecimal("2,")).toEqual({ tipo: "valido", canonico: "2" });
    expect(interpretarDecimal("2.")).toEqual({ tipo: "valido", canonico: "2" });
  });

  it("rechaza lo que no es un número y dice por qué", () => {
    const estado = interpretarDecimal("abc");
    expect(estado.tipo).toBe("invalido");
    if (estado.tipo === "invalido") {
      expect(estado.motivo).toMatch(/coma o punto/i);
    }
  });

  it("rechaza dos separadores", () => {
    expect(interpretarDecimal("1.2.3").tipo).toBe("invalido");
    expect(interpretarDecimal("1,2,3").tipo).toBe("invalido");
  });

  it("rechaza negativos salvo que se permitan expresamente", () => {
    // Un peso, una tarifa o una cantidad negativa no son un descuento.
    expect(interpretarDecimal("-5").tipo).toBe("invalido");
    expect(interpretarDecimal("-5", { permitirNegativo: true })).toEqual({
      tipo: "valido",
      canonico: "-5",
    });
  });

  it("no toca la precisión", () => {
    // Dieciocho decimales llegan enteros: pasar por `Number` los rompería.
    expect(interpretarDecimal("0,000000000000000001")).toEqual({
      tipo: "valido",
      canonico: "0.000000000000000001",
    });
  });
});

describe("el texto canónico que viaja a la API", () => {
  it("convierte la coma antes de salir del navegador", () => {
    expect(decimalCanonico("2,5")).toBe("2.5");
  });

  it("un campo vacío manda null: eso significa quitarlo", () => {
    expect(decimalCanonico("")).toBeNull();
  });

  it("un texto inválido no manda nada, y eso NO es null", () => {
    // La diferencia es la que impide que un error de tecleo borre un valor
    // pactado: `null` retira el acuerdo, `undefined` no llega a salir.
    expect(decimalCanonico("abc")).toBeUndefined();
    expect(decimalCanonico("abc")).not.toBeNull();
  });
});

describe("enteros", () => {
  it("acepta un entero", () => {
    expect(interpretarEntero("20")).toEqual({ tipo: "valido", canonico: "20" });
  });

  it("quita los ceros de cabeza sin pasar por Number", () => {
    expect(interpretarEntero("0007")).toEqual({ tipo: "valido", canonico: "7" });
    expect(interpretarEntero("0")).toEqual({ tipo: "valido", canonico: "0" });
    // Dieciocho digitos sobreviven enteros: `Number` habria redondeado los
    // ultimos y nadie lo habria notado hasta ver la cantidad equivocada.
    expect(interpretarEntero("123456789012345678")).toEqual({
      tipo: "valido",
      canonico: "123456789012345678",
    });
  });

  it("el vacío sigue siendo ausencia", () => {
    expect(interpretarEntero("")).toEqual({ tipo: "vacio" });
  });

  it("un decimal en un entero es un error, no un redondeo", () => {
    // Truncar «10,5 piezas» dejaría al usuario con media pieza menos sin que
    // nada se lo dijera.
    expect(interpretarEntero("10,5").tipo).toBe("invalido");
    expect(interpretarEntero("10.5").tipo).toBe("invalido");
  });

  it("rechaza negativos", () => {
    expect(interpretarEntero("-3").tipo).toBe("invalido");
  });
});

describe("cómo se enseña un número del backend", () => {
  it("quita los ceros de cola sin tocar el valor", () => {
    expect(paraEditar("500.000000")).toBe("500");
    expect(paraEditar("0.001300")).toBe("0.0013");
  });

  it("un entero sin separador se deja como está", () => {
    expect(paraEditar("20")).toBe("20");
  });

  it("un cero sigue siendo cero y no se queda vacío", () => {
    expect(paraEditar("0.000000")).toBe("0");
  });

  it("null y undefined son campo vacío", () => {
    expect(paraEditar(null)).toBe("");
    expect(paraEditar(undefined)).toBe("");
  });

  it("no pasa por Number, así que la precisión larga sobrevive", () => {
    expect(paraEditar("0.000000000000000001")).toBe("0.000000000000000001");
  });
});
