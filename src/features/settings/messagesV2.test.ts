import { describe, expect, it } from "vitest";

import { ApiError } from "@/api/client";
import { describeError } from "@/features/settings/messages";

/**
 * Los errores del Cotizador V2, en lenguaje de taller (Fase 010G).
 *
 * El backend devuelve códigos porque no sabe en qué pantalla se van a leer.
 * Esta traducción existe para que quien cotiza lea lo que tiene que hacer y no
 * lo que le pasó a una fila de la base.
 *
 * La regla que estas pruebas fijan: **un código sin traducir no es aceptable en
 * una pantalla de dinero.** «V2_CUSTOMER_ROLE_REQUIRED» no le dice a nadie que
 * eligió un proveedor donde iba un cliente.
 */

const error = (code: string, message = "mensaje del backend", status = 422) =>
  new ApiError(code, message, status);

describe("errores del Cotizador V2", () => {
  it("un proveedor donde va un cliente se explica como tal", () => {
    const texto = describeError(error("V2_CUSTOMER_ROLE_REQUIRED"));
    expect(texto).toMatch(/rol de cliente/i);
    expect(texto).not.toMatch(/V2_/);
  });

  it("un cliente archivado dice que elija otro", () => {
    expect(describeError(error("V2_CUSTOMER_NOT_FOUND", "x", 404))).toMatch(/archivado/i);
  });

  it("una cotización emitida explica por qué ya no se toca", () => {
    // No «no editable»: eso describe el permiso, no el motivo.
    for (const codigo of [
      "V2_QUOTATION_NOT_EDITABLE",
      "V2_FIRING_QUOTATION_NOT_EDITABLE",
      "V2_PRICING_QUOTATION_NOT_EDITABLE",
    ]) {
      expect(describeError(error(codigo, "x", 409))).toMatch(/comprometio un precio/i);
    }
  });

  it("un factor fuera de rango dice cuál de los dos límites es negociable", () => {
    // El suelo de x2 es regla cerrada; el techo se configura. Decirlo evita
    // que alguien busque en Configuración un mínimo que no está.
    const texto = describeError(error("V2_PRICING_FACTOR_OUT_OF_RANGE"));
    expect(texto).toMatch(/x2/);
    expect(texto).toMatch(/configura/i);
  });

  it("un horno dado de baja aclara que lo ya cotizado no cambia", () => {
    const texto = describeError(error("V2_FIRING_KILN_INACTIVE"));
    expect(texto).toMatch(/conservan su costo|no cambia/i);
  });

  it("los conflictos de versión dicen qué hacer, no qué pasó", () => {
    for (const codigo of ["V2_LABOR_VERSION_CONFLICT", "V2_SETTINGS_VERSION_CONFLICT"]) {
      expect(describeError(error(codigo, "x", 409))).toMatch(/recargue/i);
    }
  });

  it("los errores de dato dejan hablar al backend", () => {
    // Ahí el mensaje del servidor es el específico —qué campo y por qué— y
    // reescribirlo aquí solo serviría para perderlo.
    expect(describeError(error("V2_LABOR_INPUT_INVALID", "Las horas no pueden ser negativas"))).toBe(
      "Las horas no pueden ser negativas",
    );
  });

  it("ningún código de V2 llega crudo a la pantalla", () => {
    const codigos = [
      "V2_CUSTOMER_NOT_FOUND",
      "V2_CUSTOMER_ROLE_REQUIRED",
      "V2_FACTOR_OUT_OF_RANGE",
      "V2_FIRING_KILN_INACTIVE",
      "V2_FIRING_KILN_NOT_FOUND",
      "V2_FIRING_QUOTATION_NOT_EDITABLE",
      "V2_FIRING_QUOTATION_NOT_FOUND",
      "V2_KILN_INACTIVE",
      "V2_KILN_NOT_FOUND",
      "V2_LABOR_NOT_FOUND",
      "V2_LABOR_RESOURCE_INACTIVE",
      "V2_LABOR_VERSION_CONFLICT",
      "V2_MATERIAL_KIND_MISMATCH",
      "V2_MATERIAL_NOT_FOUND",
      "V2_MATERIAL_PRODUCT_INVALID",
      "V2_MATERIAL_UOM_MISSING",
      "V2_MATERIAL_VERSION_CONFLICT",
      "V2_PRICING_FACTOR_OUT_OF_RANGE",
      "V2_PRICING_QUOTATION_NOT_EDITABLE",
      "V2_PRICING_QUOTATION_NOT_FOUND",
      "V2_QUOTATION_NOT_EDITABLE",
      "V2_QUOTATION_NOT_FOUND",
      "V2_SETTINGS_NOT_FOUND",
      "V2_SETTINGS_VERSION_CONFLICT",
      "V2_TECHNIQUE_NOT_FOUND",
      "V2_WORKER_NOT_FOUND",
    ];
    for (const codigo of codigos) {
      const texto = describeError(error(codigo));
      expect(texto, `${codigo} no está traducido`).not.toMatch(/V2_/);
      expect(texto.length, `${codigo} no dice nada`).toBeGreaterThan(20);
    }
  });
});
