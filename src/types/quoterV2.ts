/**
 * Cotizador V2. Tipos PROPIOS, sin ningún parentesco con `quotationBuilder`.
 *
 * Fase 010A. Compartir tipos con el Cotizador histórico sería la forma más
 * cómoda de empezar y la más cara de terminar: cada campo económico de Legacy
 * significa algo dentro del motor viejo, y arrastrarlo aquí ataría las dos
 * pantallas a la misma forma de calcular justo cuando se quiere separarlas.
 *
 * En 010A el contrato es deliberadamente corto: identidad, estado y las dos
 * decisiones de cabecera. Ni un importe. El motor —materiales, quema, mano de
 * obra, factor comercial, IGV, moneda— llega con su fase.
 *
 * La regla que gobierna estos tipos es la de siempre en GREDA: **el navegador
 * manda intención y recibe importes**. Por eso `V2QuotationCreateInput` no
 * tiene un solo campo calculado.
 */

/** Siempre `"V2"` en este dominio. Viaja para no tener que deducirlo del código. */
export type PricingEngineVersion = "LEGACY" | "V2";

export type V2QuotationStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";

/** Por menor / por mayor. Lo elige la persona; el sistema nunca lo cambia solo. */
export type V2ProductionType = "RETAIL" | "WHOLESALE";

/**
 * A quién se cotiza, a efectos de TARIFA de horno.
 *
 * Un cliente externo y un alumno pagan la misma quema a precios distintos. Se
 * elige y se guarda: nunca se deduce del nombre del tercero.
 */
export type V2CustomerKind = "EXTERNAL" | "STUDENT";

export interface V2QuotationCreateInput {
  name?: string | null;
  customer_id?: number | null;
  production_type?: V2ProductionType;
  notes?: string | null;
}

export interface V2Quotation {
  id: number;
  code: string;
  pricing_engine_version: PricingEngineVersion;
  status: V2QuotationStatus;
  production_type: V2ProductionType;
  customer_id: number | null;
  customer_name: string | null;
  name: string | null;
  notes: string | null;

  /**
   * La copia congelada de la configuración, tal y como estaba al crear.
   *
   * El backend la manda desde 010B y este tipo la ignoraba: la pantalla
   * enseñaba los valores de hoy en vez de aquellos con los que se armó ESTA
   * cotización, que es justo lo que los snapshots existen para evitar.
   */
  customer_kind: V2CustomerKind | null;
  tax_percent: string | null;
  currency_code: string | null;
  currency_symbol: string | null;
  /** Solo en moneda extranjera. En la base no hay nada que convertir. */
  exchange_rate: string | null;
  validity_days: number | null;
  workday_hours: string | null;
  space_service_cost_per_day: string | null;
  administrative_cost: string | null;
  commercial_factor: string | null;
  commercial_factor_min: string | null;
  commercial_factor_max: string | null;
  low_fire_enabled: boolean | null;
  high_fire_enabled: boolean | null;
  settings_version: number | null;

  created_at: string;
  updated_at: string;
}

/**
 * Cambio de la CABECERA de un borrador. Fase 010G.
 *
 * Existe porque el flujo deja volver atrás: quien está eligiendo el horno puede
 * darse cuenta de que el cliente está mal y regresar al primer paso. Semántica
 * parcial: lo ausente se conserva, y NAVEGAR no es editar.
 */
export interface V2QuotationUpdateInput {
  name?: string | null;
  customer_id?: number | null;
  production_type?: V2ProductionType;
  customer_kind?: V2CustomerKind;
  currency_code?: string;
  exchange_rate?: string | null;
  notes?: string | null;
}

export interface V2QuotationListItem {
  id: number;
  code: string;
  pricing_engine_version: PricingEngineVersion;
  status: V2QuotationStatus;
  production_type: V2ProductionType;
  customer_name: string | null;
  name: string | null;
  created_at: string;
}

export interface V2QuotationPage {
  items: V2QuotationListItem[];
  total: number;
}

export const V2_STATUS_LABEL: Record<V2QuotationStatus, string> = {
  DRAFT: "Borrador",
  CONFIRMED: "Emitida",
  CANCELLED: "Anulada",
};

export const V2_PRODUCTION_TYPE_LABEL: Record<V2ProductionType, string> = {
  RETAIL: "Por menor",
  WHOLESALE: "Por mayor",
};
