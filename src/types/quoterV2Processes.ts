/**
 * Procesos de la pieza y adicionales de la cotización (corrección 010H).
 *
 * El proceso dice QUÉ hay que hacerle a la pieza y a cuántas piezas; existe
 * antes de que se sepa quién lo hará. La tarea —la mano de obra de 010D— dice
 * QUIÉN lo hace y cuánto cuesta. Por eso aquí `worker_id` y `labor_cost` pueden
 * venir vacíos: un proceso sin asignar todavía no cuesta nada.
 *
 * Los adicionales no son material ni técnica: no se consumen del inventario ni
 * tienen rendimiento. Son un costo que alguien decide, y viven aparte para que
 * nadie los cobre dos veces.
 */

/** De dónde salió el proceso. */
export type V2ProcessOrigin = "PRODUCT" | "MANUAL";

export interface V2Process {
  id: number;
  v2_quotation_product_id: number;
  product_name: string | null;
  technique_id: number;
  technique_name: string;
  technique_unit: string;
  technique_active: boolean;
  standard_capacity: string;
  /** Horas decididas a mano: el rendimiento no las calcula. */
  manual_hours: boolean;
  origin: V2ProcessOrigin;
  quantity: string;
  /** Piezas escritas a mano: la cantidad del producto ya no las pisa. */
  quantity_overridden: boolean;
  /** Al rendimiento estándar. `null` si la técnica decide sus horas a mano. */
  calculated_hours: string | null;
  labor_id: number | null;
  worker_id: number | null;
  worker_name: string | null;
  final_hours: string | null;
  labor_cost: string | null;
  warnings: string[];
}

export interface V2ProcessPage {
  items: V2Process[];
  warnings: string[];
}

export interface V2ProcessInput {
  v2_quotation_product_id: number;
  technique_id: number;
  /** Ausente: las piezas de la línea. */
  quantity?: string;
}

export interface V2ProductTechnique {
  technique_id: number;
  technique_name: string;
  sort_order: number;
  active: boolean;
}

export interface V2ProductTechniquesPage {
  product_id: number;
  items: V2ProductTechnique[];
}

// ------------------------------------------------------------- adicionales
export interface V2Extra {
  id: number;
  name: string;
  unit: string;
  unit_cost: string;
  active: boolean;
  notes: string | null;
  version: number;
}

export interface V2ExtraCreateInput {
  name: string;
  unit?: string;
  unit_cost?: string;
  active?: boolean;
  notes?: string | null;
}

export interface V2ExtraUpdateInput {
  expected_version: number;
  name?: string;
  unit?: string;
  unit_cost?: string;
  active?: boolean;
  notes?: string | null;
}

export interface V2QuotationExtra {
  id: number;
  v2_extra_id: number;
  /** `null`: es de todo el pedido. */
  v2_quotation_product_id: number | null;
  name_snapshot: string;
  unit_snapshot: string;
  unit_cost_snapshot: string;
  unit_cost_is_override: boolean;
  description: string | null;
  quantity: string;
  total_cost: string;
  sort_order: number;
  created_at: string;
}

export interface V2QuotationExtraPage {
  items: V2QuotationExtra[];
  extras_cost_total: string;
  warnings: string[];
}

export interface V2QuotationExtraInput {
  v2_extra_id: number;
  v2_quotation_product_id?: number | null;
  quantity?: string;
  /** Ausente: el precio del maestro. */
  unit_cost?: string | null;
  description?: string | null;
}

export interface V2QuotationExtraUpdateInput {
  v2_quotation_product_id?: number | null;
  quantity?: string;
  unit_cost?: string | null;
  description?: string | null;
}
