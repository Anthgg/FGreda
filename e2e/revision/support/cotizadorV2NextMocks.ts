import type { Page } from "@playwright/test";

/**
 * Respuestas fijas de la API para las pruebas de navegador del Cotizador V2
 * rediseñado (010O). Sin backend, sin base de datos y sin credenciales: cada
 * spec intercepta `/api/v1/**` y contesta con esto, o con lo suyo.
 *
 * Lo mantiene el orquestador. Un spec que necesite otra respuesta la pasa en
 * `interceptarApi(page, propia)` en vez de editar este archivo.
 */

export const COTIZACION = {
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

export const LINEA = {
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
  body_cost_per_unit: "0.001300",
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

export const PRECIO = {
  materials_cost: "13.000000",
  labor_cost: "0.000000",
  illustration_cost: "0.000000",
  space_cost: "280.000000",
  administration_cost: "200.000000",
  extras_cost: "0.000000",
  gas_cost: "105.000000",
  firing_commercial_cost: "450.000000",
  firing_difference: "345.000000",
  direct_cost: "13.000000",
  real_cost: "598.000000",
  production_cost: "943.000000",
  commercial_factor: "3.000000",
  factor_min: "2.000000",
  factor_max: "3.000000",
  factor_target: "3.000000",
  price_min: "1886.000000",
  price_target: "2829.000000",
  negotiated_price: "2829.000000",
  currency_code: "PEN",
  exchange_rate: null,
  tax_percent: "18.000000",
  rounding_step: "0.500000",
  subtotal: "2830.000000",
  tax: "509.400000",
  total: "3339.400000",
  rounding_adjustment: "1.000000",
  estimated_profit: "2232.000000",
  effective_margin_percent: "78.869258",
  lines: [],
  warnings: [],
};

export const QUEMA = {
  production_type: "RETAIL",
  customer_kind: "EXTERNAL",
  kiln_id: null,
  kiln_name: null,
  kiln_capacity_cm3: null,
  total_volume_cm3: "12960.000000",
  occupancy_percent: "0",
  firing_count: 0,
  firing_mode: "SHARED",
  piece_separation_cm: "0",
  billed_load: "0",
  low_fire_enabled: true,
  high_fire_enabled: true,
  low_fire_count: 0,
  high_fire_count: 0,
  batch_loads: [],
  gas_cost_low: null,
  gas_cost_high: null,
  gas_low_is_override: false,
  gas_high_is_override: false,
  commercial_rate_low: null,
  commercial_rate_high: null,
  commercial_low_is_override: false,
  commercial_high_is_override: false,
  gas_total: "0",
  commercial_total: "0",
  difference: "0",
  recommended_kiln_id: null,
  cheaper_kiln: null,
  kilns: [],
  lines: [],
  warnings: ["V2_FIRING_KILN_NOT_SELECTED"],
};

export const RESUMEN_DE_EMISION = {
  quotation_id: 7,
  code: COTIZACION.code,
  status: "DRAFT",
  effective_status: "DRAFT",
  can_confirm: false,
  blockers: [{ code: "V2_CONFIRM_KILN_REQUIRED", line_id: null }],
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
  valid_until: "2026-10-14",
  subtotal_amount: "2830.000000",
  tax_amount: "509.400000",
  total_amount: "3339.400000",
  lines: [],
};

export const USUARIO = {
  id: "11111111-2222-3333-4444-555555555555",
  email: "admin@empresa.com",
  display_name: "Administrador",
  role: "ADMIN",
};

export function respuesta(ruta: string): unknown {
  if (ruta.endsWith("/auth/me")) return { authenticated: true, user: USUARIO };
  if (ruta.endsWith("/auth/csrf")) return { csrf_token: "token-de-prueba", expires_in: 28800 };
  if (ruta.includes("/confirmation-preview")) return RESUMEN_DE_EMISION;
  if (ruta.includes("/quotations-v2/7/products")) return { items: [LINEA], materials_cost: "13.000000" };
  if (ruta.includes("/quotations-v2/7/labor") || ruta.includes("/planning")) {
    return {
      items: [],
      labor_cost: "0.000000",
      workday_load: [],
      suggested_work_days: 1,
      effective_work_days: 2,
      warnings: [],
    };
  }
  if (ruta.includes("/quotations-v2/7/firing")) return QUEMA;
  if (ruta.includes("/quotations-v2/7/pricing")) return PRECIO;
  if (ruta.includes("/quotations-v2/7/reductions")) {
    return { current_subtotal: "0", commercial_factor: null, currency_code: "PEN", items: [], warnings: [] };
  }
  if (ruta.includes("/quotations-v2/7/processes")) return { items: [], warnings: [] };
  if (ruta.includes("/quotations-v2/7/extras")) {
    return { items: [], extras_cost_total: "0.000000", warnings: [] };
  }
  if (ruta.includes("/quotations-v2/7/illustration")) {
    return {
      enabled: false,
      quantity: "0",
      daily_rate: null,
      capacity_per_workday: null,
      hourly_rate: null,
      total_hours: "0",
      total_cost: "0",
      lines: [],
      warnings: [],
    };
  }
  if (ruta.includes("/quotations-v2/7/history")) return [];
  if (ruta.endsWith("/quotations-v2/7")) return COTIZACION;
  if (ruta.includes("/partners")) return { items: [], total: 0, limit: 20, offset: 0 };
  return { items: [], total: 0 };
}

/** Una escritura que llegó a la API interceptada. */
export interface Escritura {
  metodo: string;
  ruta: string;
  cuerpo: unknown;
}

/**
 * Intercepta TODA la API con respuestas fijas. `propia` contesta primero: lo
 * que devuelva (distinto de `undefined`) sustituye a la respuesta por defecto.
 * Devuelve la lista de escrituras (todo lo que no es GET) para comprobarlas.
 */
export async function interceptarApi(
  page: Page,
  propia?: (ruta: string, metodo: string, cuerpo: unknown) => unknown,
): Promise<Escritura[]> {
  const escrituras: Escritura[] = [];
  // Mismo origen: `vite preview` reenvía `/api` al backend, que aquí no existe.
  await page.addInitScript(() => {
    (window as unknown as { __GREDA_CONFIG__: { API_BASE_URL: string } }).__GREDA_CONFIG__ = {
      API_BASE_URL: "",
    };
  });
  await page.route("**/api/v1/**", async (route) => {
    const peticion = route.request();
    const ruta = new URL(peticion.url()).pathname;
    const metodo = peticion.method();
    const texto = peticion.postData();
    const cuerpo = texto ? (JSON.parse(texto) as unknown) : null;
    if (metodo !== "GET") escrituras.push({ metodo, ruta, cuerpo });
    const suya = propia?.(ruta, metodo, cuerpo);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(suya !== undefined ? suya : respuesta(ruta)),
    });
  });
  return escrituras;
}

export function vigilarConsola(page: Page): string[] {
  const errores: string[] = [];
  page.on("console", (mensaje) => {
    if (mensaje.type() === "error") errores.push(mensaje.text());
  });
  page.on("pageerror", (error) => errores.push(error.message));
  return errores;
}

/** Cuántas columnas pinta de verdad la rejilla, y cómo va la barra de pasos. */
