/**
 * Contratos de las órdenes de producción (Fase 009I).
 *
 * La frontera del módulo, dicha una vez: **sólo arrancar mueve inventario.**
 * Crear la orden congela qué fabricar y no toca ni un gramo; completar y anular
 * tampoco. Ese reparto lo decide el backend, no estas pantallas.
 */

import type { QuotationPaymentStatus } from "@/types/quotations";

export type ProductionOrderStatus = "CREATED" | "STARTED" | "COMPLETED" | "CANCELLED";

/**
 * Por qué una orden todavía no puede arrancar.
 *
 * Son códigos de dominio que emite el backend; el texto lo pone el frontend.
 * Así corregir una errata de la interfaz no obliga a desplegar el backend.
 */
export type ProductionReadinessCode =
  | "MISSING_RECIPE"
  | "MISSING_MATERIAL_GRAMS"
  | "MISSING_QUANTITY"
  | "PREPARED_PRODUCT_NOT_RESOLVABLE"
  | "PREPARED_STOCK_MISSING"
  | "INSUFFICIENT_STOCK"
  | "UNSUPPORTED_UOM_CONVERSION"
  | "INVALID_STOCK_LOCATION"
  // Fase 009K.4. Sólo aparecen en órdenes que fabrican una muestra.
  | "PROTOTYPE_MISSING"
  | "MISSING_MATERIAL_LINES"
  | "PROTOTYPE_QUOTATION_NOT_PAID";

/**
 * De dónde viene una orden. Fase 009K.4.
 *
 * Lo dice el backend en un campo propio. Deducirlo de qué identificador venga
 * relleno convertiría una regla del dominio en una heurística de pantalla, y la
 * pantalla acabaría discrepando de la base el día que cambiara cualquiera de
 * las dos.
 */
export type ProductionOrderOrigin = "QUOTATION" | "PROTOTYPE" | "V2_QUOTATION";

export interface ReadinessIssue {
  code: ProductionReadinessCode;
  /**
   * Nulo en los problemas de existencia, que no son de una línea sino del
   * conjunto: dos líneas que piden el mismo preparado comparten un único saldo
   * y un único veredicto.
   */
  production_order_line_id: number | null;
  quotation_item_id: number | null;
  prepared_product_id: number | null;
  prepared_product_name: string | null;
  /** Decimales como texto, como en todo el proyecto. Nunca se suman aquí. */
  required_quantity: string | null;
  available_quantity: string | null;
  uom: string | null;
}

export interface ProductionReadiness {
  ready: boolean;
  issues: ReadinessIssue[];
}

export interface ProductionOrderLine {
  id: number;
  /** Nulo en las órdenes que fabrican una muestra: no hay ítem que copiar. */
  quotation_item_id: number | null;
  sort_order: number;
  product_id: number;
  product_name: string;
  product_internal_reference: string;
  quantity: number | null;
  width: string | null;
  height: string | null;
  length: string | null;
  depth: string | null;
  recipe_id: number | null;
  recipe_version_id: number | null;
  material_grams_per_piece: string | null;
  prepared_product_id: number | null;
  prepared_product_name: string | null;
  prepared_product_internal_reference: string | null;
  /** Lo que pide la receta, en gramos. Congelado al crear la orden. */
  required_material_quantity: string | null;
  required_material_uom: string | null;
}

export interface ProductionOrderSummary {
  id: number;
  code: string;
  status: ProductionOrderStatus;
  origin_type: ProductionOrderOrigin;
  /** Nulos cuando la orden viene de una muestra. */
  quotation_id: number | null;
  quotation_code: string | null;
  /** Nulos cuando la orden viene de una cotización. */
  prototype_id: number | null;
  prototype_code: string | null;
  /** La cotización de prototipo que autorizó la muestra, si la hubo. */
  prototype_quotation_id: number | null;
  prototype_quotation_code: string | null;
  /**
   * Fase 010I. La cotización V2 de la orden. Campos PROPIOS: el id de una V2 y
   * el de una Legacy son espacios distintos.
   *
   * Opcionales porque un backend anterior a 010I no los manda.
   */
  v2_quotation_id?: number | null;
  v2_quotation_code?: string | null;
  /** Fase 010I. El cliente CONGELADO en la cotización de origen. Nulo en muestras. */
  customer_name?: string | null;
  /** Fase 010I. «20 × Taza, 5 × Plato», armado por el backend. */
  pieces_summary?: string | null;
  stock_location_id: number;
  stock_location_name: string;
  line_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
}

export interface ProductionOrder extends ProductionOrderSummary {
  /** Identificador opaco del QR. Ni el id ni el código. */
  qr_token: string;
  quotation_customer_name: string | null;
  /**
   * Fase 009H.1. Si la cotización de origen consta cobrada.
   *
   * Viaja para poder DECIR por qué no se puede arrancar, no para decidirlo: el
   * backend rechaza el arranque aunque el botón llegara a aparecer.
   *
   * `null` significa «no consta» —lo anterior a 009H—, que no es «impagada»
   * pero tampoco sirve para arrancar: hace falta `PAID`.
   */
  quotation_payment_status: QuotationPaymentStatus | null;
  lines: ProductionOrderLine[];
  readiness: ProductionReadiness;
  /**
   * Fase 010I, decisión D3. Las clases de material que la cotización V2
   * planificó y que aún no tienen ningún consumo real. Mientras no esté vacía,
   * la orden no puede finalizar. La calcula el backend: aquí sólo se muestra.
   */
  pending_consumption_kinds?: ProductionConsumptionKind[];
  /** Fase 010I. Las piezas de la cotización V2 congelada, sin importes. */
  v2_pieces?: V2ProductionPiece[];
}

export interface ProductionOrderPage {
  items: ProductionOrderSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProductionOrderFilters {
  status?: ProductionOrderStatus;
  quotation?: number;
  /** Fase 010I. Filtro PROPIO: no se reutiliza `quotation`. */
  v2_quotation_id?: number;
  limit?: number;
  offset?: number;
}

export interface ProductionOrderCreateIn {
  /** Uno de los tres orígenes, nunca dos ni ninguno. Lo impone también la base. */
  quotation_id?: number;
  /** Fase 010I. Una cotización V2 ya enviada a producción. */
  v2_quotation_id?: number;
  /**
   * Fase 009K.4. El origen de muestra existe para las ITERACIONES: una muestra
   * sucesora no tiene cotización de prototipo propia que cobrar, y sin esta
   * puerta no podría fabricarse por el camino único.
   */
  prototype_id?: number;
  /** Obligatoria y explícita: el backend no resuelve un almacén por defecto. */
  stock_location_id: number;
  idempotency_key?: string;
}

// ---------------------------------------------------------------------------
// Fase 010I — ejecución real de una orden V2
// ---------------------------------------------------------------------------

/**
 * Una pieza de la cotización V2 de la orden, tal como se congeló.
 *
 * Sólo lo necesario para fabricar. **Ningún importe**: el backend no los manda
 * y esta interfaz no tiene dónde ponerlos.
 */
export interface V2ProductionPiece {
  /** El id que se manda como `v2_quotation_product_id` al imputar un consumo. */
  id: number;
  sort_order: number;
  product_name: string;
  quantity: number;
  length_cm: string | null;
  width_cm: string | null;
  height_cm: string | null;
  body_material_id: number | null;
  body_material_name: string | null;
  body_unit_weight: string | null;
  body_total_weight: string;
  body_uom: string | null;
  requires_glaze: boolean;
  glaze_material_id: number | null;
  glaze_material_name: string | null;
  glaze_is_reference: boolean;
  glaze_total_weight: string;
}

export type ProductionConsumptionKind = "BODY" | "GLAZE" | "OTHER";

export interface ProductionConsumption {
  id: number;
  production_order_id: number;
  v2_quotation_product_id: number | null;
  product_id: number;
  product_name: string;
  product_internal_reference: string;
  stock_location_id: number;
  stock_location_name: string;
  kind: ProductionConsumptionKind;
  quantity: string;
  uom_code: string;
  /** Saldo del material en ese almacén justo después de este consumo. */
  balance_after: string;
  stock_movement_id: number;
  note: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface ProductionConsumptionPage {
  items: ProductionConsumption[];
  total: number;
}

export interface ProductionConsumptionCreateIn {
  product_id: number;
  /** Opcional: por defecto el almacén de la orden. */
  stock_location_id?: number;
  /** Positiva, en la unidad base del material. Texto para no perder decimales. */
  quantity: string;
  kind: ProductionConsumptionKind;
  v2_quotation_product_id?: number;
  note?: string;
  /** Obligatoria: una por intención de consumo, la misma en cada reintento. */
  idempotency_key: string;
}

export type ProductionNoteKind = "NOTE" | "FIRING_NOTE";
export type FiringKind = "LOW" | "HIGH";

export interface ProductionNote {
  id: number;
  production_order_id: number;
  kind: ProductionNoteKind;
  body: string | null;
  kiln_id: number | null;
  kiln_name: string | null;
  firing_type: FiringKind | null;
  occurred_at: string;
  created_by_name: string | null;
  created_at: string;
}

export interface ProductionNoteCreateIn {
  kind: ProductionNoteKind;
  body?: string;
  kiln_id?: number;
  firing_type?: FiringKind;
  /** Obligatoria, con zona: cuándo OCURRIÓ, no cuándo se anota. */
  occurred_at: string;
  idempotency_key: string;
}

/** Hoy el único canal. Es el DECLARADO: el sistema no envía nada. */
export type ProductionCommunicationChannel = "WHATSAPP";

export interface ProductionCommunication {
  id: number;
  production_order_id: number;
  channel: ProductionCommunicationChannel;
  message: string;
  sent_at: string;
  sent_by_name: string | null;
  created_at: string;
}

/**
 * Registrar un aviso YA hecho. Sin autor: lo pone la sesión, y el backend
 * rechaza cualquier campo de más.
 */
export interface ProductionCommunicationCreateIn {
  channel: ProductionCommunicationChannel;
  message: string;
  sent_at: string;
  idempotency_key: string;
}

export type ProductionTimelineEventType =
  | "STATUS"
  | "CONSUMPTION"
  | "NOTE"
  | "FIRING_NOTE"
  | "COMMUNICATION";

export interface ProductionTimelineEvent {
  type: ProductionTimelineEventType;
  occurred_at: string;
  actor_name: string | null;
  status: ProductionOrderStatus | null;
  consumption: ProductionConsumption | null;
  note: ProductionNote | null;
  communication: ProductionCommunication | null;
}

export interface ProductionTimeline {
  items: ProductionTimelineEvent[];
}
