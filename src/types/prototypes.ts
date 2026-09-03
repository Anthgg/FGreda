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

export interface PrototypeMaterial {
  id: number;
  product_id: number;
  sort_order: number;
  product_name: string;
  product_internal_reference: string;
  quantity: string;
  uom_code: string;
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
  notes: string | null;
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
  quantity: string;
}

export interface PrototypeCreateInput {
  name: string;
  quantity: number;
  quotation_id?: number;
  product_id?: number;
  stock_location_id?: number;
  target_days?: number;
  notes?: string;
  materials: PrototypeMaterialInput[];
}

export type PrototypeUpdateInput = Partial<Omit<PrototypeCreateInput, "materials">>;

