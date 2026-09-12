/**
 * Fixtures del Cotizador V2, compartidas entre pruebas.
 *
 * Los números son los del Excel aprobado, no cifras inventadas para que algo
 * pase: 100 kg de arcilla por S/100 más S/30 de transporte dan S/0,0013 el
 * gramo, y un esmalte a S/0,20 el gramo sobre 1.500 g da S/300.
 *
 * Viven aquí porque la pantalla de Configuración monta a la vez el formulario
 * V2, la tabla de hornos y la de materiales: una prueba de cualquiera de las
 * tres necesita respuestas creíbles para las otras dos, y una respuesta
 * inventada escondería la pestaña que se quiere probar.
 */

export const V2_CONFIG = {
  version: 1,
  updated_at: "2026-09-11T10:00:00Z",
  workday_hours: "8.000000",
  space_service_cost_per_day: "140.000000",
  administrative_cost_per_quote: "200.000000",
  commercial_factor_default: "3.000000",
  commercial_factor_min: "2.000000",
  commercial_factor_max: "3.000000",
  quotation_validity_days: 20,
  default_exchange_rate: "3.500000",
  default_production_type: "RETAIL",
  default_customer_kind: "EXTERNAL",
  retail_kiln_id: null,
  wholesale_kiln_id: null,
  low_fire_enabled_default: true,
  high_fire_enabled_default: true,
  illustration_daily_rate: "110.000000",
  illustration_pieces_per_workday: "50.000000",
  illustration_hourly_rate: "13.750000",
  illustration_pieces_per_hour: "6.250000",
  tax_percent: "18.000000",
  currency_code: "PEN",
  currency_symbol: "S/",
  canonical_source: "commercial_settings",
};

export const V2_CONFIG_PAGE = {
  settings: V2_CONFIG,
  kiln_rates: [
    {
      kiln_id: 1,
      kiln_code: "KILN-001",
      kiln_name: "Horno chico",
      firing_type: "LOW",
      gas_cost: "35.000000",
      external_rate: "200.000000",
      student_rate: "90.000000",
      configured: true,
    },
  ],
  reference_rates: {
    SMALL: { gas_cost_low: "35", external_rate_low: "200", student_rate_low: "90" },
    LARGE: { gas_cost_low: "55", external_rate_low: "700", student_rate_low: "1000" },
  },
};

/** Lo que devuelve el maestro: de aquí sale la lista, no de nombres fijos. */
export const V2_MATERIAL_PRODUCTS = [
  {
    id: 3,
    internal_reference: "MP-0003",
    name: "Arcilla Terranova",
    product_type: "RAW_MATERIAL",
    product_category_id: 1,
    product_category_path: "Insumos / Pastas",
    pos_category_id: null,
    pos_category_name: null,
    base_uom_code: "g",
    purchase_uom_code: "kg",
    cost: "0.002000000000",
    sale_price: null,
    sale_tax_rate: null,
    purchase_tax_rate: null,
    sellable: false,
    purchasable: true,
    available_in_pos: false,
    active: true,
    notes: null,
  },
  {
    id: 9,
    internal_reference: "MP-0009",
    name: "Esmalte B",
    product_type: "RAW_MATERIAL",
    product_category_id: 1,
    product_category_path: "Insumos / Esmaltes",
    pos_category_id: null,
    pos_category_name: null,
    base_uom_code: "g",
    purchase_uom_code: "kg",
    cost: null,
    sale_price: null,
    sale_tax_rate: null,
    purchase_tax_rate: null,
    sellable: false,
    purchasable: true,
    available_in_pos: false,
    active: true,
    notes: null,
  },
  {
    id: 12,
    internal_reference: "MP-0012",
    name: "Esmalte nuevo",
    product_type: "RAW_MATERIAL",
    product_category_id: 1,
    product_category_path: "Insumos / Esmaltes",
    pos_category_id: null,
    pos_category_name: null,
    base_uom_code: "g",
    purchase_uom_code: "kg",
    cost: null,
    sale_price: null,
    sale_tax_rate: null,
    purchase_tax_rate: null,
    sellable: false,
    purchasable: true,
    available_in_pos: false,
    active: true,
    notes: null,
  },
];

/** Solo dos de los tres productos están valorizados. El tercero es el caso. */
export const V2_MATERIALS = {
  items: [
    {
      product_id: 3,
      product_name: "Arcilla Terranova",
      product_type: "RAW_MATERIAL",
      uom_code: "g",
      active: true,
      material_kind: "BODY",
      origin: "PURCHASE",
      purchase_quantity: "100000.000000",
      purchase_cost: "100.000000",
      transport_cost: "30.000000",
      acquisition_total_cost: "130.000000",
      costing_override_per_unit: null,
      effective_cost_per_unit: "0.001300000000",
      ml_per_gram: null,
      notes: null,
      stock: "50000.000000",
    },
    {
      product_id: 9,
      product_name: "Esmalte B",
      product_type: "RAW_MATERIAL",
      uom_code: "g",
      active: true,
      material_kind: "GLAZE",
      origin: "PURCHASE",
      purchase_quantity: "5000.000000",
      purchase_cost: "900.000000",
      transport_cost: "100.000000",
      acquisition_total_cost: "1000.000000",
      costing_override_per_unit: null,
      effective_cost_per_unit: "0.200000000000",
      ml_per_gram: null,
      notes: null,
      // Sin existencia, y aun así sirve de referencia de costeo.
      stock: "0.000000",
    },
  ],
};

// ---------------------------------------------------------------------------
// Fase 010D: mano de obra
// ---------------------------------------------------------------------------

/** S/120 en la jornada de 8 h del taller son S/15 la hora. */
export const V2_WORKERS = {
  items: [
    {
      id: 1,
      name: "Celso",
      worker_type: "INTERNAL",
      active: true,
      daily_rate: "120.000000",
      workday_hours: null,
      effective_workday_hours: "8.000000",
      hourly_rate: "15.000000000000",
      notes: null,
      version: 1,
    },
    {
      id: 2,
      name: "Refuerzo externo",
      worker_type: "EXTERNAL",
      active: true,
      daily_rate: "160.000000",
      workday_hours: null,
      effective_workday_hours: "8.000000",
      hourly_rate: "20.000000000000",
      notes: null,
      version: 1,
    },
  ],
};

/** 50 piezas por jornada de 8 h son 6,25 por hora. */
export const V2_TECHNIQUES = {
  items: [
    {
      id: 3,
      code: "vidriado",
      name: "Vidriado",
      active: true,
      default_capacity_per_workday: "50.000000",
      unit: "piezas",
      requires_glaze: true,
      units_per_hour: "6.250000000000",
      notes: null,
      version: 1,
    },
  ],
};

/** 75 piezas a 50 por jornada son 12 horas; a S/15, S/180. */
export const V2_LABOR_PAGE = {
  items: [
    {
      id: 11,
      sort_order: 0,
      v2_quotation_product_id: null,
      worker_id: 1,
      worker_name: "Celso",
      worker_type: "INTERNAL",
      daily_rate: "120.000000",
      workday_hours: "8.000000",
      hourly_rate: "15.000000000000",
      rate_overridden: false,
      technique_id: 3,
      technique_name: "Vidriado",
      technique_unit: "piezas",
      standard_capacity: "50.000000",
      quantity: "75.000000",
      calculated_hours: "12.000000",
      final_hours: "12.000000",
      hours_overridden: false,
      is_additional_personnel: false,
      labor_cost: "180.000000000000000000",
      warnings: ["V2_LABOR_WORKDAY_EXCEEDED"],
    },
  ],
  labor_cost: "180.000000000000000000",
  workday_load: [
    {
      worker_id: 1,
      worker_name: "Celso",
      workday_hours: "8.000000",
      assigned_hours: "12.000000",
      exceeds_workday: true,
      minimum_days: 2,
    },
  ],
  suggested_work_days: 2,
  effective_work_days: null,
};

/** S/110 por 8 h y 50 piezas: 75 piezas son 12 h y S/165. */
export const V2_ILLUSTRATION = {
  enabled: true,
  quantity: "75.000000",
  notes: null,
  daily_rate: "110.000000",
  workday_hours: "8.000000",
  capacity_per_workday: "50.000000",
  hourly_rate: "13.750000000000",
  hours: "12.000000",
  cost: "165.000000000000000000",
};

/**
 * El caso canónico de 010E: externo, horno chico, 160 %, baja y alta.
 *
 * Dos hornadas a 200 + dos a 250 son S/900 de tarifa; dos a 35 + dos a 70 son
 * S/210 de gas, y la diferencia es S/690. La segunda hornada va al 60 % de
 * carga y cuesta exactamente igual que la primera: el horno se enciende entero.
 */
export const V2_FIRING = {
  production_type: "RETAIL",
  customer_kind: "EXTERNAL",
  kiln_id: 1,
  kiln_name: "Horno chico",
  kiln_capacity_cm3: "17000.000000",
  total_volume_cm3: "27200.000000",
  occupancy_percent: "160.000000",
  firing_count: 2,
  low_fire_enabled: true,
  high_fire_enabled: true,
  low_fire_count: 2,
  high_fire_count: 2,
  batch_loads: ["100.000000", "60.000000"],
  gas_cost_low: "35.000000",
  gas_cost_high: "70.000000",
  gas_low_is_override: false,
  gas_high_is_override: false,
  commercial_rate_low: "200.000000",
  commercial_rate_high: "250.000000",
  commercial_low_is_override: false,
  commercial_high_is_override: false,
  gas_total: "210.000000000000000000",
  commercial_total: "900.000000000000000000",
  difference: "690.000000000000000000",
  recommended_kiln_id: 2,
  kilns: [
    {
      kiln_id: 1,
      code: "KILN-001",
      name: "Horno chico",
      capacity_cm3: "17000.000000",
      active: true,
      occupancy_percent: "160.000000",
      firing_count: 2,
      has_rates: true,
    },
    {
      kiln_id: 2,
      code: "KILN-002",
      name: "Horno grande",
      capacity_cm3: "200000.000000",
      active: true,
      occupancy_percent: "13.600000",
      firing_count: 1,
      has_rates: true,
    },
  ],
  lines: [
    {
      line_id: 11,
      product_name: "Plato palta",
      quantity: 20,
      total_volume_cm3: "27200.000000",
      occupancy_percent: "160.000000",
      volume_share_percent: "100.000000",
      commercial_cost: "900.000000000000000000",
      gas_cost: "210.000000000000000000",
    },
  ],
  warnings: ["V2_FIRING_OVER_CAPACITY", "V2_FIRING_RETAIL_OVER_CAPACITY"],
};
