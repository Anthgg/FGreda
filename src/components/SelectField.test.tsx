import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { SelectField } from "@/components/SelectField";

const OPTIONS = [
  { value: "opt-1", label: "Opción Uno" },
  { value: "opt-2", label: "Opción Dos" },
  { value: "opt-3", label: "Opción Tres" },
];

function TestSelect({
  searchable = false,
  disabled = false,
  defaultValue = "opt-1",
}: {
  searchable?: boolean;
  disabled?: boolean;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <SelectField
      label="Selector de prueba"
      value={value}
      options={OPTIONS}
      onChange={setValue}
      searchable={searchable}
      disabled={disabled}
      requirement="required"
      searchPlaceholder="Buscar opciones..."
    />
  );
}

describe("SelectField (React Controlled Component)", () => {
  it("renderiza con el valor seleccionado y la etiqueta", () => {
    render(<TestSelect defaultValue="opt-2" />);

    const trigger = screen.getByRole("combobox", { name: /selector de prueba/i });
    expect(trigger).toHaveTextContent("Opción Dos");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("* Obligatorio")).toBeInTheDocument();
  });

  it("abre el dropdown al hacer click y muestra las opciones", async () => {
    const user = userEvent.setup();
    render(<TestSelect />);

    const trigger = screen.getByRole("combobox", { name: /selector de prueba/i });
    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("permite seleccionar una opción y actualiza el valor", async () => {
    const user = userEvent.setup();
    render(<TestSelect defaultValue="opt-1" />);

    const trigger = screen.getByRole("combobox", { name: /selector de prueba/i });
    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: "Opción Tres" }));

    expect(trigger).toHaveTextContent("Opción Tres");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("soporta navegación por teclado (Flechas, Enter, Escape)", async () => {
    const user = userEvent.setup();
    render(<TestSelect defaultValue="opt-1" />);

    const trigger = screen.getByRole("combobox", { name: /selector de prueba/i });
    trigger.focus();

    // Abrir con ArrowDown
    await user.keyboard("{ArrowDown}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    // Navegar a Opción Dos y seleccionar con Enter
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    expect(trigger).toHaveTextContent("Opción Dos");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    // Abrir de nuevo y cerrar con Escape
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("permite filtrar opciones en modo búsqueda (Combobox)", async () => {
    const user = userEvent.setup();
    render(<TestSelect searchable={true} />);

    const trigger = screen.getByRole("combobox", { name: /selector de prueba/i });
    await user.click(trigger);

    const searchInput = screen.getByPlaceholderText("Buscar opciones...");
    await user.type(searchInput, "Tres");

    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: "Opción Tres" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Opción Uno" })).not.toBeInTheDocument();
  });

  it("no abre el dropdown cuando está deshabilitado", async () => {
    const user = userEvent.setup();
    render(<TestSelect disabled={true} />);

    const trigger = screen.getByRole("combobox", { name: /selector de prueba/i });
    expect(trigger).toBeDisabled();

    await user.click(trigger);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
