import { describe, expect, it } from "vitest";

import { capabilitiesFor } from "@/features/auth/capabilities";

describe("qué se le ofrece a cada rol", () => {
  it("el taller ejecuta la cadena física entera", () => {
    // Si faltara un solo eslabón, el operario tendría que ir a buscar a un
    // administrador a mitad de la fabricación: el material que consume una
    // orden sale de una preparación, y la preparación de materia prima que
    // alguien carga.
    const operario = capabilitiesFor("OPERATOR");

    expect(operario.ajustarInventario).toBe(true);
    expect(operario.prepararReceta).toBe(true);
    expect(operario.crearOrdenProduccion).toBe(true);
    expect(operario.arrancarProduccion).toBe(true);
    expect(operario.completarProduccion).toBe(true);
  });

  it("anular no es del taller", () => {
    // No es ejecución sino deshacer un compromiso ya tomado, y deja la
    // cotización de origen ocupada para siempre, porque no admite una segunda
    // orden. Es decisión administrativa.
    expect(capabilitiesFor("OPERATOR").anularProduccion).toBe(false);
    expect(capabilitiesFor("ADMIN").anularProduccion).toBe(true);
  });

  it("abrir un almacén y lo comercial siguen siendo administrativos", () => {
    const operario = capabilitiesFor("OPERATOR");
    expect(operario.crearAlmacen).toBe(false);
    expect(operario.gestionComercial).toBe(false);
  });

  it("el administrador no pierde nada al ampliar lo del taller", () => {
    const admin = capabilitiesFor("ADMIN");
    expect(Object.values(admin).every(Boolean)).toBe(true);
  });

  it("sin sesión no se ofrece nada", () => {
    // `undefined` llega mientras la sesión aún se está resolviendo. Ofrecer
    // botones en ese hueco los enseñaría un instante a cualquiera.
    const nadie = capabilitiesFor(undefined);
    expect(Object.values(nadie).some(Boolean)).toBe(false);
  });
});
