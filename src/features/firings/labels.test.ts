import { describe, expect, it } from "vitest";

import { formatDecimalString } from "./labels";

describe("formatDecimalString", () => {
  it("redondea a la mitad hacia arriba, como la hoja del negocio", () => {
    expect(formatDecimalString("23.356401", 2)).toBe("23.36");
    expect(formatDecimalString("1480.585", 2)).toBe("1480.59");
  });

  it("lee la notación científica de un Decimal multiplicado por cero", () => {
    // El costo de alguien del taller (horas × 0) llega como «0E-12».
    expect(formatDecimalString("0E-12", 2)).toBe("0.00");
    expect(formatDecimalString("0E+2", 2)).toBe("0.00");
    expect(formatDecimalString("1.5E+3", 2)).toBe("1500.00");
    expect(formatDecimalString("2.5E-2", 3)).toBe("0.025");
    expect(formatDecimalString("-4.25E1", 1)).toBe("-42.5");
  });

  it("lo que no es un número sigue siendo «—»", () => {
    expect(formatDecimalString("abc", 2)).toBe("—");
    expect(formatDecimalString("1E", 2)).toBe("—");
    expect(formatDecimalString(null, 2)).toBe("—");
  });
});
