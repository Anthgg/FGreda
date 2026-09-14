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

/**
 * Lo que la cotización ES hoy. Fase 010H.
 *
 * `EXPIRED` y `READY_FOR_PRODUCTION` no se guardan: los calcula el backend con
 * su reloj. La pantalla nunca decide si una oferta venció comparando fechas
 * con el reloj del navegador, que puede ir adelantado o estar en otra zona.
 */
export type V2EffectiveStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "EXPIRED"
  | "READY_FOR_PRODUCTION"
  | "CANCELLED";

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

  // ---- Fase 010H: ciclo de vida ------------------------------------------
  /** Observaciones que SÍ salen en el PDF. `notes` sigue siendo interno. */
  client_notes: string | null;
  effective_status: V2EffectiveStatus;
  issued_at: string | null;
  /** Último día (calendario de Lima) en que la oferta vale, `YYYY-MM-DD`. */
  valid_until: string | null;
  expires_at: string | null;
  issued_by_name: string | null;
  cancelled_at: string | null;
  cancelled_by_name: string | null;
  cancel_reason: string | null;
  duplicated_from_id: number | null;
  /** El borrador ya abierto a partir de esta: se ofrece ir a él, no duplicar otra vez. */
  open_duplicate_id: number | null;
  production_handoff: V2ProductionHandoff | null;
}

export interface V2ProductionHandoff {
  id: number;
  v2_quotation_id: number;
  status: "READY_FOR_PRODUCTION";
  created_at: string;
  created_by_name: string | null;
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
  client_notes?: string | null;
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
  effective_status: V2EffectiveStatus;
  valid_until: string | null;
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

/**
 * El estado en PALABRAS. Fase 010H. Se enseña siempre escrito: un distintivo
 * que solo cambia de color no distingue una vencida para quien no ve el ámbar.
 */
export const V2_EFFECTIVE_STATUS_LABEL: Record<V2EffectiveStatus, string> = {
  DRAFT: "Borrador",
  CONFIRMED: "Emitida",
  EXPIRED: "Vencida",
  READY_FOR_PRODUCTION: "Lista para producción",
  CANCELLED: "Anulada",
};

// ---- Fase 010H: emisión, anulación, duplicación y producción --------------

export interface V2Blocker {
  code: string;
  line_id: number | null;
}

export interface V2PreviewLine {
  id: number;
  product_name: string | null;
  quantity: number;
  length_cm: string | null;
  width_cm: string | null;
  height_cm: string | null;
  client_observation: string | null;
  unit_price: string;
  line_subtotal: string;
  line_tax: string;
  line_total: string;
}

/** El resumen que se revisa antes de emitir. Sin un solo costo interno. */
export interface V2ConfirmationPreview {
  quotation_id: number;
  code: string;
  status: V2QuotationStatus;
  effective_status: V2EffectiveStatus;
  can_confirm: boolean;
  blockers: V2Blocker[];
  warnings: string[];
  /** Se devuelve al confirmar: si el documento cambió entre medias, el backend responde 409. */
  fingerprint: string;
  customer_name: string | null;
  /** Lo que el PDF dirá del cliente y las condiciones. Entra en la huella. */
  customer_document?: string | null;
  customer_address?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  conditions?: string | null;
  payment_notes?: string | null;
  name: string | null;
  client_notes: string | null;
  currency_code: string | null;
  currency_symbol: string | null;
  exchange_rate: string | null;
  tax_percent: string | null;
  commercial_factor: string | null;
  validity_days: number | null;
  valid_until: string | null;
  subtotal_amount: string;
  tax_amount: string;
  total_amount: string;
  lines: V2PreviewLine[];
}

export interface V2DuplicateWarning {
  code: string;
  name: string | null;
}

export interface V2DuplicateResult {
  quotation: V2Quotation;
  /** Falso cuando ya había un borrador abierto de la misma: el doble clic no crea otro. */
  created: boolean;
  warnings: V2DuplicateWarning[];
}

export interface V2SendToProductionResult {
  handoff: V2ProductionHandoff;
  created: boolean;
}

export interface V2HistoryEvent {
  event: string;
  at: string;
  user_name: string | null;
  details: Record<string, string | null>;
}

export const V2_PRODUCTION_TYPE_LABEL: Record<V2ProductionType, string> = {
  RETAIL: "Por menor",
  WHOLESALE: "Por mayor",
};
