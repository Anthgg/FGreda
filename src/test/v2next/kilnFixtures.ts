import type { V2Firing } from "@/types/quoterV2Firing";
import { COTIZACION } from "@/test/v2next/shellFixtures";

/**
 * Fixtures propias del paso Horno. No salen de los mocks compartidos porque
 * esta fase necesita casos visuales concretos: recomendaciones, tarifas
 * ausentes, moneda extranjera y una carga de 250 %.
 */

export const COTIZACION_HORNO = {
  ...COTIZACION,
  currency_code: "USD",
  currency_symbol: "US$",
  exchange_rate: "3.750000",
};

export const QUEMA_HORNO: V2Firing = {
  production_type: "RETAIL",
  customer_kind: "EXTERNAL",
  kiln_id: 1,
  kiln_name: "Horno chico",
  kiln_capacity_cm3: "17000.000000",
  total_volume_cm3: "42500.000000",
  occupancy_percent: "250.000000",
  firing_count: 3,
  firing_mode: "SHARED",
  piece_separation_cm: "3.000000",
  billed_load: "2.500000",
  low_fire_enabled: true,
  high_fire_enabled: true,
  low_fire_count: 3,
  high_fire_count: 3,
  batch_loads: ["100.000000", "100.000000", "50.000000"],
  gas_cost_low: "35.000000",
  gas_cost_high: "70.000000",
  gas_low_is_override: false,
  gas_high_is_override: true,
  commercial_rate_low: "200.000000",
  commercial_rate_high: "250.000000",
  commercial_low_is_override: true,
  commercial_high_is_override: false,
  gas_total: "262.500000",
  commercial_total: "1125.000000",
  difference: "862.500000",
  recommended_kiln_id: 2,
  cheaper_kiln: {
    kiln_id: 2,
    name: "Horno grande",
    commercial_total: "900.000000",
    savings: "225.000000",
  },
  kilns: [
    {
      kiln_id: 1,
      code: "KILN-001",
      name: "Horno chico",
      capacity_cm3: "17000.000000",
      active: true,
      occupancy_percent: "250.000000",
      firing_count: 3,
      billed_load: "2.500000",
      commercial_total: "1125.000000",
      gas_total: "262.500000",
      has_rates: true,
    },
    {
      kiln_id: 2,
      code: "KILN-002",
      name: "Horno grande",
      capacity_cm3: "200000.000000",
      active: true,
      occupancy_percent: "21.250000",
      firing_count: 1,
      billed_load: "0.212500",
      commercial_total: "900.000000",
      gas_total: "120.000000",
      has_rates: true,
    },
    {
      kiln_id: 3,
      code: "KILN-003",
      name: "Horno sin tarifas",
      capacity_cm3: "50000.000000",
      active: true,
      occupancy_percent: "85.000000",
      firing_count: 1,
      billed_load: "0.850000",
      commercial_total: null,
      gas_total: null,
      has_rates: false,
    },
  ],
  lines: [
    {
      line_id: 11,
      product_name: "Plato palta",
      quantity: 20,
      total_volume_cm3: "27200.000000",
      occupancy_percent: "160.000000",
      volume_share_percent: "64.000000",
      commercial_cost: "720.000000",
      gas_cost: "168.000000",
    },
    {
      line_id: 12,
      product_name: "Taza alta",
      quantity: 10,
      total_volume_cm3: "15300.000000",
      occupancy_percent: "90.000000",
      volume_share_percent: "36.000000",
      commercial_cost: "405.000000",
      gas_cost: "94.500000",
    },
  ],
  warnings: [
    "V2_FIRING_OVER_CAPACITY",
    "V2_FIRING_SMALLER_KILN_FITS",
    "V2_WARNING_NUEVO",
  ],
};

export function crearQuemaHorno(overrides: Partial<V2Firing> = {}): V2Firing {
  return { ...QUEMA_HORNO, ...overrides };
}
