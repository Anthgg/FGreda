/**
 * Respuestas de referencia del modulo de quemas.
 *
 * Los numeros salen de la hoja «Costo de quema» del documento funcional, no de
 * la imaginacion: asi las pruebas del frontend comprueban que la pantalla
 * muestra lo que el backend calcula, con los importes reales del negocio.
 */

import type {
  FiringCalculateOut,
  FiringOut,
  FiringPage,
  KilnOut,
  KilnPage,
  KilnRateOut,
} from "@/types/firings";

const AHORA = "2026-08-23T10:00:00Z";

const TRAMOS_CHICO = [
  [1, 10, "2.000000"],
  [11, 20, "1.900000"],
  [21, 30, "1.800000"],
  [31, 40, "1.700000"],
  [41, 50, "1.600000"],
  [51, 60, "1.400000"],
  [61, 70, "1.300000"],
  [71, 80, "1.200000"],
  [81, 90, "1.100000"],
  [91, 100, "1.000000"],
] as const;

export const HORNO_CHICO: KilnOut = {
  id: 1,
  code: "KILN-001",
  name: "Horno pequeño",
  capacity_volume_cm3: "17000.000000",
  // Fase 009C: el pequeño ocupa 3 días por hornada y el grande 4. Las
  // fixtures copian los hornos reales para que las pruebas midan la
  // diferencia entre hornos, que es justo lo que la fase corrige.
  firing_days_per_batch: 3,
  active: true,
  notes: null,
  created_at: AHORA,
  updated_at: AHORA,
  current_low_rate: "90.000000",
  current_high_rate: "180.000000",
  occupancy_factors: TRAMOS_CHICO.map(([min, max, factor], indice) => ({
    id: indice + 1,
    kiln_id: 1,
    min_percentage: min,
    max_percentage: max,
    factor,
  })),
};

export const HORNO_GRANDE: KilnOut = {
  id: 2,
  code: "KILN-002",
  name: "Horno grande",
  capacity_volume_cm3: "200000.000000",
  firing_days_per_batch: 4,
  active: true,
  notes: null,
  created_at: AHORA,
  updated_at: AHORA,
  current_low_rate: "1000.000000",
  current_high_rate: "2000.000000",
  occupancy_factors: [
    { id: 11, kiln_id: 2, min_percentage: 1, max_percentage: 10, factor: "3.000000" },
    { id: 12, kiln_id: 2, min_percentage: 71, max_percentage: 80, factor: "1.400000" },
  ],
};

export const KILNS_PAGE: KilnPage = {
  items: [HORNO_CHICO, HORNO_GRANDE],
  total: 2,
  limit: 200,
  offset: 0,
};

export const HISTORIAL_TARIFAS: KilnRateOut[] = [
  {
    id: 1,
    kiln_id: 2,
    firing_type: "HIGH",
    rate: "2000.000000",
    valid_from: "2026-06-01",
    valid_to: null,
    created_at: AHORA,
    updated_at: AHORA,
  },
  {
    id: 2,
    kiln_id: 2,
    firing_type: "HIGH",
    rate: "1800.000000",
    valid_from: "2026-01-01",
    valid_to: "2026-06-01",
    created_at: AHORA,
    updated_at: AHORA,
  },
];

/** La hoja del documento: 12960 de 26010 cm³, 1041.38 base, ×1.20, 1249.66. */
export const QUEMA_CONFIRMADA: FiringOut = {
  id: 10,
  code: "HR-2026-000001",
  status: "CONFIRMED",
  scheduled_date: null,
  firing_date: "2026-07-24",
  notes: null,
  total_volume_cm3: "26010.000000",
  occupancy_percentage: "153.000000",
  occupancy_factor: "1.404215",
  subtotal: "1176.851211",
  total_cost: "1656.062340",
  tax_percentage: "18.000000",
  tax_amount: "298.091221",
  total_with_tax: "1954.153561",
  currency_code: "PEN",
  currency_symbol: "S/",
  created_by_id: null,
  confirmed_at: "2026-07-24T12:00:00Z",
  cancelled_at: null,
  created_at: AHORA,
  updated_at: AHORA,
  sessions: [
    {
      id: 1,
      kiln_id: 1,
      kiln_code: "KILN-001",
      kiln_name: "Horno pequeño",
      firing_type: "LOW",
      rate_snapshot: "90.000000",
      capacity_snapshot: "17000.000000",
      assigned_volume_cm3: "26010.000000",
      physical_occupancy_percentage: "153.000000",
      subtotal: "90.000000",
      capacity_exceeded: true,
      batches: 1,
      sort_order: 0,
    },
    {
      id: 3,
      kiln_id: 2,
      kiln_code: "KILN-002",
      kiln_name: "Horno grande",
      firing_type: "HIGH",
      rate_snapshot: "2000.000000",
      capacity_snapshot: "200000.000000",
      assigned_volume_cm3: "12960.000000",
      physical_occupancy_percentage: "6.480000",
      subtotal: "996.539792",
      capacity_exceeded: false,
      batches: 1,
      sort_order: 1,
    },
  ],
  lines: [
    {
      id: 1,
      product_id: null,
      product_internal_reference: null,
      description: "Plato palta",
      quantity: 20,
      length_cm: "18.000000",
      width_cm: "12.000000",
      height_cm: "3.000000",
      unit_volume_cm3: "648.000000",
      total_volume_cm3: "12960.000000",
      low_kiln_id: 1,
      high_kiln_id: 2,
      factor_kiln_id: 1,
      volume_share: "0.498270",
      occupancy_percentage: "76.235294",
      occupancy_bracket: 80,
      occupancy_factor: "1.200000",
      base_cost: "1041.384083",
      allocated_cost: "1249.660900",
      capacity_exceeded: false,
      notes: null,
      sort_order: 0,
    },
  ],
};

export const QUEMA_BORRADOR: FiringOut = {
  ...QUEMA_CONFIRMADA,
  id: 11,
  code: "HR-2026-000002",
  status: "DRAFT",
  confirmed_at: null,
};

export const FIRINGS_PAGE: FiringPage = {
  items: [
    {
      id: 10,
      code: "HR-2026-000001",
      status: "CONFIRMED",
      scheduled_date: null,
      firing_date: "2026-07-24",
      total_volume_cm3: "26010.000000",
      total_cost: "1656.062340",
      line_count: 1,
      session_count: 2,
      created_at: AHORA,
    },
    {
      id: 11,
      code: "HR-2026-000002",
      status: "DRAFT",
      scheduled_date: null,
      firing_date: null,
      total_volume_cm3: "12960.000000",
      total_cost: "1249.660900",
      line_count: 1,
      session_count: 2,
      created_at: AHORA,
    },
  ],
  total: 2,
  limit: 25,
  offset: 0,
};

export const CALCULO: FiringCalculateOut = {
  total_batches: 2,
  total_volume_cm3: "26010.000000",
  subtotal: "1041.384083",
  total_cost: "1249.660900",
  tax_percentage: "18.000000",
  tax_amount: "224.938962",
  total_with_tax: "1474.599862",
  currency_code: "PEN",
  currency_symbol: "S/",
  occupancy_percentage: "76.235294",
  occupancy_factor: "1.200000",
  capacity_exceeded: false,
  sessions: QUEMA_CONFIRMADA.sessions.map((sesion) => ({ ...sesion, id: null })),
  lines: QUEMA_CONFIRMADA.lines.map((linea) => ({ ...linea, id: null })),
};

/** El mismo cálculo pero con una pieza que no cabe en el horno. */
export const CALCULO_EXCEDIDO: FiringCalculateOut = {
  ...CALCULO,
  capacity_exceeded: true,
  lines: CALCULO.lines.map((linea) => ({
    ...linea,
    description: "Pieza enorme",
    total_volume_cm3: "1000000.000000",
    occupancy_percentage: "5882.352941",
    occupancy_bracket: 100,
    capacity_exceeded: true,
  })),
};

/** Catálogo mínimo para el selector de piezas. */
export const PRODUCTS_PAGE = {
  items: [
    {
      id: 501,
      internal_reference: "LAB50001",
      name: "Plato palta",
      product_type: "FINISHED_PRODUCT" as const,
      product_category_id: 1,
      product_category_path: "Piezas",
      pos_category_id: null,
      pos_category_name: null,
      base_uom_code: "u",
      purchase_uom_code: null,
      cost: null,
      sale_price: null,
      sale_tax_rate: null,
      active: true,
      purchasable: false,
      sellable: true,
    },
  ],
  total: 1,
  limit: 50,
  offset: 0,
};
