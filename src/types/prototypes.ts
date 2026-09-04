export type PrototypeStatus = "CREATED" | "STARTED" | "COMPLETED" | "CANCELLED";
export type PrototypeApproval = "PENDING" | "APPROVED" | "REJECTED";

export type PrototypeReadinessCode =
  | "INVALID_STATE"
  | "NO_QUOTATION"
  | "QUOTATION_UNPAID"
  | "NO_STOCK_LOCATION"
  | "NO_MATERIALS"
  | "STOCK_MISSING"
  | "INSUFFICIENT_STOCK";

export interface PrototypeIssue {
  code: PrototypeReadinessCode;
  product_id: number | null;
  product_name: string | null;
  required_quantity: string | null;
  available_quantity: string | null;
  uom: string | null;
}

export interface PrototypeReadiness {
  ready: boolean;
  issues: PrototypeIssue[];
}

/** Qué papel juega el material en la pieza. Independiente de la etapa. */
export type PrototypeMaterialRole = "BODY" | "GLAZE" | "OTHER";

/** En qué momento del trabajo se gasta. Independiente del rol. */
export type PrototypeMaterialStage = "PREPARATION" | "FIRING" | "LIQUID_TEST" | "ADJUSTMENT";

export interface PrototypeMaterial {
  id: number;
  product_id: number;
  sort_order: number;
  product_name: string;
  product_internal_reference: string;
  /**
   * Lo AUTORIZADO a gastar. Se sigue llamando `quantity` en el contrato
   * público por compatibilidad; `quantity_planned` es el mismo valor con el
   * nombre que no miente.
   */
  quantity: string;
  quantity_planned: string;
  /**
   * Lo que de verdad salió del almacén. Nulo hasta arrancar. **Sólo lectura**:
   * lo escribe el backend junto al movimiento de inventario, y de aquí sale el
   * material base de la cotización final.
   */
  quantity_actual: string | null;
  uom_code: string;
  material_role: PrototypeMaterialRole | null;
  stage: PrototypeMaterialStage | null;
}

/** Un criterio evaluado de la muestra. El cuaderno del taller usa varios. */
export interface PrototypeEvaluationCriterion {
  criterion: string;
  result?: string | null;
  note?: string | null;
  responsible?: string | null;
  requires_adjustment?: boolean | null;
  new_sample?: boolean | null;
}

/**
 * La ficha del taller, estructurada.
 *
 * Nombres y unidades salen del cuaderno real: el peso es «Peso estimado g» y
 * las medidas son centímetros, así que la unidad va en el nombre del campo y
 * no hay un campo de unidad que alguien pueda contradecir.
 */
export interface PrototypeTechnicalSpecifications {
  responsible?: string | null;
  priority?: string | null;
  width_cm?: string | null;
  height_cm?: string | null;
  length_cm?: string | null;
  depth_cm?: string | null;
  estimated_weight_g?: string | null;
  technique?: string | null;
  finish?: string | null;
  mold?: string | null;
  color?: string | null;
  reference?: string | null;
  technical_notes?: string | null;
  requires_new_sample?: boolean | null;
  evaluation?: PrototypeEvaluationCriterion[];
}

/** Una cotización nacida de la muestra. */
export interface PrototypeOriginQuotation {
  id: number;
  code: string;
  status: string;
}

export interface PrototypeSummary {
  id: number;
  code: string;
  name: string;
  status: PrototypeStatus;
  approval: PrototypeApproval;
  quotation_id: number | null;
  quotation_code: string | null;
  product_id: number | null;
  stock_location_id: number | null;
  quantity: number;
  target_days: number | null;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  decided_at: string | null;
  supersedes_prototype_id: number | null;
  material_count: number;
}

export interface Prototype extends PrototypeSummary {
  /** Observaciones humanas. Ya no es autoridad de ningún dato técnico. */
  notes: string | null;
  /** Nula en las muestras anteriores a 0022, y ese hueco no se rellena. */
  technical_specifications: PrototypeTechnicalSpecifications | null;
  /**
   * De qué cotizaciones fue origen esta muestra. Ojo: es la relación CONTRARIA
   * a `quotation_code`, que es la cotización que pidió la muestra.
   */
  origin_quotation_ids: number[];
  origin_quotations?: PrototypeOriginQuotation[];
  quotation_payment_status: "UNPAID" | "PAID" | null;
  materials: PrototypeMaterial[];
  readiness: PrototypeReadiness;
}

export interface PrototypePage {
  items: PrototypeSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface PrototypeFilters {
  status?: PrototypeStatus;
  approval?: PrototypeApproval;
  quotation?: number;
  limit?: number;
  offset?: number;
}

export interface PrototypeMaterialInput {
  product_id: number;
  /** La cantidad PREVISTA. La real la escribe el arranque, nunca el cliente. */
  quantity: string;
  material_role?: PrototypeMaterialRole | null;
  stage?: PrototypeMaterialStage | null;
}

export interface PrototypeCreateInput {
  name: string;
  quantity: number;
  quotation_id?: number;
  product_id?: number;
  stock_location_id?: number;
  target_days?: number;
  notes?: string;
  technical_specifications?: PrototypeTechnicalSpecifications;
  materials: PrototypeMaterialInput[];
}

export type PrototypeUpdateInput = Partial<Omit<PrototypeCreateInput, "materials">>;

