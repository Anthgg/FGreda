/**
 * Fase 009F — el formateo de dinero, en un solo sitio.
 *
 * Estas pruebas fijan lo que antes estaba repartido en catorce hardcodes y
 * cinco `money()` distintos. Lo que protegen no es el formato: es que un
 * importe en dólares no pueda aparecer encabezado por `S/`. El número sería
 * correcto y la etiqueta mentiría, que es la peor combinación posible en un
 * documento que el cliente firma.
 */

import { describe, expect, it } from "vitest";

import {
  CURRENCY_OPTIONS,
  currencySymbol,
  exchangeRateLabel,
  formatMoney,
} from "@/features/quotations/money";

describe("formatMoney", () => {
  it("PEN_FORMAT: los soles llevan S/", () => {
    expect(formatMoney("1160.00", "PEN")).toBe("S/ 1160.00");
  });

  it("USD_FORMAT: los dólares llevan US$, no $", () => {
    // En Perú un `$` suelto se lee como sol tan a menudo como como dólar, y
    // aquí la diferencia es de casi cuatro a uno.
    expect(formatMoney("950.00", "USD")).toBe("US$ 950.00");
    expect(formatMoney("950.00", "USD")).not.toBe("$ 950.00");
  });

  it("sin moneda cae en la base del sistema, que es PEN", () => {
    expect(formatMoney("10.00", null)).toBe("S/ 10.00");
    expect(formatMoney("10.00", undefined)).toBe("S/ 10.00");
  });

  it("respeta el símbolo congelado por el backend", () => {
    // Una confirmada tiene que verse igual el año que viene aunque cambie la
    // tabla de símbolos de esta versión del frontend.
    expect(formatMoney("10.00", "USD", { symbolSnapshot: "USD" })).toBe("USD 10.00");
  });

  it("un importe ausente no inventa un cero", () => {
    // Un hueco honesto es mejor que un cero que se lee como un precio real.
    expect(formatMoney(null, "PEN")).toBe("S/ —");
    expect(formatMoney("", "USD")).toBe("US$ —");
  });

  it("formatea la cadena decimal sin pasar por number", () => {
    // Convertirlo para mostrarlo es el primer paso hacia sumarlo con `+`, y
    // ahí es donde el dinero pierde céntimos.
    expect(formatMoney("0.1", "PEN")).toBe("S/ 0.10");
    expect(formatMoney("12345678901234.56", "PEN")).toBe("S/ 12345678901234.56");
  });

  it("una moneda desconocida se muestra por su código, no por un símbolo inventado", () => {
    expect(formatMoney("10.00", "EUR")).toBe("EUR 10.00");
  });
});

describe("currencySymbol", () => {
  it("el código manda; el símbolo es presentación", () => {
    expect(currencySymbol("PEN")).toBe("S/");
    expect(currencySymbol("USD")).toBe("US$");
  });

  it("el snapshot del backend gana al catálogo local", () => {
    expect(currencySymbol("USD", "$")).toBe("$");
  });
});

describe("exchangeRateLabel", () => {
  it("dice la dirección entera, no sólo el número", () => {
    // «3.75» a secas no aclara si hay que multiplicar o dividir, y esa duda
    // es exactamente la que hace que alguien cotice cuatro veces de más.
    expect(exchangeRateLabel("3.75")).toBe("1 USD = S/ 3.75");
  });

  it("sin tasa no hay etiqueta que mostrar", () => {
    expect(exchangeRateLabel(null)).toBeNull();
    expect(exchangeRateLabel("")).toBeNull();
  });
});

describe("selector de moneda", () => {
  it("PEN_SELECTOR y USD_SELECTOR: exactamente dos monedas", () => {
    // Fase 009F autoriza dos. Una tercera tiene que ser una decisión, no el
    // efecto colateral de que alguien añada una fila.
    expect(CURRENCY_OPTIONS.map((option) => option.value)).toEqual(["PEN", "USD"]);
  });

  it("las etiquetas nombran la moneda, no sólo el símbolo", () => {
    expect(CURRENCY_OPTIONS[0]?.label).toMatch(/Soles/);
    expect(CURRENCY_OPTIONS[1]?.label).toMatch(/Dólares/);
  });
});
