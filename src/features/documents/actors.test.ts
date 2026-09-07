import { describe, expect, it } from "vitest";

import { nombreDeActor, SIN_ACTOR } from "@/features/documents/actors";

/**
 * Fase 009K.2 — el actor de un documento, en pantalla.
 *
 * El navegador no resuelve identidades: recibe el nombre ya congelado desde
 * BGreda y lo escribe. Lo único que decide aquí es qué poner cuando no hay
 * nada que poner, y eso tiene que decirlo igual en todas las pantallas.
 */
describe("nombreDeActor", () => {
  it("devuelve el nombre congelado tal cual", () => {
    expect(nombreDeActor("Jesús Garamendi")).toBe("Jesús Garamendi");
  });

  it("un documento sin actor dice que no consta", () => {
    // No es un valor por defecto: es la verdad sobre ese documento. Los
    // anteriores a esta fase no registraron a nadie.
    expect(nombreDeActor(null)).toBe(SIN_ACTOR);
    expect(nombreDeActor(undefined)).toBe(SIN_ACTOR);
  });

  it("un nombre en blanco cuenta como ausente, no como nombre", () => {
    // Un hueco de espacios se leería como un fallo de maquetación.
    expect(nombreDeActor("   ")).toBe(SIN_ACTOR);
  });

  it("no inventa identidades a partir de nada", () => {
    // Ni «Administrador», ni el usuario en sesión, ni un correo.
    expect(nombreDeActor("")).toBe(SIN_ACTOR);
    expect(SIN_ACTOR).toBe("No registrado");
  });
});
