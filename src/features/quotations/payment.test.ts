import { describe, expect, it } from "vitest";

import { canMarkPaid, describePayment, paymentDate, paymentTone } from "@/features/quotations/payment";

describe("cómo se dice el estado de cobro", () => {
  it("distingue no saber de saber que no se ha cobrado", () => {
    // Es la distinción central de 009H. Antes de esta fase el sistema no
    // registraba pagos, así que `null` significa que no hay dato — no que la
    // cotización esté impaga. Decir «Pendiente de pago» sobre una de 2026
    // sería afirmar algo que nadie comprobó.
    expect(describePayment(null)).toBe("Sin registro de pago");
    expect(describePayment("UNPAID")).toBe("Pendiente de pago");
    expect(describePayment(null)).not.toBe(describePayment("UNPAID"));
  });

  it("dice pagada cuando lo está", () => {
    expect(describePayment("PAID")).toBe("Pagada");
  });

  it("da un tono neutro a lo que no se sabe", () => {
    // Un aviso ámbar sobre una cotización histórica insinuaría una deuda que
    // nadie ha comprobado.
    expect(paymentTone(null)).toBe("neutral");
    expect(paymentTone("UNPAID")).toBe("warning");
    expect(paymentTone("PAID")).toBe("positive");
  });

  it("recorta la fecha de cobro y tolera su ausencia", () => {
    expect(paymentDate("2026-09-01T01:56:25.085215Z")).toBe("2026-09-01");
    expect(paymentDate(null)).toBeNull();
  });
});

describe("cuándo se ofrece cobrar", () => {
  it("sólo sobre una confirmada que no esté ya pagada", () => {
    expect(canMarkPaid("CONFIRMED", "UNPAID")).toBe(true);
    // El caso de las 18 confirmadas de producción: sin registro, pero se puede
    // registrar ahora.
    expect(canMarkPaid("CONFIRMED", null)).toBe(true);
  });

  it("no la ofrece dos veces sobre la misma", () => {
    expect(canMarkPaid("CONFIRMED", "PAID")).toBe(false);
  });

  it("no la ofrece sobre un borrador ni sobre una anulada", () => {
    // Un borrador todavía no es un compromiso y una anulada no se cobra. El
    // backend lo rechaza igual; aquí sólo se evita ofrecer algo que fallaría.
    expect(canMarkPaid("DRAFT", "UNPAID")).toBe(false);
    expect(canMarkPaid("DRAFT", null)).toBe(false);
    expect(canMarkPaid("CANCELLED", "UNPAID")).toBe(false);
    expect(canMarkPaid("CANCELLED", null)).toBe(false);
  });

  it("tampoco sobre una anulada que sí se cobró", () => {
    // CANCELLED + PAID es un estado representable y visible, pero no ofrece
    // acción: el cobro ya está registrado y anular no lo revierte.
    expect(canMarkPaid("CANCELLED", "PAID")).toBe(false);
  });
});
