/**
 * Contratos del modulo de quemas.
 *
 * Todo importe, volumen, dimension, porcentaje y factor viaja como **texto
 * decimal**. No se convierten a `number`: `parseFloat` sobre "1041.384083"
 * introduce un error binario que se arrastraria hasta la cotizacion. Solo los
 * identificadores y las cantidades de piezas son numeros.
 */

export type FiringType = "LOW" | "HIGH";
export type FiringStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";

// ---------------------------------------------------------------------------
// Hornos
// ---------------------------------------------------------------------------
export interface KilnOccupancyFactorOut {
  id: number;
  kiln_id: number;
  min_percentage: number;
  max_percentage: number;
  /** Decimal como texto. */
  factor: string;
}

export interface KilnOut {
  id: number;
  code: string;
  name: string;
  /** Decimal como texto, en cm³. */
  capacity_volume_cm3: string;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** Tarifa vigente de quema baja. Nula si no hay ninguna configurada. */
  current_low_rate: string | null;
  current_high_rate: string | null;
  occupancy_factors: KilnOccupancyFactorOut[];
}

export interface KilnPage {
  items: KilnOut[];
  total: number;
  limit: number;
  offset: number;
}

export interface KilnCreate {
  name: string;
  capacity_volume_cm3: string;
  active?: boolean;
  notes?: string | null;
}

export interface KilnUpdate {
  name?: string;
  capacity_volume_cm3?: string;
  active?: boolean;
  notes?: string | null;
}

export interface KilnRateIn {
  firing_type: FiringType;
  rate: string;
  valid_from?: string;
}

export interface KilnRateOut {
  id: number;
  kiln_id: number;
  firing_type: FiringType;
  rate: string;
  valid_from: string;
  /** Nulo mientras la tarifa esta vigente. */
  valid_to: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Hojas de quema: entrada
// ---------------------------------------------------------------------------
export interface FiringSessionIn {
  kiln_id: number;
  firing_type: FiringType;
  sort_order?: number;
}

export interface FiringLineIn {
  product_id?: number | null;
  description: string;
  quantity: number;
  length_cm: string;
  width_cm: string;
  height_cm: string;
  /** Horno que hace la quema baja de esta pieza. */
  low_kiln_id?: number | null;
  /** Horno que hace la quema alta de esta pieza. */
  high_kiln_id?: number | null;
  /** Horno cuya capacidad decide el tramo de ocupacion. */
  factor_kiln_id?: number | null;
  notes?: string | null;
  sort_order?: number;
}

export interface FiringIn {
  scheduled_date?: string | null;
  firing_date?: string | null;
  notes?: string | null;
  sessions: FiringSessionIn[];
  lines: FiringLineIn[];
}

// ---------------------------------------------------------------------------
// Hojas de quema: salida
// ---------------------------------------------------------------------------
export interface FiringSessionOut {
  id: number | null;
  kiln_id: number;
  kiln_code: string;
  kiln_name: string;
  firing_type: FiringType;
  rate_snapshot: string;
  capacity_snapshot: string;
  assigned_volume_cm3: string;
  physical_occupancy_percentage: string;
  subtotal: string;
  capacity_exceeded: boolean;
  /**
   * Fase 009C: hornadas necesarias para esta sesion. En una hoja de quema
   * real siempre es 1 (la hoja describe UNA hornada fisica); el Cotizador,
   * que planifica, puede necesitar varias.
   */
  batches: number;
  sort_order: number;
}

export interface FiringLineOut {
  id: number | null;
  product_id: number | null;
  product_internal_reference: string | null;
  description: string;
  quantity: number;
  length_cm: string;
  width_cm: string;
  height_cm: string;
  unit_volume_cm3: string;
  total_volume_cm3: string;
  low_kiln_id: number | null;
  high_kiln_id: number | null;
  factor_kiln_id: number | null;
  volume_share: string;
  occupancy_percentage: string;
  /** Tramo comercial en decenas: 10, 20 … 100. */
  occupancy_bracket: number;
  occupancy_factor: string;
  base_cost: string;
  allocated_cost: string;
  capacity_exceeded: boolean;
  notes: string | null;
  sort_order: number;
}

export interface FiringCalculateOut {
  total_volume_cm3: string;
  subtotal: string;
  total_cost: string;
  tax_percentage: string;
  tax_amount: string;
  total_with_tax: string;
  currency_code: string;
  currency_symbol: string;
  occupancy_percentage: string;
  occupancy_factor: string;
  capacity_exceeded: boolean;
  /** Fase 009C: suma de hornadas de todas las sesiones. */
  total_batches: number;
  sessions: FiringSessionOut[];
  lines: FiringLineOut[];
}

export interface FiringOut {
  id: number;
  code: string;
  status: FiringStatus;
  scheduled_date: string | null;
  firing_date: string | null;
  notes: string | null;
  total_volume_cm3: string;
  occupancy_percentage: string;
  occupancy_factor: string;
  subtotal: string;
  total_cost: string;
  tax_percentage: string;
  tax_amount: string;
  total_with_tax: string;
  currency_code: string;
  currency_symbol: string;
  created_by_id: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  sessions: FiringSessionOut[];
  lines: FiringLineOut[];
}

export interface FiringSummaryOut {
  id: number;
  code: string;
  status: FiringStatus;
  scheduled_date: string | null;
  firing_date: string | null;
  total_volume_cm3: string;
  total_cost: string;
  line_count: number;
  session_count: number;
  created_at: string;
}

export interface FiringPage {
  items: FiringSummaryOut[];
  total: number;
  limit: number;
  offset: number;
}

export interface FiringFilters {
  search?: string;
  status?: FiringStatus;
  kiln_id?: number;
  firing_type?: FiringType;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

/**
 * Línea de una quema confirmada, tal y como la elige una cotización.
 *
 * Vista plana a propósito: el selector necesita el código de la hoja, la fecha
 * y el costo ya repartido, no las sesiones ni el resto de piezas.
 */
export interface ConfirmedFiringLineOut {
  id: number;
  firing_id: number;
  firing_code: string;
  firing_date: string | null;
  product_id: number | null;
  product_internal_reference: string | null;
  description: string;
  quantity: number;
  total_volume_cm3: string;
  allocated_cost: string;
}

export interface ConfirmedFiringLinePage {
  items: ConfirmedFiringLineOut[];
  total: number;
  limit: number;
  offset: number;
}
