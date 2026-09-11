/**
 * Configuración comercial del Cotizador V2.
 *
 * Dos niveles conviven en esta pantalla y conviene no confundirlos:
 *
 * - lo **propio de V2**, que se edita aquí y define con qué nace una
 *   cotización nueva;
 * - lo **canónico de la empresa** —IGV, moneda, símbolo—, que se muestra pero
 *   se edita en la pestaña Comercial. Hay un único IGV verdadero: una segunda
 *   puerta para cambiarlo sería una segunda verdad, y la que quedara
 *   desactualizada emitiría documentos incorrectos.
 *
 * Nada de lo que se toca aquí altera una cotización ya creada: cada una se
 * llevó su copia al nacer.
 */

import type { V2CustomerKind, V2ProductionType } from "@/types/quoterV2";

export type FiringType = "LOW" | "HIGH";

export interface V2SettingsValues {
  version: number;
  updated_at: string;

  // Propio de V2
  workday_hours: string;
  space_service_cost_per_day: string;
  administrative_cost_per_quote: string;
  commercial_factor_default: string;
  commercial_factor_min: string;
  commercial_factor_max: string;
  quotation_validity_days: number;
  default_exchange_rate: string;
  default_production_type: V2ProductionType;
  default_customer_kind: V2CustomerKind;
  retail_kiln_id: number | null;
  wholesale_kiln_id: number | null;
  low_fire_enabled_default: boolean;
  high_fire_enabled_default: boolean;
  illustration_daily_rate: string;
  illustration_pieces_per_workday: string;

  /** Derivados por el backend. No se envían de vuelta: se calculan. */
  illustration_hourly_rate: string;
  illustration_pieces_per_hour: string;

  // Canónico de la empresa, solo lectura desde aquí
  tax_percent: string | null;
  currency_code: string | null;
  currency_symbol: string | null;
  canonical_source: string;
}

export interface V2KilnRate {
  kiln_id: number;
  kiln_code: string;
  kiln_name: string;
  firing_type: FiringType;
  gas_cost: string;
  external_rate: string;
  student_rate: string;
  /**
   * Si alguien la puso.
   *
   * La rejilla llega completa —todos los hornos, por baja y por alta— aunque
   * no haya ni una tarifa guardada; es lo que permite configurar la primera.
   * Los huecos vienen en cero, y este campo los distingue de un cero elegido.
   */
  configured: boolean;
}

export interface V2SettingsPage {
  settings: V2SettingsValues;
  kiln_rates: V2KilnRate[];
  /**
   * Los importes aprobados para un horno chico y uno grande.
   *
   * Se ofrecen, no se aplican solos: el sistema no sabe cuál de los hornos del
   * taller es «el chico», y adivinarlo por capacidad pondría una tarifa de 200
   * soles en el horno equivocado.
   */
  reference_rates: Record<string, Record<string, string>>;
}

/** Solo lo propio de V2. El IGV no viaja por aquí. */
export interface V2SettingsUpdateInput {
  expected_version: number;
  workday_hours?: string;
  space_service_cost_per_day?: string;
  administrative_cost_per_quote?: string;
  commercial_factor_min?: string;
  commercial_factor_default?: string;
  commercial_factor_max?: string;
  quotation_validity_days?: number;
  default_exchange_rate?: string;
  default_production_type?: V2ProductionType;
  default_customer_kind?: V2CustomerKind;
  retail_kiln_id?: number | null;
  wholesale_kiln_id?: number | null;
  low_fire_enabled_default?: boolean;
  high_fire_enabled_default?: boolean;
  illustration_daily_rate?: string;
  illustration_pieces_per_workday?: string;
}

export interface V2KilnRateInput {
  gas_cost?: string;
  external_rate?: string;
  student_rate?: string;
}

export const FIRING_TYPE_LABEL: Record<FiringType, string> = {
  LOW: "Baja",
  HIGH: "Alta",
};
