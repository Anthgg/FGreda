/**
 * Auditoría de mensajes: ningún código técnico llega a la pantalla.
 *
 * Los códigos siguen existiendo y siguen siendo la autoridad del backend. Lo
 * que estos tests impiden es que se muestren literalmente: un usuario no tiene
 * por qué saber qué es `MATERIAL_GRAMS_PER_PIECE_REQUIRED`.
 */

import { describe, expect, it } from "vitest";

import {
  describeWarning,
  describeWarnings,
  isKnownWarning,
  warningStep,
} from "@/features/quotations/domainWarnings";

/** Los códigos que el backend puede mandar a la UI del Cotizador. */
const BACKEND_WARNING_CODES = [
  "QUOTATION_NAME_REQUIRED",
  "CUSTOMER_REQUIRED",
  "ITEM_REQUIRED",
  "QUANTITY_REQUIRED",
  "PRODUCTION_DIMENSIONS_REQUIRED",
  "FIRING_REQUIRED",
  "FIRING_KILN_REQUIRED",
  "KILN_REQUIRED",
  "KILN_CAPACITY_EXCEEDED",
  "RECIPE_REQUIRED",
  "MATERIAL_GRAMS_PER_PIECE_REQUIRED",
  "MATERIAL_WITHOUT_COST",
  "CUSTOM_DIMENSIONS_NOT_ALLOWED_FOR_CONFIRMED_FIRING",
  "MIXED_TAX_RATES",
  "GLAZE_PIECE_WEIGHT_REQUIRED",
  "GLAZE_ML_REQUIRES_PREPARATION",
  "IGV_RATE_NOT_CONFIGURED",
  "FIRING_LINE_REQUIRED",
];

describe("Avisos de dominio · catálogo", () => {
  it("todo código que el backend puede mandar tiene mensaje humano", () => {
    const sinTraducir = BACKEND_WARNING_CODES.filter((code) => !isKnownWarning(code));
    expect(sinTraducir).toEqual([]);
  });

  it("ningún mensaje contiene el código técnico", () => {
    // TECHNICAL_CODE_PRESERVED_IN_CONTRACT: el código sigue existiendo en el
    // contrato; lo que no puede es asomar en el texto.
    for (const code of BACKEND_WARNING_CODES) {
      const message = describeWarning(code);
      expect(message).not.toBeNull();
      expect(message).not.toContain(code);
      expect(message).not.toMatch(/[A-Z]{3,}_[A-Z_]{3,}/);
    }
  });

  it("los mensajes explican qué falta, no cómo se llama por dentro", () => {
    expect(describeWarning("FIRING_REQUIRED")).toMatch(/quema baja o una quema alta/i);
    expect(describeWarning("RECIPE_REQUIRED")).toMatch(/receta/i);
    expect(describeWarning("MATERIAL_GRAMS_PER_PIECE_REQUIRED")).toMatch(/gramos/i);
    expect(describeWarning("CUSTOMER_REQUIRED")).toMatch(/cliente/i);
  });

  it("un código desconocido no se muestra crudo", () => {
    // UNKNOWN_ERROR_SAFE_FALLBACK: se descarta antes que enseñar jerga. El
    // usuario no puede hacer nada con un código que ni siquiera reconocemos.
    expect(describeWarning("ALGO_QUE_NO_EXISTE")).toBeNull();
    expect(describeWarnings(["FIRING_REQUIRED", "ALGO_QUE_NO_EXISTE"])).toEqual([
      describeWarning("FIRING_REQUIRED"),
    ]);
  });

  it("dice dónde se corrige lo que se corrige en un paso concreto", () => {
    expect(warningStep("FIRING_REQUIRED")).toBe("PRODUCCION");
    expect(warningStep("CUSTOMER_REQUIRED")).toBe("DATOS");
    expect(warningStep("PRODUCTION_DIMENSIONS_REQUIRED")).toBe("PIEZAS");
    // Un aviso informativo no manda a ningún sitio: un botón que no lleva a
    // ninguna parte es peor que no tener botón.
    expect(warningStep("MIXED_TAX_RATES")).toBeNull();
  });
});
