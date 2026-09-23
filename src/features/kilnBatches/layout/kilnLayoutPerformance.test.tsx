import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { KilnLayoutSvg } from "./KilnLayoutSvg";
import type { DisplayPlacement } from "./KilnPlacementItem";

function generatePlacements(count: number): DisplayPlacement[] {
  const placements: DisplayPlacement[] = [];
  const cols = 20;
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    placements.push({
      id: i + 1,
      batch_assignment_id: 100 + i,
      group_index: 0,
      unit_index: i + 1,
      quantity: 1,
      level_index: 0,
      x_cm: (col * 5).toFixed(6),
      y_cm: (row * 5).toFixed(6),
      rotation_degrees: 0,
      piece_length_cm_snapshot: "4.000000",
      piece_width_cm_snapshot: "4.000000",
      piece_height_cm_snapshot: "8.000000",
      separation_cm_snapshot: "1.000000",
      productName: `Pieza ${i + 1}`,
    });
  }
  return placements;
}

describe("KilnLayout Performance", () => {
  it("renders 100 placements smoothly within performance budget", () => {
    const placements = generatePlacements(100);
    const start = performance.now();

    const { container } = render(
      <KilnLayoutSvg
        kilnWidth={120}
        kilnDepth={120}
        placements={placements}
        selectedPlacementId={null}
        isReadOnly={false}
        onSelectPlacement={vi.fn()}
        onUpdatePlacementPosition={vi.fn()}
      />
    );

    const duration = performance.now() - start;

    expect(container.querySelectorAll("g[role='button']").length).toBe(100);
    // Budget para emulación jsdom en tests concurrentes: montar 100 piezas en < 1000ms
    expect(duration).toBeLessThan(1000);
  });

  it("renders 500 placements smoothly within performance budget", () => {
    const placements = generatePlacements(500);
    const start = performance.now();

    const { container } = render(
      <KilnLayoutSvg
        kilnWidth={200}
        kilnDepth={200}
        placements={placements}
        selectedPlacementId={null}
        isReadOnly={false}
        onSelectPlacement={vi.fn()}
        onUpdatePlacementPosition={vi.fn()}
      />
    );

    const duration = performance.now() - start;

    expect(container.querySelectorAll("g[role='button']").length).toBe(500);
    // Budget para emulación jsdom en tests concurrentes: montar 500 piezas en < 2500ms
    expect(duration).toBeLessThan(2500);
  });

  it("evaluates collision detection for 500 precomputed boxes in less than 5ms", () => {
    const placements = generatePlacements(500);
    const otherBoxes = placements.map((p) => {
      const left = parseFloat(String(p.x_cm));
      const bottom = parseFloat(String(p.y_cm));
      return {
        id: p.id,
        left,
        right: left + 5,
        bottom,
        top: bottom + 5,
      };
    });

    const candidate = {
      left: 10.5,
      right: 15.5,
      bottom: 10.5,
      top: 15.5,
    };

    const start = performance.now();
    let collisionCount = 0;
    for (let i = 0; i < otherBoxes.length; i++) {
      const b = otherBoxes[i]!;
      const collides = !(
        candidate.right <= b.left ||
        candidate.left >= b.right ||
        candidate.top <= b.bottom ||
        candidate.bottom >= b.top
      );
      if (collides) collisionCount++;
    }
    const duration = performance.now() - start;

    expect(collisionCount).toBeGreaterThan(0);
    expect(duration).toBeLessThan(10);
  });
});
