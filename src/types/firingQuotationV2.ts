/**
 * Solo Quema V2 (fase 010K): el servicio de quema de piezas que el cliente trae.
 *
 * No es el Cotizador V2. No lleva pasta, ni torno, ni mano de obra productiva,
 * y su factor va de ×1,00 a ×2,00 —no el ×2..×10 de fabricación—.
 *
 * Dos lecturas que no se mezclan:
 *
 * - la INTERNA (`V2FiringQuotation`): gas, costo real, ganancia, margen y la
 *   comparación entre hornos. Solo administración;
 * - la del CLIENTE (`V2FiringQuotationPreview` y el PDF): piezas, servicio,
 *   subtotal, IGV y total.
 *
 * La pantalla no calcula: todos los importes llegan del backend.
 */

import type { V2CustomerKind, V2EffectiveStatus, V2QuotationStatus } from "@/types/quoterV2";
import type { V2FiringMode } from "@/types/quoterV2Firing";


export type V2GlazeCostSource = "MASTER" | "MANUAL";

export const GLAZE_SOURCE_LABEL: Record<V2GlazeCostSource, string> = {
  MASTER: "Esmalte del maestro",
  MANUAL: "Costo escrito a mano",
};

export interface V2FiringQuotationLine {
  id: number;
  sort_order: number;
  product_id: number | null;
  product_name: string | null;
  quantity: number;
  length_cm: string | null;
  width_cm: string | null;
  height_cm: string | null;
  /** La separación de la cotización, repetida para leer la fila sola. */
  separation_cm: string;
  unit_volume_cm3: string;
  total_volume_cm3: string;
  volume_share_percent: string;
}

export interface V2FiringModeQuote {
  billed_load: string;
  commercial: string;
  gas: string;
}

export interface V2FiringQuotationKiln {
  kiln_id: number;
  name: string;
  capacity_cm3: string;
  active: boolean;
  selected: boolean;
  occupancy_percent: string;
  firing_count: number;
  batch_loads: string[];
  /** `null` si al horno le falta la tarifa de algún ciclo encendido. */
  shared: V2FiringModeQuote | null;
  exclusive: V2FiringModeQuote | null;
}

/** «El horno grande reduce el costo estimado en S/ X». Solo una sugerencia. */
export interface V2FiringQuotationSuggestion {
  kiln_id: number;
  name: string;
  commercial: string;
  savings: string;
}

export interface V2FiringQuotation {
  id: number;
  code: string;
  status: V2QuotationStatus;
  effective_status: V2EffectiveStatus;
  name: string | null;
  notes: string | null;
  client_notes: string | null;
  customer_id: number | null;
  customer_name: string | null;
  customer_kind: V2CustomerKind;
  currency_code: string | null;
  currency_symbol: string | null;
  exchange_rate: string | null;
  tax_percent: string | null;
  rounding_step: string | null;
  validity_days: number | null;

  kiln_id: number | null;
  kiln_name: string | null;
  kiln_capacity_cm3: string | null;
  firing_mode: V2FiringMode;
  low_fire_enabled: boolean;
  high_fire_enabled: boolean;
  piece_separation_cm: string;
  total_volume_cm3: string;
  occupancy_percent: string;
  /** Hornadas FÍSICAS: cuántas veces se enciende. */
  firing_count: number;
  /** Hornadas que se COBRAN: ocupación/100 en compartida, enteras en exclusiva. */
  billed_load: string;
  batch_loads: string[];
  commercial_rate_low: string | null;
  commercial_rate_high: string | null;
  gas_cost_low: string | null;
  gas_cost_high: string | null;
  firing_commercial_total: string;
  /** Gas real: COSTO interno. Nunca va al documento. */
  firing_gas_total: string;

  glaze_enabled: boolean;
  glaze_grams: string;
  glaze_cost_source: V2GlazeCostSource;
  glaze_material_id: number | null;
  glaze_material_name: string | null;
  glaze_manual_cost_per_gram: string | null;
  glaze_cost_per_gram: string | null;
  glaze_material_cost: string;
  glaze_labor_enabled: boolean;
  glaze_labor_worker_id: number | null;
  glaze_labor_worker_name: string | null;
  glaze_labor_worker_type: string | null;
  glaze_labor_technique_id: number | null;
  glaze_labor_technique_name: string | null;
  glaze_labor_quantity: string;
  glaze_labor_hours: string;
  glaze_labor_cost: string;

  factor: string;
  factor_min: string;
  factor_max: string;
  /** Quema comercial + vidriado. El gas NO entra. */
  base_amount: string;
  commercial_price: string;
  subtotal_amount: string;
  tax_amount: string;
  total_amount: string;
  real_cost_total: string;
  estimated_profit: string;
  effective_margin_percent: string;

  kilns: V2FiringQuotationKiln[];
  suggestion: V2FiringQuotationSuggestion | null;
  lines: V2FiringQuotationLine[];
  warnings: string[];

  issued_at: string | null;
  valid_until: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  duplicated_from_id: number | null;
  created_at: string;
  created_by_name: string | null;
}

export interface V2FiringQuotationListItem {
  id: number;
  code: string;
  status: V2QuotationStatus;
  effective_status: V2EffectiveStatus;
  name: string | null;
  customer_name: string | null;
  currency_code: string | null;
  total_amount: string;
  created_at: string;
  valid_until: string | null;
}

export interface V2FiringQuotationPage {
  items: V2FiringQuotationListItem[];
  total: number;
}

export interface V2FiringQuotationBlocker {
  code: string;
  line_id: number | null;
}

export interface V2FiringQuotationPreviewLine {
  id: number;
  product_name: string | null;
  quantity: number;
  length_cm: string | null;
  width_cm: string | null;
  height_cm: string | null;
}

export interface V2FiringQuotationPreview {
  id: number;
  code: string;
  status: V2QuotationStatus;
  effective_status: V2EffectiveStatus;
  can_confirm: boolean;
  blockers: V2FiringQuotationBlocker[];
  warnings: string[];
  fingerprint: string;
  customer_name: string | null;
  name: string | null;
  client_notes: string | null;
  kiln_name: string | null;
  service_label: string;
  firing_mode: V2FiringMode;
  glaze_enabled: boolean;
  currency_code: string | null;
  currency_symbol: string | null;
  exchange_rate: string | null;
  tax_percent: string | null;
  validity_days: number | null;
  valid_until: string | null;
  subtotal_amount: string;
  tax_amount: string;
  total_amount: string;
  lines: V2FiringQuotationPreviewLine[];
}

export interface V2FiringQuotationCreateInput {
  name?: string | null;
  customer_id?: number | null;
  customer_kind?: V2CustomerKind;
  currency_code?: string;
  exchange_rate?: string;
  notes?: string | null;
  client_notes?: string | null;
}

export interface V2FiringQuotationUpdateInput {
  name?: string | null;
  notes?: string | null;
  client_notes?: string | null;
  customer_id?: number | null;
  customer_kind?: V2CustomerKind;
  currency_code?: string;
  exchange_rate?: string;
  kiln_id?: number | null;
  firing_mode?: V2FiringMode;
  low_fire_enabled?: boolean;
  high_fire_enabled?: boolean;
  piece_separation_cm?: string;
  factor?: string;
  glaze_enabled?: boolean;
  glaze_grams?: string;
  glaze_cost_source?: V2GlazeCostSource;
  glaze_material_id?: number | null;
  glaze_manual_cost_per_gram?: string | null;
  glaze_labor_enabled?: boolean;
  glaze_labor_worker_id?: number | null;
  glaze_labor_technique_id?: number | null;
  glaze_labor_quantity?: string;
}

export interface V2FiringQuotationLineInput {
  product_id?: number | null;
  product_name?: string | null;
  quantity?: number;
  length_cm?: string | null;
  width_cm?: string | null;
  height_cm?: string | null;
}

export interface V2FiringQuotationDuplicateResult {
  quotation: V2FiringQuotation;
  created: boolean;
  warnings: string[];
}

/** Los avisos del backend, en lenguaje de taller. */
export const FIRING_QUOTATION_WARNING_LABEL: Record<string, string> = {
  V2_FQ_NO_LINES: "Todavía no hay piezas que quemar.",
  V2_FQ_LINE_WITHOUT_DIMENSIONS:
    "Alguna pieza no tiene medidas y no ocupa horno. Revise si falta medirla.",
  V2_FQ_NO_KILN: "Falta elegir el horno: sin él no hay quema que calcular.",
  V2_FQ_KILN_INACTIVE: "El horno se dio de baja después. Elija otro o manténgalo.",
  V2_FQ_NO_CYCLE: "No hay ninguna quema seleccionada: ni baja ni alta.",
  V2_FQ_RATES_MISSING:
    "El horno no tiene tarifas configuradas para los ciclos elegidos. Se costea en cero hasta que se pongan.",
  V2_FQ_MULTIPLE_FIRINGS: "La carga no entra en una sola hornada.",
  V2_FQ_EXCLUSIVE_RAISES_PRICE:
    "La quema exclusiva reserva hornadas completas y por eso cuesta más que la compartida.",
  V2_FQ_GLAZE_NO_MATERIAL:
    "No hay ningún esmalte valorizado y activo. Valorice uno o escriba el costo por gramo a mano.",
  V2_FQ_GLAZE_MANUAL_COST_MISSING: "Falta el costo por gramo del esmalte.",
  V2_FQ_GLAZE_WITHOUT_GRAMS: "El vidriado está activo pero no se indicaron gramos.",
  V2_FQ_GLAZE_LABOR_INCOMPLETE: "Falta indicar quién vidria y con qué técnica.",
  V2_FQ_SELLING_BELOW_COST: "El precio está por debajo del costo real.",
};

/** Lo que impide emitir. */
export const FIRING_QUOTATION_BLOCKER_LABEL: Record<string, string> = {
  V2_FQ_NO_CUSTOMER: "Falta el cliente al que se le emite.",
  V2_FQ_NO_LINES: "Falta añadir al menos una pieza.",
  V2_FQ_LINE_WITHOUT_NAME: "Una pieza no tiene nombre.",
  V2_FQ_LINE_WITHOUT_QUANTITY: "Una pieza no tiene cantidad.",
  V2_FQ_LINE_WITHOUT_DIMENSIONS: "Una pieza no tiene medidas.",
  V2_FQ_NO_KILN: "Falta elegir el horno.",
  V2_FQ_KILN_INACTIVE: "El horno elegido está dado de baja.",
  V2_FQ_NO_CYCLE: "Falta elegir la quema: baja, alta o ambas.",
  V2_FQ_RATES_MISSING: "El horno no tiene tarifas para los ciclos elegidos.",
  V2_FQ_GLAZE_INCOMPLETE: "El vidriado está activo y le falta el costo o los gramos.",
  V2_FQ_GLAZE_LABOR_INCOMPLETE: "La mano de obra de vidriado está incompleta.",
  V2_FQ_NO_VALIDITY: "La cotización no tiene vigencia configurada.",
  V2_FQ_ZERO_TOTAL: "El total es cero: revise piezas, horno y tarifas.",
};

export const FIRING_QUOTATION_DUPLICATE_WARNING_LABEL: Record<string, string> = {
  V2_FQ_DUP_CUSTOMER_UNAVAILABLE: "El cliente ya no está activo: elija otro.",
  V2_FQ_DUP_KILN_UNAVAILABLE: "El horno ya no está activo: elija otro.",
  V2_FQ_DUP_GLAZE_UNAVAILABLE: "El esmalte ya no está valorizado: revise el vidriado.",
  V2_FQ_DUP_LABOR_UNAVAILABLE: "La persona o la técnica de vidriado ya no están disponibles.",
  V2_FQ_DUP_PRODUCT_UNAVAILABLE: "Alguna pieza del catálogo ya no existe.",
};
