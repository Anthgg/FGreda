/**
 * Auditoría de mensajes: ningún código técnico llega a la pantalla.
 *
 * Los códigos siguen existiendo y siguen siendo la autoridad del backend. Lo
 * que estos tests impiden es que se muestren literalmente: un usuario no tiene
 * por qué saber qué es `MATERIAL_GRAMS_PER_PIECE_REQUIRED`.
 */

import { describe, expect, it } from "vitest";

import { ApiError } from "@/api/client";
import {
  describeNextStep,
  describeWarning,
  describeWarnings,
  isKnownWarning,
  warningStep,
} from "@/features/quotations/domainWarnings";
import { describeError } from "@/features/settings/messages";

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
  // Material base de la pieza
  "BODY_MATERIAL_PRODUCT_INVALID",
  "BODY_MATERIAL_UOM_UNKNOWN",
  "BODY_MATERIAL_COST_UNAVAILABLE",
  "BODY_MATERIAL_UNSUPPORTED_UOM_COSTING",
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
    // El aviso del material en volumen tiene que explicar POR QUE no se puede
    // costear, no solo que no se puede: quien lo lee necesita saber que la
    // salida es registrarle un costo propio.
    expect(describeWarning("BODY_MATERIAL_UNSUPPORTED_UOM_COSTING")).toMatch(
      /concentraci[óo]n de cada lote/i,
    );
    expect(describeWarning("BODY_MATERIAL_COST_UNAVAILABLE")).toMatch(/costo/i);
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

// ---------------------------------------------------------------------------
// Errores de la API: la otra puerta por la que puede colarse un codigo
// ---------------------------------------------------------------------------

/** Un ApiError como los que construye el cliente, sin tocar la red. */
const apiError = (code: string, message: string) => new ApiError(code, message, 409);

describe("Errores del backend - Fase 009E", () => {
  const CODIGOS_009E = [
    "QUOTATION_BUILDER_NOT_EDITABLE",
    "QUOTATION_BUILDER_CONFLICT",
    "QUOTATION_BUILDER_SOURCE_CHANGED",
    "QUOTATION_BUILDER_INCOMPLETE",
    "FIXED_COST_ALLOCATION_BASE_ZERO",
    "PRODUCT_PRICE_UPDATE_NOT_ALLOWED",
  ];

  it("cada codigo nuevo tiene frase humana y ninguna repite el codigo", () => {
    for (const code of CODIGOS_009E) {
      const texto = describeError(apiError(code, code));
      expect(texto).not.toContain(code);
      expect(texto).not.toMatch(/[A-Z]{3,}_[A-Z_]{3,}/);
      expect(texto.length).toBeGreaterThan(20);
    }
  });

  it("UNKNOWN_ERROR_SAFE_FALLBACK: un codigo sin mapear no se muestra crudo", () => {
    // El backend responde a veces con el propio codigo por mensaje. Repetirlo
    // en pantalla no le dice nada a quien esta cotizando.
    const texto = describeError(apiError("ALGO_NUEVO_SIN_MAPEAR", "ALGO_NUEVO_SIN_MAPEAR"));
    expect(texto).not.toContain("ALGO_NUEVO_SIN_MAPEAR");
    expect(texto).toMatch(/Intente nuevamente/i);
  });

  it("EMPTY_ERROR_DETAILS_VISIBLE_AFTER: un mensaje vacio tampoco llega a la pantalla", () => {
    expect(describeError(apiError("LO_QUE_SEA", "   "))).toMatch(/Intente nuevamente/i);
  });

  it("un mensaje humano del backend se respeta tal cual", () => {
    // El filtro solo actua sobre jerga: no puede tragarse los mensajes buenos.
    const texto = "El lote ya fue confirmado y no admite cambios.";
    expect(describeError(apiError("CUALQUIERA", texto))).toBe(texto);
  });
});

describe("Paso siguiente del Cotizador", () => {
  it("los cuatro codigos del backend se dicen con el nombre de la pantalla", () => {
    // Los pasos se llaman asi en la barra del Cotizador. `ITEMS` no aparece
    // por ningun lado, asi que enseñarlo obliga al usuario a traducirlo.
    expect(describeNextStep("GENERAL_DATA")).toBe("Datos");
    expect(describeNextStep("ITEMS")).toBe("Piezas");
    expect(describeNextStep("PRODUCTION")).toBe("Producción");
    expect(describeNextStep("SUMMARY")).toBe("Resumen");
  });

  it("un paso desconocido o ausente no se muestra crudo", () => {
    expect(describeNextStep("PASO_NUEVO")).toBeNull();
    expect(describeNextStep(null)).toBeNull();
    expect(describeNextStep(undefined)).toBeNull();
  });
});

describe("Errores de validacion - Fase 009F", () => {
  /** Un 422 de Pydantic, tal y como llega del backend. */
  const validacion = (reason: string) =>
    new ApiError("VALIDATION_ERROR", "Datos invalidos", 422, [{ field: "", reason, type: "value_error" }]);

  it("un codigo dentro de un motivo de validacion se traduce", () => {
    // El smoke en produccion encontro «No se pudo recalcular: Value error,
    // EXCHANGE_RATE_REQUIRED» debajo del aviso humano: el codigo se colaba
    // por la puerta lateral del error de recalculo.
    const texto = describeError(validacion("Value error, EXCHANGE_RATE_REQUIRED"));
    expect(texto).not.toContain("EXCHANGE_RATE_REQUIRED");
    expect(texto).toMatch(/tipo de cambio para cotizar en dólares/i);
  });

  it("un codigo desconocido dentro de un motivo tampoco se muestra", () => {
    const texto = describeError(validacion("Value error, ALGO_QUE_NO_EXISTE"));
    expect(texto).not.toContain("ALGO_QUE_NO_EXISTE");
    expect(texto).toMatch(/Revisa el formulario/i);
  });

  it("un motivo escrito para personas se respeta", () => {
    const texto = "El valor debe ser mayor que cero";
    expect(describeError(validacion(texto))).toBe(texto);
  });
});

describe("Motivos de validacion en castellano - Fase 009F", () => {
  /** Un 422 de Pydantic con campo, tal y como llega del backend. */
  const conCampo = (field: string, reason: string) =>
    new ApiError("VALIDATION_ERROR", "Datos invalidos", 422, [
      { field, reason, type: "value_error" },
    ]);

  it("traduce el motivo y nombra el campo como se llama en pantalla", () => {
    // El caso real: «items.1.dimensions.depth: Input should be greater than 0»
    // dejaba media frase en ingles y una ruta de JSON en una pantalla que por
    // lo demas habla castellano.
    const texto = describeError(
      conCampo("items.1.dimensions.depth", "Input should be greater than 0"),
    );
    expect(texto).toBe("Producto 2 · Profundidad: debe ser mayor que 0");
    expect(texto).not.toContain("items.1");
    expect(texto).not.toContain("Input should be");
  });

  it("el indice del producto se cuenta desde uno", () => {
    // El usuario ve «Producto 1» y «Producto 2»; el payload cuenta desde cero.
    const texto = describeError(conCampo("items.0.quantity", "Field required"));
    expect(texto).toBe("Producto 1 · Cantidad: es obligatorio");
  });

  it("un campo de cabecera no inventa un producto", () => {
    expect(describeError(conCampo("exchange_rate", "Input should be greater than 0"))).toBe(
      "Tipo de cambio: debe ser mayor que 0",
    );
  });

  it("un campo desconocido se calla en vez de enseñar la ruta", () => {
    const texto = describeError(conCampo("algo.raro.interno", "Field required"));
    expect(texto).not.toContain("algo.raro.interno");
    expect(texto).toBe("es obligatorio");
  });
});
