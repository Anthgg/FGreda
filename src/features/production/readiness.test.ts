import { describe, expect, it } from "vitest";

import {
  canCancel,
  canComplete,
  canStart,
  describeIssue,
  describeShortfall,
  describeStatus,
  explainIssue,
  issuesForLine,
  statusTone,
  stockIssues,
} from "@/features/production/readiness";
import type { ProductionReadinessCode, ReadinessIssue } from "@/types/production";

function issue(overrides: Partial<ReadinessIssue> = {}): ReadinessIssue {
  return {
    code: "MISSING_RECIPE",
    production_order_line_id: null,
    quotation_item_id: null,
    prepared_product_id: null,
    prepared_product_name: null,
    required_quantity: null,
    available_quantity: null,
    uom: null,
    ...overrides,
  };
}

const TODOS: ProductionReadinessCode[] = [
  "MISSING_RECIPE",
  "MISSING_MATERIAL_GRAMS",
  "MISSING_QUANTITY",
  "PREPARED_PRODUCT_NOT_RESOLVABLE",
  "PREPARED_STOCK_MISSING",
  "INSUFFICIENT_STOCK",
  "UNSUPPORTED_UOM_CONVERSION",
  "INVALID_STOCK_LOCATION",
];

describe("traducción de los códigos de bloqueo", () => {
  it("traduce todos los códigos que el backend puede emitir", () => {
    // Si el backend añade un código y aquí no se traduce, la pantalla enseñaría
    // jerga interna. El compilador ya lo impide en el Record; esto comprueba
    // además que ninguna traducción quedó vacía o con el propio código dentro.
    for (const code of TODOS) {
      const texto = describeIssue(issue({ code }));
      expect(texto.length).toBeGreaterThan(0);
      expect(texto).not.toContain("_");
      expect(texto).not.toBe(code);
    }
  });

  it("distingue «no se ha preparado nunca» de «no alcanza»", () => {
    // Son dos problemas distintos y se arreglan mirando sitios distintos.
    // Decirlos igual haría buscar existencia donde nunca la hubo.
    expect(describeIssue(issue({ code: "PREPARED_STOCK_MISSING" }))).not.toBe(
      describeIssue(issue({ code: "INSUFFICIENT_STOCK" })),
    );
  });

  it("no repite el título en la explicación larga", () => {
    for (const code of TODOS) {
      const detalle = explainIssue(issue({ code }));
      if (detalle === null) continue;
      expect(detalle).not.toBe(describeIssue(issue({ code })));
    }
  });
});

describe("las cantidades se muestran tal como llegan", () => {
  it("no convierte los decimales a número", () => {
    // El backend manda los importes y las cantidades como texto justamente
    // para que nadie los pase por un `number`. Un requerimiento con muchos
    // decimales perdería precisión al «formatearlo», y el número que se
    // enseñaría no sería el que se va a descontar.
    const texto = describeShortfall(
      issue({
        code: "INSUFFICIENT_STOCK",
        required_quantity: "2012.500000000001",
        available_quantity: "0.000000000000",
        uom: "g",
      }),
    );
    expect(texto).toContain("2012.500000000001");
    expect(texto).toContain("0.000000000000");
    expect(texto).toContain("g");
  });

  it("no dice nada cuando no hay cifras que comparar", () => {
    expect(describeShortfall(issue({ code: "MISSING_RECIPE" }))).toBeNull();
  });

  it("omite la unidad si el backend no la manda", () => {
    const texto = describeShortfall(
      issue({ code: "INSUFFICIENT_STOCK", required_quantity: "10", available_quantity: "2" }),
    );
    expect(texto).toBe("Necesita 10 · disponible 2");
  });
});

describe("reparto de los avisos", () => {
  const avisos = [
    issue({ code: "MISSING_RECIPE", production_order_line_id: 1, quotation_item_id: 11 }),
    issue({ code: "MISSING_MATERIAL_GRAMS", production_order_line_id: 2, quotation_item_id: 12 }),
    issue({ code: "INSUFFICIENT_STOCK", prepared_product_id: 391 }),
  ];

  it("separa lo que es de una línea de lo que es del saldo", () => {
    // Un faltante de stock no es de ninguna línea en particular: dos líneas que
    // piden el mismo barniz comparten un saldo y un veredicto. Repetirlo en
    // cada una haría creer que faltan dos materiales distintos.
    expect(issuesForLine(avisos, 1).map((a) => a.code)).toEqual(["MISSING_RECIPE"]);
    expect(issuesForLine(avisos, 2).map((a) => a.code)).toEqual(["MISSING_MATERIAL_GRAMS"]);
    expect(stockIssues(avisos).map((a) => a.code)).toEqual(["INSUFFICIENT_STOCK"]);
  });

  it("una línea sin problemas no se queda con los del saldo", () => {
    expect(issuesForLine(avisos, 3)).toEqual([]);
  });
});

describe("qué acciones se ofrecen", () => {
  it("arrancar sólo se ofrece si está creada Y hay material", () => {
    expect(canStart("CREATED", true)).toBe(true);
    expect(canStart("CREATED", false)).toBe(false);
    expect(canStart("STARTED", true)).toBe(false);
    expect(canStart("COMPLETED", true)).toBe(false);
    expect(canStart("CANCELLED", true)).toBe(false);
  });

  it("completar sólo tras arrancar", () => {
    expect(canComplete("STARTED")).toBe(true);
    expect(canComplete("CREATED")).toBe(false);
    expect(canComplete("COMPLETED")).toBe(false);
  });

  it("anular sólo ANTES de arrancar", () => {
    // Una orden arrancada ya gastó material, y anularla no lo devuelve.
    // Ofrecer el botón haría prometer una reversión que no existe.
    expect(canCancel("CREATED")).toBe(true);
    expect(canCancel("STARTED")).toBe(false);
    expect(canCancel("COMPLETED")).toBe(false);
    expect(canCancel("CANCELLED")).toBe(false);
  });
});

describe("estados", () => {
  it("dice cada estado en castellano y con su tono", () => {
    expect(describeStatus("CREATED")).toBe("Creada");
    expect(describeStatus("STARTED")).toBe("En proceso");
    expect(describeStatus("COMPLETED")).toBe("Completada");
    expect(describeStatus("CANCELLED")).toBe("Anulada");

    expect(statusTone("COMPLETED")).toBe("positive");
    expect(statusTone("CANCELLED")).toBe("neutral");
  });
});
