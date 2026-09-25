import { describe, expect, it } from "vitest";

import { PASOS, type EstadoPaso, type PasoId, type Senal } from "@/features/cotizadorV2/pasos";
import {
  estadoVisualDePasos,
  primerPasoPendiente,
} from "@/features/cotizadorV2Next/shell/pasosDelAsistente";

/**
 * Cómo se juzga cada paso en la barra del shell (010O.3).
 *
 * Dos fuentes: `pasos.ts`, que es una pista instantánea, y los bloqueos del
 * backend, que son la autoridad. Lo que se protege aquí es que ninguna de las
 * dos pueda dar por listo lo que la otra sabe que falta, y que el estado no
 * dependa de dónde está uno en el asistente.
 */

const error = (mensaje: string): Senal => ({ severidad: "error", mensaje });
const aviso = (mensaje: string): Senal => ({ severidad: "aviso", mensaje });

function estados(senales: Partial<Record<PasoId, Senal[]>> = {}): EstadoPaso[] {
  return PASOS.map((paso) => {
    const suyas = senales[paso.id] ?? [];
    return { id: paso.id, completo: !suyas.some((s) => s.severidad === "error"), senales: suyas };
  });
}

const situacionDe = (visual: ReturnType<typeof estadoVisualDePasos>, id: PasoId) =>
  visual.find((paso) => paso.id === id);

describe("estado visual de los pasos", () => {
  it("mientras carga no opina: ningún paso sale en falta", () => {
    const visual = estadoVisualDePasos(estados({ cliente: [error("x")] }), undefined, true);
    expect(visual.map((paso) => paso.situacion)).toEqual(Array(7).fill("cargando"));
  });

  it("un bloqueo del backend pone su paso en falta aunque pasos.ts lo dé por bueno", () => {
    // pasos.ts deja pasar una pieza sin pasta si otra sí la tiene; el backend no.
    const visual = estadoVisualDePasos(
      estados({ materiales: [aviso("Una pieza no tiene pasta")] }),
      [{ code: "V2_CONFIRM_LINE_BODY_MATERIAL_REQUIRED", line_id: 11 }],
      false,
    );
    expect(situacionDe(visual, "materiales")).toMatchObject({ situacion: "falta", faltas: 1 });
  });

  it("lo que pasos.ts sabe que falta sigue en falta sin bloqueos todavía", () => {
    const visual = estadoVisualDePasos(estados({ cliente: [error("Falta el cliente")] }), undefined, false);
    expect(situacionDe(visual, "cliente")?.situacion).toBe("falta");
  });

  it("la misma falta dicha por las dos fuentes cuenta una vez", () => {
    const visual = estadoVisualDePasos(
      estados({ cliente: [error("Falta el cliente de la cotización.")] }),
      [{ code: "V2_CONFIRM_CUSTOMER_REQUIRED", line_id: null }],
      false,
    );
    expect(situacionDe(visual, "cliente")?.faltas).toBe(1);
  });

  it("un bloqueo sin paso se cuenta en «Revisar y emitir» y no ensucia otro paso", () => {
    const visual = estadoVisualDePasos(
      estados(),
      [{ code: "V2_CONFIRM_TAX_REQUIRED", line_id: null }],
      false,
    );
    expect(situacionDe(visual, "resumen")).toMatchObject({ situacion: "falta", faltas: 1 });
    expect(
      visual.filter((paso) => paso.id !== "resumen").every((paso) => paso.situacion === "listo"),
    ).toBe(true);
  });

  it("«Revisar y emitir» está en falta si lo está cualquier otro paso", () => {
    const visual = estadoVisualDePasos(
      estados(),
      [
        { code: "V2_CONFIRM_KILN_REQUIRED", line_id: null },
        { code: "V2_CONFIRM_FACTOR_REQUIRED", line_id: null },
      ],
      false,
    );
    expect(situacionDe(visual, "quema")?.situacion).toBe("falta");
    expect(situacionDe(visual, "resumen")).toMatchObject({ situacion: "falta", faltas: 2 });
  });

  it("un aviso no es una falta", () => {
    const visual = estadoVisualDePasos(estados({ quema: [aviso("Cabe en un horno más chico")] }), [], false);
    expect(situacionDe(visual, "quema")).toMatchObject({ situacion: "aviso", avisos: 1, faltas: 0 });
    expect(situacionDe(visual, "resumen")?.situacion).toBe("listo");
  });

  it("el estado no depende del paso en que uno está", () => {
    // Lo que tenía V2Next: «hecho» era todo lo anterior al paso actual.
    const visual = estadoVisualDePasos(estados({ productos: [error("Añada un producto")] }), [], false);
    expect(situacionDe(visual, "cliente")?.situacion).toBe("listo");
    expect(situacionDe(visual, "productos")?.situacion).toBe("falta");
    expect(situacionDe(visual, "precio")?.situacion).toBe("listo");
  });
});

describe("primer paso pendiente", () => {
  it("lleva al primero en falta, en orden", () => {
    const visual = estadoVisualDePasos(
      estados(),
      [
        { code: "V2_CONFIRM_FACTOR_REQUIRED", line_id: null },
        { code: "V2_CONFIRM_KILN_REQUIRED", line_id: null },
      ],
      false,
    );
    expect(primerPasoPendiente(visual)).toBe("quema");
  });

  it("sin nada en falta lleva a «Revisar y emitir»", () => {
    expect(primerPasoPendiente(estadoVisualDePasos(estados(), [], false))).toBe("resumen");
  });

  it("un bloqueo de configuración también lleva a «Revisar y emitir»", () => {
    const visual = estadoVisualDePasos(
      estados(),
      [{ code: "V2_CONFIRM_ROUNDING_REQUIRED", line_id: null }],
      false,
    );
    expect(primerPasoPendiente(visual)).toBe("resumen");
  });
});
