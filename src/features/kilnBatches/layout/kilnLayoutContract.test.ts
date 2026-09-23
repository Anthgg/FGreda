import { describe, expect, it } from "vitest";
import type {
  KilnBatchLayout,
  KilnBatchLayoutLevel,
  KilnBatchLayoutLevelIn,
  KilnBatchLayoutPlacement,
  KilnBatchLayoutPlacementIn,
  KilnBatchLayoutSuggestion,
  KilnBatchLayoutUpdateIn,
  SuggestedPlacement,
  UnplacedPiece,
} from "@/types/kilnBatches";

describe("Kiln Layout DTO Contract Alignment (Fase 010M)", () => {
  it("conforms strictly to the backend schema for KilnBatchLayout", () => {
    // Validar en tiempo de compilación y ejecución que KilnBatchLayout tiene los campos canónicos del backend:
    // layout_id, batch_id, version, kiln_width_cm_snapshot, kiln_depth_cm_snapshot,
    // kiln_height_cm_snapshot, placed_quantity, pending_quantity, invalid_quantity,
    // levels, placements, updated_at
    const sampleLayout: KilnBatchLayout = {
      layout_id: 42,
      batch_id: 1,
      version: 1,
      kiln_width_cm_snapshot: "60.000000",
      kiln_depth_cm_snapshot: "50.000000",
      kiln_height_cm_snapshot: "80.000000",
      placed_quantity: 1,
      pending_quantity: 0,
      invalid_quantity: 0,
      updated_at: "2026-09-23T12:00:00Z",
      levels: [
        {
          id: 101,
          level_index: 0,
          name: "Base",
          z_cm: "0.000000",
          usable_height_cm: "25.000000",
          plate_label: "Placa 1",
          plate_thickness_cm: "1.500000",
        },
      ],
      placements: [
        {
          id: 501,
          batch_assignment_id: 10,
          group_index: 0,
          unit_index: 1,
          quantity: 1,
          level_index: 0,
          x_cm: "5.000000",
          y_cm: "5.000000",
          rotation_degrees: 0,
          piece_length_cm_snapshot: "9.000000",
          piece_width_cm_snapshot: "9.000000",
          piece_height_cm_snapshot: "10.000000",
          separation_cm_snapshot: "2.000000",
        },
      ],
    };

    const sampleLevel: KilnBatchLayoutLevel = sampleLayout.levels[0]!;
    const samplePlacement: KilnBatchLayoutPlacement = sampleLayout.placements[0]!;

    expect(sampleLayout.layout_id).toBe(42);
    expect(sampleLayout.invalid_quantity).toBe(0);
    expect(sampleLayout.updated_at).toBe("2026-09-23T12:00:00Z");
    expect(sampleLevel.id).toBe(101);
    expect(samplePlacement.id).toBe(501);
    // Verificar que 'id' no está presente a nivel de layout (usa layout_id como el backend)
    expect((sampleLayout as unknown as Record<string, unknown>).id).toBeUndefined();
  });

  it("distinguishes input schemas (without server id) from persisted schemas (with server id)", () => {
    const levelIn: KilnBatchLayoutLevelIn = {
      level_index: 0,
      name: "Nuevo nivel",
      z_cm: "0.000000",
      usable_height_cm: "20.000000",
      plate_label: null,
      plate_thickness_cm: null,
    };

    const placementIn: KilnBatchLayoutPlacementIn = {
      batch_assignment_id: 10,
      group_index: 0,
      unit_index: 1,
      quantity: 1,
      level_index: 0,
      x_cm: "5.000000",
      y_cm: "5.000000",
      rotation_degrees: 0,
    };

    const updatePayload: KilnBatchLayoutUpdateIn = {
      expected_version: 1,
      levels: [levelIn],
      placements: [placementIn],
      idempotency_key: "idem-key-test-123",
    };

    expect(updatePayload.expected_version).toBe(1);
    expect(updatePayload.levels).toHaveLength(1);
    expect(updatePayload.placements).toHaveLength(1);
    expect((levelIn as unknown as Record<string, unknown>).id).toBeUndefined();
    expect((placementIn as unknown as Record<string, unknown>).id).toBeUndefined();
  });

  it("handles nullable unit_index in suggested placements and unplaced pieces", () => {
    const suggested: SuggestedPlacement = {
      batch_assignment_id: 10,
      group_index: 0,
      unit_index: null,
      quantity: 1,
      level_index: 0,
      x_cm: "5.000000",
      y_cm: "5.000000",
      rotation_degrees: 0,
      piece_length_cm_snapshot: "9.000000",
      piece_width_cm_snapshot: "9.000000",
      piece_height_cm_snapshot: "10.000000",
      separation_cm_snapshot: "2.000000",
    };

    const unplaced: UnplacedPiece = {
      batch_assignment_id: 10,
      unit_index: null,
      quantity: 1,
      reason: "NO_SPACE_AVAILABLE",
    };

    const suggestion: KilnBatchLayoutSuggestion = {
      batch_id: 1,
      base_version: 1,
      total_pending: 1,
      suggested_count: 1,
      unplaced_count: 1,
      levels_used: [0],
      suggested_placements: [suggested],
      unplaced_pieces: [unplaced],
    };

    expect(suggested.unit_index).toBeNull();
    expect(unplaced.unit_index).toBeNull();
    expect(suggestion.suggested_placements[0]?.unit_index).toBeNull();
  });
});
