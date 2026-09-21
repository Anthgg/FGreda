export type FiringType = "LOW" | "HIGH";
export type KilnBatchStatus = "PLANNED" | "STARTED" | "COMPLETED" | "CANCELLED";
export type KilnBatchSourceKind = "V2_QUOTATION" | "FIRING_V2" | "INTERNAL";
export type V2FiringMode = "SHARED" | "EXCLUSIVE";

export interface KilnBatchAssignment {
  id: number;
  batch_id: number;
  source_kind: KilnBatchSourceKind;
  production_order_id: number | null;
  internal_load_id: number | null;
  line_id: number;
  product_name: string;
  quantity: number;
  unit_volume_cm3: string;
  assigned_volume_cm3: string;
  firing_mode: V2FiringMode;
}

export interface KilnBatch {
  id: number;
  code: string;
  kiln_id: number;
  kiln_name_snapshot: string;
  firing_type: FiringType;
  scheduled_date: string;
  status: KilnBatchStatus;
  capacity_snapshot_cm3: string;
  assigned_volume_cm3: string;
  occupancy_percent: string;
  available_percent: string;
  available_cm3: string;
  exclusive: boolean;
  version: number;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  assignments: KilnBatchAssignment[];
}

export interface KilnBatchPage {
  items: KilnBatch[];
  total: number;
  limit: number;
  offset: number;
}

export interface KilnBatchFilters {
  kiln_id?: number;
  firing_type?: FiringType;
  status?: KilnBatchStatus;
  date_from?: string;
  date_to?: string;
  source_kind?: KilnBatchSourceKind;
  limit?: number;
  offset?: number;
}

export interface KilnBatchCreateIn {
  kiln_id: number;
  firing_type: FiringType;
  scheduled_date: string;
  notes?: string | null;
  idempotency_key?: string;
}

export interface KilnBatchAssignItemIn {
  line_id: number;
  quantity: number;
}

export interface KilnBatchAssignmentCreateIn {
  production_order_id?: number;
  internal_load_id?: number;
  items: KilnBatchAssignItemIn[];
  expected_version?: number;
  idempotency_key?: string;
}

export interface KilnBatchSuggestion {
  batch_id: number;
  kiln_id: number;
  kiln_name: string;
  scheduled_date: string;
  occupancy_percent: string;
  available_percent: string;
  available_cm3: string;
  covers_all: boolean;
  covered_percent: string;
}

export interface FiringPlanLine {
  line_id: number;
  product_name: string;
  quantity: number;
  unit_volume_cm3: string;
  required_low: number | null;
  assigned_low: number | null;
  remaining_low: number | null;
  required_high: number | null;
  assigned_high: number | null;
  remaining_high: number | null;
}

export interface FiringPlan {
  source_kind: KilnBatchSourceKind;
  production_order_id: number | null;
  internal_load_id: number | null;
  code: string;
  origin_code: string | null;
  customer_name: string | null;
  firing_mode: V2FiringMode;
  needs_low: boolean;
  needs_high: boolean;
  glaze_required: boolean;
  open: boolean;
  lines: FiringPlanLine[];
  batches: KilnBatch[];
}
