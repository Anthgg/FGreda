/**
 * Cotización de prototipo: el documento comercial, no la muestra física.
 *
 * La regla que gobierna estos tipos: **el navegador manda intención y recibe
 * importes**. Por eso `PrototypeQuotationDraftInput` no tiene ni un campo de
 * dinero calculado —ni subtotal, ni IGV, ni total, ni costo unitario, ni
 * plazo— y `PrototypeCostBreakdown` es de sólo lectura.
 *
 * La unidad de medida tampoco viaja de ida: la manda el catálogo del material.
 * Si la pantalla pudiera elegirla, se cotizarían kilos de algo que se lleva en
 * gramos.
 */

export type PrototypeQuotationStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";
export type PrototypeQuotationPaymentStatus = "UNPAID" | "PAID";

/** El mismo vocabulario que las quemas. «Baja» y «Alta» son etiquetas. */
export type FiringType = "LOW" | "HIGH";

export interface PrototypeQuotationMaterialInput {
  product_id: number;
  /** Por UNA muestra. El total lo multiplica el backend. */
  quantity_per_prototype: string;
  is_body_material?: boolean;
}

export interface PrototypeQuotationDraftInput {
  customer_id?: number | null;
  product_id?: number | null;
  description: string;
  quantity: number;

  width_cm?: string | null;
  length_cm?: string | null;
  height_cm?: string | null;
  depth_cm?: string | null;

  technical_specifications?: Record<string, unknown> | null;
  notes?: string | null;

  design_days: string;
  /**
   * Nulo NO es cero: significa «cobra lo que cobre la casa». Rellenarlo con el
   * valor por defecto convertiría una herencia en un precio pactado, y el
   * borrador dejaría de seguir la configuración si ésta cambia.
   */
  design_rate_override?: string | null;
  artist_days: string;
  artist_rate_override?: string | null;

  mold_maker_partner_id?: number | null;
  /** Precio FIJO. Sus días alargan el plazo, no multiplican el importe. */
  mold_maker_price_override?: string | null;
  mold_maker_days: string;

  kiln_id?: number | null;
  /** Sin valor por defecto: elegir uno en silencio cotizaría a otra tarifa. */
  firing_type?: FiringType | null;
  firing_batches: number;

  drying_days: string;
  adjustment_days: string;
  fixed_cost_override?: string | null;

  materials: PrototypeQuotationMaterialInput[];
}

export interface PrototypeQuotationUpdateInput extends PrototypeQuotationDraftInput {
  /** Bloqueo optimista: sin esto dos personas editando se pisarían en silencio. */
  expected_updated_at?: string | null;
}

export interface PrototypeQuotationMaterial {
  id: number | null;
  product_id: number;
  product_name: string;
  quantity_per_prototype: string;
  total_quantity: string;
  /** Del catálogo. Sólo lectura. */
  uom_code: string;
  unit_cost: string;
  cost: string;
  is_body_material: boolean;
}

/** El desglose interno: lo ve quien cotiza, no sale en el PDF del cliente. */
export interface PrototypeCostBreakdown {
  design_cost: string;
  artist_cost: string;
  mold_maker_cost: string;
  materials_cost: string;
  firing_cost: string;
  fixed_cost: string;
  base_cost: string;

  /** Antes del escalón comercial. Explica de dónde sale el ajuste. */
  raw_tax: string;
  raw_gross_total: string;

  commercial_net_total: string;
  tax_percent: string;
  commercial_tax_total: string;
  commercial_gross_total: string;
  total_per_prototype: string;

  rounding_step: string;
  rounding_source: string | null;

  /** Las tarifas realmente usadas: la de la casa o la pactada. */
  design_rate: string;
  artist_rate: string;
  mold_maker_price: string;
  firing_rate: string;
  firing_days_per_batch: number;

  design_days: string;
  artist_days: string;
  mold_maker_days: string;
  drying_days: string;
  firing_days: number;
  adjustment_days: string;
  estimated_days: string;
  target_date: string | null;

  materials: PrototypeQuotationMaterial[];
}

export interface PrototypeQuotation {
  id: number;
  code: string | null;
  status: PrototypeQuotationStatus;
  payment_status: PrototypeQuotationPaymentStatus;
  paid_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;

  customer_id: number | null;
  customer_name: string | null;
  product_id: number | null;
  description: string;
  quantity: number;

  width_cm: string | null;
  length_cm: string | null;
  height_cm: string | null;
  depth_cm: string | null;
  technical_specifications: Record<string, unknown> | null;
  notes: string | null;

  design_days: string;
  design_rate_override: string | null;
  artist_days: string;
  artist_rate_override: string | null;
  mold_maker_partner_id: number | null;
  mold_maker_price_override: string | null;
  mold_maker_days: string;
  kiln_id: number | null;
  firing_type: FiringType | null;
  firing_batches: number;
  drying_days: string;
  adjustment_days: string;
  fixed_cost_override: string | null;

  currency_code: string | null;
  currency_symbol: string | null;
  exchange_rate: string | null;

  costing: PrototypeCostBreakdown | null;

  /** La muestra física que nació al cobrar, si ya se cobró. */
  prototype_id: number | null;
  prototype_code: string | null;

  updated_at: string | null;
}

export interface PrototypeQuotationListItem {
  id: number;
  code: string | null;
  status: PrototypeQuotationStatus;
  payment_status: PrototypeQuotationPaymentStatus;
  customer_name: string | null;
  description: string;
  quantity: number;
  commercial_gross_total: string | null;
  estimated_days: string | null;
  confirmed_at: string | null;
}

export interface PrototypeQuotationPage {
  items: PrototypeQuotationListItem[];
  total: number;
}
