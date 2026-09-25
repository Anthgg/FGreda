/**
 * Datos de prueba del shell del Cotizador V2 rediseñado (010O.3).
 *
 * Propios del shell a propósito: los pasos que se reescriban en paralelo
 * tienen sus fixtures en archivos suyos, y nadie más añade aquí.
 */

import {
  V2_FIRING,
  V2_ILLUSTRATION,
  V2_LABOR_PAGE,
  V2_PRICING,
  V2_TECHNIQUES,
  V2_WORKERS,
} from "@/test/quoterV2Fixtures";
import { csrfResponse, jsonResponse, mockFetch, TEST_USER } from "@/test/utils";
import type { V2Blocker, V2ConfirmationPreview, V2Quotation } from "@/types/quoterV2";
import type { V2QuotationProduct } from "@/types/quoterV2Materials";

export const COTIZACION: V2Quotation = {
  id: 7,
  code: "CTZ-V2-2026-000007",
  pricing_engine_version: "V2",
  status: "DRAFT",
  effective_status: "DRAFT",
  production_type: "RETAIL",
  customer_id: 3,
  customer_name: "Cliente demo",
  name: "Pedido demo",
  notes: null,
  customer_kind: "EXTERNAL",
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
  client_notes: null,
  issued_at: null,
  valid_until: null,
  expires_at: null,
  issued_by_name: null,
  cancelled_at: null,
  cancelled_by_name: null,
  cancel_reason: null,
  duplicated_from_id: null,
  open_duplicate_id: null,
  production_handoff: null,
};

export const LINEA: V2QuotationProduct = {
  id: 11,
  sort_order: 0,
  product_id: null,
  product_name: "Plato palta",
  quantity: 20,
  length_cm: "18.000000",
  width_cm: "12.000000",
  height_cm: "3.000000",
  unit_volume_cm3: "648.000000",
  total_volume_cm3: "12960.000000",
  firing_occupancy_percent: "76.235294",
  firing_volume_share_percent: "100.000000",
  firing_commercial_cost: "450.000000",
  firing_gas_cost: "105.000000",
  body_material_id: 3,
  body_material_name: "Arcilla Terranova",
  body_unit_weight: "500.000000",
  body_uom: "g",
  body_cost_per_unit: "0.001300000000",
  body_cost_is_override: false,
  body_total_weight: "10000.000000",
  body_cost: "13.000000",
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
  glaze_cost: "0.000000",
  materials_cost: "13.000000",
  client_observation: null,
  warnings: [],
};

export function resumenDeEmision(blockers: V2Blocker[] = []): V2ConfirmationPreview {
  return {
    quotation_id: 7,
    code: COTIZACION.code,
    status: "DRAFT",
    effective_status: "DRAFT",
    can_confirm: blockers.length === 0,
    blockers,
    warnings: [],
    fingerprint: "a".repeat(64),
    customer_name: "Cliente demo",
    name: "Pedido demo",
    client_notes: null,
    currency_code: "PEN",
    currency_symbol: "S/",
    exchange_rate: null,
    tax_percent: "18.000000",
    commercial_factor: "3.000000",
    validity_days: 20,
    valid_until: "2026-10-01",
    subtotal_amount: "3540.000000",
    tax_amount: "637.200000",
    total_amount: "4177.200000",
    lines: [],
  };
}

/** Días efectivos decididos: sin ellos `pasos.ts` da el paso de trabajo por incompleto. */
export const MANO_DE_OBRA_LISTA = { ...V2_LABOR_PAGE, effective_work_days: 2 };

type Extra = (url: string, init: RequestInit) => Response | Promise<Response> | undefined;

/**
 * Un backend de mentira para el shell. `extra` responde primero; lo que no
 * conteste cae en las respuestas por defecto de una cotización completa.
 */
export function mockShell(
  opciones: {
    cotizacion?: Partial<V2Quotation>;
    bloqueos?: V2Blocker[];
    extra?: Extra;
  } = {},
) {
  const cotizacion = { ...COTIZACION, ...opciones.cotizacion };
  return mockFetch(async (url, init) => {
    const propia = await opciones.extra?.(url, init);
    if (propia) return propia;
    if (url.includes("/auth/csrf")) return csrfResponse();
    if (url.includes("/auth/me")) return jsonResponse(200, { authenticated: true, user: TEST_USER });
    if (url.includes("/confirmation-preview"))
      return jsonResponse(200, resumenDeEmision(opciones.bloqueos));
    if (url.includes("/history")) return jsonResponse(200, []);
    if (url.includes("/processes")) return jsonResponse(200, { items: [], warnings: [] });
    if (url.includes("/quoter-v2/products/")) return jsonResponse(200, { product_id: 1, items: [] });
    if (url.includes("/extras"))
      return jsonResponse(200, { items: [], extras_cost_total: "0.000000", warnings: [] });
    if (url.includes("/reductions"))
      return jsonResponse(200, { current_subtotal: "0", commercial_factor: null, currency_code: "PEN", items: [], warnings: [] });
    if (url.includes("/quoter-v2/workers")) return jsonResponse(200, V2_WORKERS);
    if (url.includes("/quoter-v2/techniques")) return jsonResponse(200, V2_TECHNIQUES);
    if (url.includes("/quoter-v2/materials")) return jsonResponse(200, { items: [] });
    if (url.includes("/illustration")) return jsonResponse(200, V2_ILLUSTRATION);
    if (url.includes("/labor") || url.includes("/planning"))
      return jsonResponse(200, MANO_DE_OBRA_LISTA);
    if (url.includes("/pricing")) return jsonResponse(200, V2_PRICING);
    if (url.includes("/firing")) return jsonResponse(200, V2_FIRING);
    if (url.includes("/partners")) return jsonResponse(200, { items: [], total: 0, limit: 20, offset: 0 });
    if (url.includes("/quotations-v2/7/products"))
      return jsonResponse(200, { items: [LINEA], materials_cost: "13.000000" });
    if (url.includes("/products")) return jsonResponse(200, { items: [], total: 0, limit: 200, offset: 0 });
    if (url.includes("/quotations-v2/7")) return jsonResponse(200, cotizacion);
    if (url.includes("/quotations-v2")) return jsonResponse(200, { items: [], total: 0 });
    return jsonResponse(200, {});
  });
}
