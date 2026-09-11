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
