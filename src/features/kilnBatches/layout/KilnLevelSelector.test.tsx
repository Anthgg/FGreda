import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { KilnLevelSelector } from "./KilnLevelSelector";
import type { KilnBatchLayoutLevel } from "@/types/kilnBatches";

const MOCK_LEVELS: KilnBatchLayoutLevel[] = [
  {
    level_index: 0,
    name: "Piso 1 - Base",
    z_cm: "0.000000",
    usable_height_cm: "25.000000",
    plate_label: "Placa A",
    plate_thickness_cm: "1.500000",
  },
  {
    level_index: 1,
    name: "Piso 2 - Superior",
    z_cm: "26.500000",
    usable_height_cm: "50.000000",
    plate_label: "Placa B",
    plate_thickness_cm: "1.500000",
  },
];

describe("KilnLevelSelector Accessibility & Semantics", () => {
  it("renders a valid WAI-ARIA tablist containing strictly tabs as direct children", () => {
    render(
      <KilnLevelSelector
        levels={MOCK_LEVELS}
        placements={[]}
        selectedLevelIndex={0}
        isReadOnly={false}
        onSelectLevel={vi.fn()}
        onEditLevel={vi.fn()}
        onDeleteLevel={vi.fn()}
      />,
    );

    const tablist = screen.getByRole("tablist", { name: "Niveles del horno" });
    expect(tablist).toBeInTheDocument();

    // Verify all children in tablist are role="tab"
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tablist.children.length).toBe(2);

    for (let i = 0; i < tablist.children.length; i++) {
      expect(tablist.children.item(i)?.getAttribute("role")).toBe("tab");
    }

    // Active tab has aria-selected="true"
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveAttribute("aria-controls", "kiln-level-panel");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
  });

  it("renders edit and delete action buttons outside the tablist with explicit accessible names", () => {
    render(
      <KilnLevelSelector
        levels={MOCK_LEVELS}
        placements={[]}
        selectedLevelIndex={0}
        isReadOnly={false}
        onSelectLevel={vi.fn()}
        onEditLevel={vi.fn()}
        onDeleteLevel={vi.fn()}
      />,
    );

    const tablist = screen.getByRole("tablist", { name: "Niveles del horno" });
    const editBtn = screen.getByRole("button", { name: "Editar nivel Piso 1 - Base" });
    const deleteBtn = screen.getByRole("button", { name: "Eliminar nivel Piso 1 - Base" });

    expect(editBtn).toBeInTheDocument();
    expect(deleteBtn).toBeInTheDocument();

    // Must be completely outside the tablist DOM tree
    expect(tablist.contains(editBtn)).toBe(false);
    expect(tablist.contains(deleteBtn)).toBe(false);

    // Target size classes
    expect(editBtn.className).toContain("min-w-[32px]");
    expect(editBtn.className).toContain("min-h-[32px]");
    expect(deleteBtn.className).toContain("min-w-[32px]");
    expect(deleteBtn.className).toContain("min-h-[32px]");
  });

  it("updates action accessible names and targets when another level is selected", () => {
    render(
      <KilnLevelSelector
        levels={MOCK_LEVELS}
        placements={[]}
        selectedLevelIndex={1}
        isReadOnly={false}
        onSelectLevel={vi.fn()}
        onEditLevel={vi.fn()}
        onDeleteLevel={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Editar nivel Piso 2 - Superior" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar nivel Piso 2 - Superior" })).toBeInTheDocument();
  });

  it("disables delete button when the active level has placed pieces", () => {
    render(
      <KilnLevelSelector
        levels={MOCK_LEVELS}
        placements={[{ level_index: 0 }]}
        selectedLevelIndex={0}
        isReadOnly={false}
        onSelectLevel={vi.fn()}
        onEditLevel={vi.fn()}
        onDeleteLevel={vi.fn()}
      />,
    );

    const deleteBtn = screen.getByRole("button", { name: "Eliminar nivel Piso 1 - Base" });
    expect(deleteBtn).toBeDisabled();
    expect(deleteBtn).toHaveAttribute("title", "Nivel con piezas no eliminable");
  });

  it("fires callbacks when tabs or action buttons are clicked", async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();
    const handleEdit = vi.fn();
    const handleDelete = vi.fn();

    render(
      <KilnLevelSelector
        levels={MOCK_LEVELS}
        placements={[]}
        selectedLevelIndex={0}
        isReadOnly={false}
        onSelectLevel={handleSelect}
        onEditLevel={handleEdit}
        onDeleteLevel={handleDelete}
      />,
    );

    // Select tab 1
    const tabs = screen.getAllByRole("tab");
    const secondTab = tabs[1];
    expect(secondTab).toBeDefined();
    await user.click(secondTab!);
    expect(handleSelect).toHaveBeenCalledWith(1);

    // Click edit
    const editBtn = screen.getByRole("button", { name: "Editar nivel Piso 1 - Base" });
    await user.click(editBtn);
    expect(handleEdit).toHaveBeenCalledWith(MOCK_LEVELS[0]);

    // Click delete
    const deleteBtn = screen.getByRole("button", { name: "Eliminar nivel Piso 1 - Base" });
    await user.click(deleteBtn);
    expect(handleDelete).toHaveBeenCalledWith(0);
  });

  it("does not render action buttons in read-only mode", () => {
    render(
      <KilnLevelSelector
        levels={MOCK_LEVELS}
        placements={[]}
        selectedLevelIndex={0}
        isReadOnly={true}
        onSelectLevel={vi.fn()}
        onEditLevel={vi.fn()}
        onDeleteLevel={vi.fn()}
      />,
    );

    expect(screen.queryByRole("group", { name: "Acciones del nivel seleccionado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editar nivel/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Eliminar nivel/ })).not.toBeInTheDocument();
  });
});
