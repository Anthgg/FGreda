import { describe, expect, it } from "vitest";
import {
  formatMoney,
  formatPercent,
  formatNumber,
  formatVolume,
  formatHours,
  formatDimension
} from "./formatters";

describe("formatters", () => {
  it("formatMoney", () => {
    expect(formatMoney("2695.850000000")).toBe("S/ 2,695.85");
    expect(formatMoney("450")).toBe("S/ 450.00");
    expect(formatMoney("5.85")).toBe("S/ 5.85");
    expect(formatMoney("450", "USD")).toBe("US$ 450.00");
    expect(formatMoney(0)).toBe("S/ 0.00");
    expect(formatMoney(null)).toBe("");
  });

  it("formatPercent", () => {
    expect(formatPercent("12.100000")).toBe("12.1 %");
    expect(formatPercent("70.941285577")).toBe("70.94 %");
    expect(formatPercent(100)).toBe("100 %");
    expect(formatPercent(null)).toBe("");
  });

  it("formatNumber", () => {
    expect(formatNumber("1.000000")).toBe("1");
    expect(formatNumber("1.250000")).toBe("1.25");
    expect(formatNumber("0.001300000")).toBe("0.0013");
    expect(formatNumber(24200.000000)).toBe("24,200");
    expect(formatNumber(null)).toBe("");
  });

  it("formatVolume", () => {
    expect(formatVolume("24200.000000")).toBe("24,200 cm³");
    expect(formatVolume(0)).toBe("0 cm³");
  });

  it("formatHours", () => {
    expect(formatHours("8.000000")).toBe("8 h");
    expect(formatHours("8.500000")).toBe("8.5 h");
  });

  it("formatDimension", () => {
    expect(formatDimension("22.000000")).toBe("22 cm");
  });
});
