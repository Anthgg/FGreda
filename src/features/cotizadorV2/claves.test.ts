import { describe, expect, it } from "vitest";

import { firmaDeGuardado } from "@/features/cotizadorV2/claves";

/**
 * A que dato afecta cada escritura (Fase 010G).
 *
 * La firma decide si un exito posterior resuelve un error anterior. Equivocarse
 * en un sentido deja un aviso que no se va nunca; en el otro, borra el aviso de
 * un cambio que de verdad se perdio.
 */
describe("firma de una escritura", () => {
  it("dos altas IDENTICAS son intentos distintos", () => {
    // Re-revision de Codex: con la firma por contenido, fallar al anadir «Taza»
    // y anadir despues otra «Taza» igual con exito borraba el error de la
    // primera, aunque esa linea nunca llego a existir.
    const cuerpo = { product_name: "Taza", quantity: 0 };
    expect(firmaDeGuardado("linea-anadir", cuerpo, 1)).not.toBe(
      firmaDeGuardado("linea-anadir", cuerpo, 2),
    );
    expect(firmaDeGuardado("tarea-anadir", cuerpo, 1)).not.toBe(
      firmaDeGuardado("tarea-anadir", cuerpo, 2),
    );
  });

  it("volver a guardar el MISMO dato de una linea comparte firma", () => {
    expect(
      firmaDeGuardado("linea-editar", { lineId: 7, payload: { quantity: 20 } }, 1),
    ).toBe(firmaDeGuardado("linea-editar", { lineId: 7, payload: { quantity: 21 } }, 2));
  });

  it("otro campo u otra linea no comparten firma", () => {
    const cantidad = firmaDeGuardado("linea-editar", { lineId: 7, payload: { quantity: 20 } }, 1);
    expect(firmaDeGuardado("linea-editar", { lineId: 7, payload: { height_cm: "3" } }, 2)).not.toBe(
      cantidad,
    );
    expect(firmaDeGuardado("linea-editar", { lineId: 8, payload: { quantity: 20 } }, 3)).not.toBe(
      cantidad,
    );
  });

  it("los dias efectivos son un solo dato, valgan lo que valgan", () => {
    expect(firmaDeGuardado("planificacion", 2, 1)).toBe(firmaDeGuardado("planificacion", 3, 2));
  });

  it("la cabecera se distingue por los campos que viajaban", () => {
    expect(firmaDeGuardado("cabecera", { name: "a" }, 1)).toBe(
      firmaDeGuardado("cabecera", { name: "b" }, 2),
    );
    expect(firmaDeGuardado("cabecera", { name: "a" }, 1)).not.toBe(
      firmaDeGuardado("cabecera", { notes: "a" }, 2),
    );
  });
});
