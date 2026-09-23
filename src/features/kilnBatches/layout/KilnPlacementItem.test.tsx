import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { KilnPlacementItem, type DisplayPlacement } from "./KilnPlacementItem";

const MOCK_PLACEMENT_1: DisplayPlacement = {
  id: 1,
  batch_assignment_id: 101,
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
  orderLabel: "OP #5",
  productName: "Taza de café",
};

const MOCK_PLACEMENT_2: DisplayPlacement = {
  id: 2,
  batch_assignment_id: 102,
  group_index: 0,
  unit_index: 1,
  quantity: 1,
  level_index: 0,
  x_cm: "20.000000",
  y_cm: "5.000000",
  rotation_degrees: 90,
  piece_length_cm_snapshot: "12.000000",
  piece_width_cm_snapshot: "12.000000",
  piece_height_cm_snapshot: "8.000000",
  separation_cm_snapshot: "2.000000",
  orderLabel: "OP #6",
  productName: "Plato hondo",
};

describe("KilnPlacementItem Accessibility (WCAG 2.5.3 Label in Name)", () => {
  it("accessible name contains the visible label (OP #5) and product name", () => {
    render(
      <svg>
        <KilnPlacementItem
          placement={MOCK_PLACEMENT_1}
          kilnDepth={50}
          isSelected={false}
          isReadOnly={false}
          onSelect={vi.fn()}
        />
      </svg>,
    );

    // Visible text in SVG is "OP #5"
    expect(screen.getByText("OP #5")).toBeInTheDocument();

    // Accessible button accessible name must contain "OP #5" and "Taza de café"
    const buttonByOrder = screen.getByRole("button", { name: /OP #5/ });
    expect(buttonByOrder).toBeInTheDocument();

    const buttonByProduct = screen.getByRole("button", { name: /Taza de café/i });
    expect(buttonByProduct).toBe(buttonByOrder);

    // Verify aria-labelledby and aria-describedby
    const labelledby = buttonByOrder.getAttribute("aria-labelledby");
    const describedby = buttonByOrder.getAttribute("aria-describedby");
    expect(labelledby).toBeTruthy();
    expect(describedby).toBeTruthy();

    // Verify description contains dimensions without commercial pricing data
    const descElement = document.getElementById(describedby!);
    expect(descElement).toBeInTheDocument();
    expect(descElement?.textContent).toContain("Taza de café");
    expect(descElement?.textContent).not.toMatch(/precio|costo|margen|igv|\$|s\//i);
  });

  it("generates unique IDs across multiple placement items", () => {
    render(
      <svg>
        <KilnPlacementItem
          placement={MOCK_PLACEMENT_1}
          kilnDepth={50}
          isSelected={false}
          isReadOnly={false}
          onSelect={vi.fn()}
        />
        <KilnPlacementItem
          placement={MOCK_PLACEMENT_2}
          kilnDepth={50}
          isSelected={false}
          isReadOnly={false}
          onSelect={vi.fn()}
        />
      </svg>,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);

    const labelledby1 = buttons[0]?.getAttribute("aria-labelledby");
    const labelledby2 = buttons[1]?.getAttribute("aria-labelledby");
    const describedby1 = buttons[0]?.getAttribute("aria-describedby");
    const describedby2 = buttons[1]?.getAttribute("aria-describedby");

    expect(labelledby1).not.toBe(labelledby2);
    expect(describedby1).not.toBe(describedby2);
  });

  it("handles selection on click and keyboard interaction", async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();

    render(
      <svg>
        <KilnPlacementItem
          placement={MOCK_PLACEMENT_1}
          kilnDepth={50}
          isSelected={false}
          isReadOnly={false}
          onSelect={handleSelect}
        />
      </svg>,
    );

    const button = screen.getByRole("button", { name: /OP #5/ });
    await user.click(button);
    expect(handleSelect).toHaveBeenCalledWith(MOCK_PLACEMENT_1);

    button.focus();
    await user.keyboard("{Enter}");
    expect(handleSelect).toHaveBeenCalledTimes(2);
  });
});
