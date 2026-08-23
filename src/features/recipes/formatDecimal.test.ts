import { describe, expect, it } from "vitest";
import {
  addDecimalStrings,
  formatDecimal,
  sumDecimalStrings,
} from "./formatDecimal";

describe("formatDecimal & Decimal String Arithmetic (Zero IEEE-754)", () => {
  it("suma exacta de tercios porcentuales a escala 6 sin perdida de precision", () => {
    // 33.333333 + 33.333333 + 33.333334 = 100.000000
    const values = ["33.333333", "33.333333", "33.333334"];
    const sum = sumDecimalStrings(values, 6);
    expect(sum).toBe("100");
    expect(formatDecimal(sum, 2)).toBe("100");
  });

  it("suma de formula base 100.000000 + adicionales 6.123456 = 106.123456", () => {
    const base = "100.000000";
    const add = "6.123456";
    const total = addDecimalStrings(base, add, 6);
    expect(total).toBe("106.123456");
    expect(formatDecimal(total, 2)).toBe("106.12");
  });

  it("calculo de acumulados base usando strings sin conversion Float", () => {
    const lines = [
      { id: 1, percentage: "54.220000", type: "BASE" },
      { id: 2, percentage: "2.560000", type: "BASE" },
      { id: 3, percentage: "7.670000", type: "BASE" },
      { id: 4, percentage: "25.580000", type: "BASE" },
      { id: 5, percentage: "8.060000", type: "BASE" },
      { id: 6, percentage: "1.910000", type: "BASE" },
      { id: 7, percentage: "5.000000", type: "COLORANT" },
    ];

    let currentTotal = "0";
    const acumulados = new Map<number, string>();

    for (const line of lines) {
      if (line.type !== "BASE") continue;
      currentTotal = addDecimalStrings(currentTotal, line.percentage, 6);
      acumulados.set(line.id, formatDecimal(currentTotal, 2));
    }

    expect(acumulados.get(1)).toBe("54.22");
    expect(acumulados.get(2)).toBe("56.78");
    expect(acumulados.get(3)).toBe("64.45");
    expect(acumulados.get(4)).toBe("90.03");
    expect(acumulados.get(5)).toBe("98.09");
    expect(acumulados.get(6)).toBe("100");
    expect(currentTotal).toBe("100");
  });

  it("formatDecimal recorta ceros y maneja null/undefined/empty de forma segura", () => {
    expect(formatDecimal(null)).toBe("—");
    expect(formatDecimal(undefined)).toBe("—");
    expect(formatDecimal("")).toBe("—");
    expect(formatDecimal("100.000000")).toBe("100");
    expect(formatDecimal("1.050000", 4)).toBe("1.05");
    expect(formatDecimal("0.027143", 6)).toBe("0.027143");
    expect(formatDecimal("0.000000")).toBe("0");
  });
});
