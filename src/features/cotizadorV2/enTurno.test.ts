import { describe, expect, it } from "vitest";

import { enTurno } from "./claves";

/** Una tarea que se queda abierta hasta que la prueba la suelte. */
function abierta() {
  let soltar: () => void = () => undefined;
  let fallar: (error: Error) => void = () => undefined;
  const promesa = new Promise<void>((resolver, rechazar) => {
    soltar = resolver;
    fallar = rechazar;
  });
  return { promesa, soltar, fallar };
}

const tick = () => new Promise((resolver) => setTimeout(resolver, 0));

describe("enTurno: una cotización, una petición al backend a la vez", () => {
  it("la segunda no empieza hasta que termina la primera", async () => {
    const orden: string[] = [];
    const primera = abierta();
    const a = enTurno(7, async () => {
      orden.push("empieza pricing");
      await primera.promesa;
      orden.push("termina pricing");
    });
    const b = enTurno(7, async () => {
      orden.push("empieza PUT");
    });
    await tick();
    expect(orden).toEqual(["empieza pricing"]);
    primera.soltar();
    await Promise.all([a, b]);
    expect(orden).toEqual(["empieza pricing", "termina pricing", "empieza PUT"]);
  });

  it("otra cotización no espera", async () => {
    const primera = abierta();
    const a = enTurno(7, () => primera.promesa);
    let otra = false;
    await enTurno(8, async () => {
      otra = true;
    });
    expect(otra).toBe(true);
    primera.soltar();
    await a;
  });

  it("un fallo no bloquea la fila y llega a quien lo pidió", async () => {
    const primera = abierta();
    const a = enTurno(7, () => primera.promesa);
    const b = enTurno(7, async () => "siguiente");
    primera.fallar(new Error("deadlock"));
    await expect(a).rejects.toThrow("deadlock");
    await expect(b).resolves.toBe("siguiente");
  });
});
