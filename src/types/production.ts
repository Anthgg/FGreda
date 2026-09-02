/**
 * Contratos de las órdenes de producción (Fase 009I).
 *
 * La frontera del módulo, dicha una vez: **sólo arrancar mueve inventario.**
 * Crear la orden congela qué fabricar y no toca ni un gramo; completar y anular
 * tampoco. Ese reparto lo decide el backend, no estas pantallas.
 */

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
  | "INVALID_STOCK_LOCATION";

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
  quotation_item_id: number;
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
  quotation_id: number;
  quotation_code: string;
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
  lines: ProductionOrderLine[];
  readiness: ProductionReadiness;
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
  limit?: number;
  offset?: number;
}

export interface ProductionOrderCreateIn {
  quotation_id: number;
  /** Obligatoria y explícita: el backend no resuelve un almacén por defecto. */
  stock_location_id: number;
  idempotency_key?: string;
}
