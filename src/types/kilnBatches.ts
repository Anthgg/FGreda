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
  kiln_width_cm_snapshot?: string | null;
  kiln_depth_cm_snapshot?: string | null;
  kiln_height_cm_snapshot?: string | null;
  usable_width_cm?: string | null;
  usable_depth_cm?: string | null;
  usable_height_cm?: string | null;
  kiln?: {
    usable_width_cm?: string | null;
    usable_depth_cm?: string | null;
    usable_height_cm?: string | null;
  } | null;
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

export interface KilnBatchLayoutLevel {
  level_index: number;
  name: string | null;
  z_cm: string;
  usable_height_cm: string;
  plate_label: string | null;
  plate_thickness_cm: string | null;
}

export interface KilnBatchLayoutPlacement {
  id?: number;
  batch_assignment_id: number;
  group_index: number;
  unit_index: number | null;
  quantity: number;
  level_index: number;
  x_cm: string;
  y_cm: string;
  rotation_degrees: number;
  piece_length_cm_snapshot: string;
  piece_width_cm_snapshot: string;
  piece_height_cm_snapshot: string;
  separation_cm_snapshot: string;
}

export interface KilnBatchLayout {
  id: number;
  batch_id: number;
  version: number;
  kiln_width_cm_snapshot: string;
  kiln_depth_cm_snapshot: string;
  kiln_height_cm_snapshot: string;
  placed_quantity: number;
  pending_quantity: number;
  levels: KilnBatchLayoutLevel[];
  placements: KilnBatchLayoutPlacement[];
}

export interface KilnBatchLayoutLevelIn {
  level_index: number;
  name?: string | null;
  z_cm: string;
  usable_height_cm: string;
  plate_label?: string | null;
  plate_thickness_cm?: string | null;
}

export interface KilnBatchLayoutPlacementIn {
  batch_assignment_id: number;
  group_index: number;
  unit_index?: number | null;
  quantity: number;
  level_index: number;
  x_cm: string;
  y_cm: string;
  rotation_degrees: number;
}

export interface KilnBatchLayoutUpdateIn {
  expected_version: number;
  idempotency_key?: string | null;
  levels: KilnBatchLayoutLevelIn[];
  placements: KilnBatchLayoutPlacementIn[];
}

export interface KilnBatchLayoutSuggestIn {
  expected_version?: number;
  levels?: KilnBatchLayoutLevelIn[];
}

export interface SuggestedPlacement {
  batch_assignment_id: number;
  group_index: number;
  unit_index: number;
  quantity: number;
  level_index: number;
  x_cm: string;
  y_cm: string;
  rotation_degrees: number;
  piece_length_cm_snapshot: string;
  piece_width_cm_snapshot: string;
  piece_height_cm_snapshot: string;
  separation_cm_snapshot: string;
}

export interface UnplacedPiece {
  batch_assignment_id: number;
  unit_index: number;
  quantity: number;
  reason: string;
}

export interface KilnBatchLayoutSuggestion {
  batch_id: number;
  base_version: number;
  total_pending: number;
  suggested_count: number;
  unplaced_count: number;
  levels_used: number[];
  suggested_placements: SuggestedPlacement[];
  unplaced_pieces: UnplacedPiece[];
}
