/**
 * Contratos de los maestros de Fase 3.
 *
 * Reflejan lo que devuelve BGreda. El frontend no deriva reglas de negocio a
 * partir de ellos: los muestra y los reenvia. Los importes y cantidades viajan
 * como texto para no perder precision al pasar por `number`.
 */

export type ProductType =
  | "RAW_MATERIAL"
  | "PREPARED_MATERIAL"
  | "FINISHED_PRODUCT"
  | "SERVICE";

export type PartnerRole = "CLIENT" | "SUPPLIER" | "BOTH";

export type DocumentType = "RUC" | "DNI" | "CE" | "PASSPORT" | "OTHER";

export interface ProductCategory {
  id: number;
  name: string;
  parent_id: number | null;
  display_path: string;
  active: boolean;
}

export interface PosCategory {
  id: number;
  name: string;
  parent_id: number | null;
  active: boolean;
}

export interface UnitOfMeasure {
  code: string;
  name: string;
  symbol: string;
  dimension: "MASS" | "COUNT";
  factor_to_base: string;
  is_base: boolean;
  active: boolean;
}

export interface Product {
  id: number;
  internal_reference: string;
  name: string;
  product_type: ProductType;
  product_category_id: number;
  product_category_path: string | null;
  pos_category_id: number | null;
  pos_category_name: string | null;
  base_uom_code: string | null;
  purchase_uom_code: string | null;
  /** Decimal como texto: NUMERIC(24,12) no cabe en un `number` sin perder cola. */
  cost: string | null;
  sale_price: string | null;
  sale_tax_rate: string | null;
  purchase_tax_rate: string | null;
  sellable: boolean;
  purchasable: boolean;
  available_in_pos: boolean;
  active: boolean;
  notes: string | null;
}

export type ProductInput = Omit<
  Product,
  "id" | "product_category_path" | "pos_category_name"
>;

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProductFilters {
  search?: string;
  category_id?: number;
  product_type?: ProductType;
  active?: boolean;
  sellable?: boolean;
  purchasable?: boolean;
  limit?: number;
  offset?: number;
}

export interface Partner {
  id: number;
  name: string;
  role: PartnerRole;
  document_type: DocumentType | null;
  document_number: string | null;
  address: string | null;
  reference: string | null;
  ubigeo_code: string | null;
  district: string | null;
  province: string | null;
  department: string | null;
  country: string | null;
  email: string | null;
  mobile: string | null;
  phone: string | null;
  active: boolean;
  notes: string | null;
}

export type PartnerInput = Omit<
  Partner,
  "id" | "district" | "province" | "department" | "country"
>;

export interface PartnerFilters {
  search?: string;
  role?: PartnerRole;
  document_type?: DocumentType;
  active?: boolean;
  limit?: number;
  offset?: number;
}

export interface StockLocation {
  id: number;
  name: string;
  active: boolean;
}

export interface StockBalance {
  product_id: number;
  internal_reference: string;
  product_name: string;
  location_id: number;
  location_name: string;
  uom_code: string | null;
  quantity: string;
}

export type MovementType = "INITIAL_IMPORT" | "ADJUSTMENT" | "IN" | "OUT";

export interface StockMovement {
  id: number;
  product_id: number;
  internal_reference: string;
  product_name: string;
  location_id: number;
  location_name: string;
  movement_type: MovementType;
  quantity: string;
  balance_after: string;
  uom_code: string;
  reason: string | null;
  import_batch_id: number | null;
  created_by_name: string | null;
  created_at: string;
}

export interface StockAdjustmentInput {
  product_id: number;
  location_id: number;
  quantity: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Importador
// ---------------------------------------------------------------------------
export type ImportStatus =
  | "UPLOADED"
  | "ANALYZED"
  | "READY"
  | "COMMITTED"
  | "FAILED"
  | "CANCELLED";

export type ImportEntity =
  | "PRODUCT_CATEGORY"
  | "POS_CATEGORY"
  | "UNIT"
  | "PRODUCT"
  | "PARTNER"
  | "LOCATION"
  | "STOCK"
  | "RECIPE";

export type ImportAction = "CREATE" | "UPDATE" | "SKIP" | "ERROR";

export type ImportRowStatus =
  | "READY"
  | "REVIEW_REQUIRED"
  | "RESOLVED"
  | "BLOCKED"
  | "COMMITTED";

export interface SheetAnalysis {
  name: string;
  rows: number;
  columns: number;
  headers: string[];
  entity: ImportEntity | null;
  detected: number;
  warnings: string[];
}

export interface ImportSummary {
  creates: number;
  updates: number;
  skips: number;
  errors: number;
  warnings: number;
  review_required: number;
  by_entity: Record<string, Record<string, number>>;
  sheets: SheetAnalysis[];
  recipes_detected: number;
  recipe_lines_detected: number;
  recipes_imported: number;
  duplicate_file: boolean;
  duplicate_of_batch_id: number | null;
}

export interface ImportBatch {
  id: number;
  filename: string;
  file_hash: string;
  file_size: number;
  status: ImportStatus;
  summary: ImportSummary;
  error_message: string | null;
  created_by_name: string | null;
  created_at: string;
  analyzed_at: string | null;
  confirmed_at: string | null;
  completed_at: string | null;
}

export interface ImportIssue {
  code: string;
  message: string;
  [key: string]: unknown;
}

export interface ImportCandidate {
  type: string;
  label: string;
  product_id?: number;
  reference?: string;
  code?: string;
}

export interface ImportRow {
  id: number;
  entity: ImportEntity;
  sheet_name: string;
  source_row: number;
  raw: Record<string, unknown>;
  normalized: Record<string, unknown>;
  action: ImportAction;
  status: ImportRowStatus;
  errors: ImportIssue[];
  warnings: ImportIssue[];
  candidates: ImportCandidate[];
  resolution: Record<string, unknown> | null;
  target_id: string | null;
}

export interface ImportPreview {
  batch: ImportBatch;
  items: ImportRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface RowResolution {
  row_id: number;
  action?: "RESOLVE" | "SKIP";
  product_id?: number;
  partner_role?: PartnerRole;
  document_number?: string;
  ubigeo_code?: string;
  accept_suggestion?: boolean;
}

export interface ImportCommitResult {
  batch: ImportBatch;
  by_entity: Record<string, { created: number; updated: number; skipped: number }>;
  total_created: number;
  total_updated: number;
  total_skipped: number;
}
