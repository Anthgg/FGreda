import { describe, expect, it } from "vitest";

import {
  esPasoValido,
  evaluarPasos,
  PASOS,
  primerPasoIncompleto,
  type DatosDelFlujo,
  type PasoId,
} from "@/features/cotizadorV2/pasos";
import { V2_FIRING, V2_LABOR_PAGE, V2_PRICING } from "@/test/quoterV2Fixtures";

/**
 * Los siete pasos y sus tres severidades (Fase 010G).
 *
 * Lo que estas pruebas protegen es la diferencia entre ERROR, AVISO y
 * RECOMENDACIÓN, que no es cosmética: decide si alguien puede seguir
 * trabajando. Convertir cada aviso en bloqueo deja el sistema inusable;
 * convertir cada error en aviso deja emitir una cotización sin cliente.
 */

const COTIZACION_COMPLETA = {
  id: 7,
  code: "CTZ-V2-2026-000001",
  pricing_engine_version: "V2" as const,
  status: "DRAFT" as const,
  production_type: "RETAIL" as const,
  customer_id: 3,
  customer_name: "Cliente demo",
  name: "Pedido",
  notes: null,
  customer_kind: "EXTERNAL" as const,
  tax_percent: "18.000000",
  currency_code: "PEN",
  currency_symbol: "S/",
  exchange_rate: null,
  validity_days: 20,
  workday_hours: "8.000000",
  space_service_cost_per_day: "140.000000",
  administrative_cost: "200.000000",
  commercial_factor: "3.000000",
  commercial_factor_min: "2.000000",
  commercial_factor_max: "3.000000",
  low_fire_enabled: true,
  high_fire_enabled: true,
  settings_version: 1,
  created_at: "2026-09-11T10:00:00Z",
  updated_at: "2026-09-11T10:00:00Z",
};

const LINEA_COMPLETA = {
  id: 11,
  sort_order: 0,
  product_id: null,
  product_name: "Plato",
  quantity: 20,
  length_cm: "18.000000",
  width_cm: "12.000000",
  height_cm: "3.000000",
  unit_volume_cm3: "648.000000",
  total_volume_cm3: "12960.000000",
  firing_occupancy_percent: "76.235294",
  firing_volume_share_percent: "100.000000",
  firing_commercial_cost: "450.000000000000000000",
  firing_gas_cost: "105.000000000000000000",
  body_material_id: 3,
  body_material_name: "Arcilla",
  body_unit_weight: "500.000000",
  body_uom: "g",
  body_cost_per_unit: "0.001300000000",
  body_cost_is_override: false,
  body_total_weight: "10000.000000",
  body_cost: "13.000000000000000000",
  requires_glaze: false,
  glaze_material_id: null,
  glaze_material_name: null,
  glaze_is_reference: false,
  glaze_cost_per_unit: null,
  glaze_cost_is_override: false,
  glaze_percent: null,
  glaze_ml_per_gram: null,
  glaze_conversion_is_fallback: false,
  glaze_total_weight: "0.000000",
  glaze_volume_ml: "0.000000",
  glaze_cost: "0.000000000000000000",
  materials_cost: "13.000000000000000000",
  warnings: [] as string[],
};

function datos(overrides: Partial<DatosDelFlujo> = {}): DatosDelFlujo {
  return {
    cotizacion: COTIZACION_COMPLETA,
    productos: { items: [LINEA_COMPLETA], materials_cost: "13.000000000000000000" },
    manoDeObra: { ...V2_LABOR_PAGE, effective_work_days: 2 },
    quema: V2_FIRING,
    precio: V2_PRICING,
    ...overrides,
  } as DatosDelFlujo;
}

function estado(id: PasoId, datosDelFlujo: DatosDelFlujo) {
  const encontrado = evaluarPasos(datosDelFlujo).find((paso) => paso.id === id);
  if (!encontrado) throw new Error("paso desconocido");
  return encontrado;
}

describe("los siete pasos", () => {
  it("son siete y en el orden aprobado", () => {
    expect(PASOS.map((paso) => paso.id)).toEqual([
      "cliente",
      "productos",
      "materiales",
      "mano-de-obra",
      "quema",
      "precio",
      "resumen",
    ]);
  });

  it("reconoce un paso de la URL y rechaza lo que no lo es", () => {
    expect(esPasoValido("quema")).toBe(true);
    expect(esPasoValido("loquesea")).toBe(false);
    expect(esPasoValido(undefined)).toBe(false);
  });
});

describe("errores: impiden avanzar", () => {
  it("una cotización sin cliente no está lista", () => {
    const paso = estado(
      "cliente",
      datos({ cotizacion: { ...COTIZACION_COMPLETA, customer_id: null } }),
    );
    expect(paso.completo).toBe(false);
    expect(paso.senales[0]?.severidad).toBe("error");
  });

  it("en moneda extranjera hace falta el tipo de cambio", () => {
    const paso = estado(
      "cliente",
      datos({ cotizacion: { ...COTIZACION_COMPLETA, currency_code: "USD", exchange_rate: null } }),
    );
    expect(paso.completo).toBe(false);
  });

  it("una cotización sin productos no está lista", () => {
    const paso = estado("productos", datos({ productos: { items: [], materials_cost: "0" } }));
    expect(paso.completo).toBe(false);
  });

  it("una línea sin piezas es un error", () => {
    const paso = estado(
      "productos",
      datos({ productos: { items: [{ ...LINEA_COMPLETA, quantity: 0 }], materials_cost: "0" } }),
    );
    expect(paso.completo).toBe(false);
  });

  it("falta decidir los días efectivos", () => {
    const paso = estado(
      "mano-de-obra",
      datos({ manoDeObra: { ...V2_LABOR_PAGE, effective_work_days: null } }),
    );
    expect(paso.completo).toBe(false);
  });

  it("una cotización sin horno no está lista", () => {
    const paso = estado("quema", datos({ quema: { ...V2_FIRING, kiln_id: null, warnings: [] } }));
    expect(paso.completo).toBe(false);
  });

  it("un horno sin tarifas es un error, no un aviso", () => {
    // Costearía la quema en cero sin que nada lo dijera en el total.
    const paso = estado(
      "quema",
      datos({ quema: { ...V2_FIRING, warnings: ["V2_FIRING_RATES_MISSING"] } }),
    );
    expect(paso.completo).toBe(false);
  });
});

describe("avisos: NO impiden avanzar", () => {
  it("un esmalte de referencia sin existencia deja cotizar", () => {
    // Cotizar no consume stock: bloquear aquí dejaría el borrador muerto por
    // una decisión de almacén.
    const paso = estado(
      "materiales",
      datos({
        productos: {
          items: [{ ...LINEA_COMPLETA, warnings: ["V2_GLAZE_REFERENCE_WITHOUT_STOCK"] }],
          materials_cost: "13",
        },
      }),
    );
    expect(paso.completo).toBe(true);
    expect(paso.senales.some((s) => s.severidad === "aviso")).toBe(true);
  });

  it("superar la capacidad del horno avisa y deja seguir", () => {
    const paso = estado(
      "quema",
      datos({ quema: { ...V2_FIRING, warnings: ["V2_FIRING_OVER_CAPACITY"] } }),
    );
    expect(paso.completo).toBe(true);
    expect(paso.senales.some((s) => s.severidad === "aviso")).toBe(true);
  });

  it("exceder la jornada avisa: la solución la elige una persona", () => {
    const paso = estado("mano-de-obra", datos());
    expect(paso.completo).toBe(true);
    expect(paso.senales.some((s) => s.severidad === "aviso")).toBe(true);
  });

  it("vender a pérdida avisa pero no bloquea", () => {
    const paso = estado(
      "precio",
      datos({ precio: { ...V2_PRICING, warnings: ["V2_PRICING_SELLING_BELOW_REAL_COST"] } }),
    );
    expect(paso.completo).toBe(true);
  });
});

describe("recomendaciones: el sistema sugiere y no decide", () => {
  it("cabe en un horno más chico es una recomendación", () => {
    const paso = estado(
      "quema",
      datos({ quema: { ...V2_FIRING, warnings: ["V2_FIRING_SMALLER_KILN_FITS"] } }),
    );
    expect(paso.completo).toBe(true);
    expect(paso.senales[0]?.severidad).toBe("recomendacion");
  });
});

describe("a qué paso se lleva a quien abre un borrador", () => {
  it("al primero que esté incompleto", () => {
    const estados = evaluarPasos(datos({ quema: { ...V2_FIRING, kiln_id: null, warnings: [] } }));
    expect(primerPasoIncompleto(estados)).toBe("quema");
  });

  it("al resumen cuando todo está listo", () => {
    expect(primerPasoIncompleto(evaluarPasos(datos()))).toBe("resumen");
  });

  it("al primero cuando no hay nada hecho", () => {
    const estados = evaluarPasos(
      datos({ cotizacion: { ...COTIZACION_COMPLETA, customer_id: null } }),
    );
    expect(primerPasoIncompleto(estados)).toBe("cliente");
  });
});
