import { describe, expect, it } from "vitest";

import { formatCosto, formatPrecio } from "./moneda";

describe("moneda", () => {
  it("un costo va siempre en moneda base", () => {
    expect(formatCosto("1068.880000")).toBe("S/ 1068.88");
  });

  it("un precio va en la moneda de la cotización, con su símbolo congelado", () => {
    expect(formatPrecio("100", { currency_code: "USD", currency_symbol: "US$" })).toBe("US$ 100.00");
  });

  it("sin cifra no se pinta una moneda suelta", () => {
    expect(formatCosto(null)).toBe("—");
    expect(formatCosto(undefined)).toBe("—");
    expect(formatPrecio(null, { currency_code: "PEN" })).toBe("—");
  });
});
