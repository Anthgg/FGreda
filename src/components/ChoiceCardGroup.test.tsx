import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ChoiceCardGroup } from "@/components/ChoiceCardGroup";
import type { ChoiceCardOption } from "@/components/ChoiceCardGroup";

const PRODUCTION_OPTIONS: ChoiceCardOption<"menor" | "mayor">[] = [
  {
    value: "menor",
    title: "Pocas piezas",
    description: "Por menor. Sugerimos el horno chico.",
    meta: "Tarifa base: S/ 90.00",
  },
  {
    value: "mayor",
    title: "Muchas piezas",
    description: "Por mayor. Sugerimos el horno grande.",
    meta: "Tarifa base: S/ 380.00",
    badge: "Recomendado",
  },
];

const KILN_OPTIONS: ChoiceCardOption<"chico" | "mediano" | "grande">[] = [
  {
    value: "chico",
    title: "Horno chico",
    description: "Capacidad 17 L",
    meta: "S/ 90.00",
  },
  {
    value: "mediano",
    title: "Horno mediano",
    description: "En mantenimiento",
    meta: "No disponible",
    disabled: true,
  },
  {
    value: "grande",
    title: "Horno grande",
    description: "Capacidad 200 L",
    meta: "S/ 380.00",
    badge: "Alta capacidad",
  },
];

function ControlledChoiceGroup<T extends string>({
  initialValue,
  options,
  label,
  disabled = false,
  onChange,
  ...rest
}: {
  initialValue: T | null;
  options: readonly ChoiceCardOption<T>[];
  label?: string;
  disabled?: boolean;
  onChange?: (val: T) => void;
  [key: string]: unknown;
}) {
  const [val, setVal] = useState<T | null>(initialValue);
  return (
    <ChoiceCardGroup
      value={val}
      onChange={(newVal) => {
        setVal(newVal);
        onChange?.(newVal);
      }}
      options={options}
      label={label}
      disabled={disabled}
      {...rest}
    />
  );
}

describe("ChoiceCardGroup", () => {
  it("renderiza con la semántica correcta de radiogroup y radios", () => {
    render(
      <ChoiceCardGroup
        label="Tipo de pedido"
        value="menor"
        onChange={vi.fn()}
        options={PRODUCTION_OPTIONS}
      />,
    );

    const group = screen.getByRole("radiogroup", { name: "Tipo de pedido" });
    expect(group).toBeInTheDocument();

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);

    expect(radios[0]!).toHaveAttribute("aria-checked", "true");
    expect(radios[0]!).toHaveTextContent("Pocas piezas");
    expect(radios[0]!).toHaveTextContent("Por menor. Sugerimos el horno chico.");
    expect(radios[0]!).toHaveTextContent("Tarifa base: S/ 90.00");

    expect(radios[1]!).toHaveAttribute("aria-checked", "false");
    expect(radios[1]!).toHaveTextContent("Muchas piezas");
    expect(radios[1]!).toHaveTextContent("Recomendado");
  });

  it("permite selección mediante mouse click e invoca onChange", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <ControlledChoiceGroup
        initialValue="menor"
        options={PRODUCTION_OPTIONS}
        onChange={handleChange}
      />,
    );

    const mayorRadio = screen.getByRole("radio", { name: /muchas piezas/i });
    await user.click(mayorRadio);

    expect(handleChange).toHaveBeenCalledWith("mayor");
    expect(mayorRadio).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /pocas piezas/i })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("gestiona roving tabindex adecuadamente", () => {
    render(
      <ChoiceCardGroup
        value="mayor"
        onChange={vi.fn()}
        options={PRODUCTION_OPTIONS}
      />,
    );

    const menorRadio = screen.getByRole("radio", { name: /pocas piezas/i });
    const mayorRadio = screen.getByRole("radio", { name: /muchas piezas/i });

    expect(mayorRadio).toHaveAttribute("tabindex", "0");
    expect(menorRadio).toHaveAttribute("tabindex", "-1");
  });

  it("asigna tabIndex=0 a la primera opción habilitada cuando el valor inicial es null", () => {
    render(
      <ChoiceCardGroup
        value={null}
        onChange={vi.fn()}
        options={KILN_OPTIONS}
      />,
    );

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radios[0]!).toHaveAttribute("tabindex", "0");
    expect(radios[1]!).toHaveAttribute("tabindex", "-1");
    expect(radios[2]!).toHaveAttribute("tabindex", "-1");
  });

  it("soporta navegación hacia adelante con ArrowRight y ArrowDown", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <ControlledChoiceGroup
        initialValue="menor"
        options={PRODUCTION_OPTIONS}
        onChange={handleChange}
      />,
    );

    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toBeDefined();
    expect(radios[1]).toBeDefined();
    radios[0]!.focus();
    expect(radios[0]!).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(handleChange).toHaveBeenCalledWith("mayor");
    expect(radios[1]!).toHaveFocus();
    expect(radios[1]!).toHaveAttribute("aria-checked", "true");
  });

  it("soporta navegación hacia atrás con ArrowLeft y ArrowUp", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <ControlledChoiceGroup
        initialValue="mayor"
        options={PRODUCTION_OPTIONS}
        onChange={handleChange}
      />,
    );

    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toBeDefined();
    expect(radios[1]).toBeDefined();
    radios[1]!.focus();
    expect(radios[1]!).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(handleChange).toHaveBeenCalledWith("menor");
    expect(radios[0]!).toHaveFocus();
    expect(radios[0]!).toHaveAttribute("aria-checked", "true");
  });

  it("hace wrap-around en los extremos de la lista al navegar con flechas", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <ControlledChoiceGroup
        initialValue="menor"
        options={PRODUCTION_OPTIONS}
        onChange={handleChange}
      />,
    );

    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toBeDefined();
    expect(radios[1]).toBeDefined();
    radios[0]!.focus();

    // ArrowLeft desde el primer elemento va al último
    await user.keyboard("{ArrowLeft}");
    expect(handleChange).toHaveBeenCalledWith("mayor");
    expect(radios[1]!).toHaveFocus();

    // ArrowRight desde el último elemento va al primero
    await user.keyboard("{ArrowRight}");
    expect(handleChange).toHaveBeenCalledWith("menor");
    expect(radios[0]!).toHaveFocus();
  });

  it("salta tarjetas deshabilitadas durante la navegación por teclado", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    // En KILN_OPTIONS, "mediano" (index 1) está deshabilitado
    render(
      <ControlledChoiceGroup
        initialValue="chico"
        options={KILN_OPTIONS}
        onChange={handleChange}
      />,
    );

    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toBeDefined();
    expect(radios[2]).toBeDefined();
    radios[0]!.focus();

    // ArrowRight desde "chico" debe saltar "mediano" e ir directo a "grande"
    await user.keyboard("{ArrowRight}");
    expect(handleChange).toHaveBeenCalledWith("grande");
    expect(radios[2]!).toHaveFocus();

    // ArrowLeft desde "grande" debe saltar "mediano" e ir a "chico"
    await user.keyboard("{ArrowLeft}");
    expect(handleChange).toHaveBeenCalledWith("chico");
    expect(radios[0]!).toHaveFocus();
  });

  it("soporta teclas Home y End para ir a la primera y última tarjeta habilitada", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <ControlledChoiceGroup
        initialValue="chico"
        options={KILN_OPTIONS}
        onChange={handleChange}
      />,
    );

    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toBeDefined();
    expect(radios[2]).toBeDefined();
    radios[0]!.focus();

    await user.keyboard("{End}");
    expect(handleChange).toHaveBeenCalledWith("grande");
    expect(radios[2]!).toHaveFocus();

    await user.keyboard("{Home}");
    expect(handleChange).toHaveBeenCalledWith("chico");
    expect(radios[0]!).toHaveFocus();
  });

  it("selecciona con Space y Enter", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <ControlledChoiceGroup
        initialValue={null}
        options={PRODUCTION_OPTIONS}
        onChange={handleChange}
      />,
    );

    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toBeDefined();
    expect(radios[1]).toBeDefined();
    radios[0]!.focus();

    await user.keyboard(" ");
    expect(handleChange).toHaveBeenCalledWith("menor");

    radios[1]!.focus();
    await user.keyboard("{Enter}");
    expect(handleChange).toHaveBeenCalledWith("mayor");
  });

  it("no permite seleccionar tarjetas deshabilitadas por click ni teclado", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <ControlledChoiceGroup
        initialValue="chico"
        options={KILN_OPTIONS}
        onChange={handleChange}
      />,
    );

    const disabledCard = screen.getByRole("radio", { name: /horno mediano/i });
    expect(disabledCard).toBeDisabled();
    expect(disabledCard).toHaveAttribute("aria-disabled", "true");

    await user.click(disabledCard);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("deshabilita todo el grupo cuando se pasa disabled=true", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <ControlledChoiceGroup
        initialValue="menor"
        options={PRODUCTION_OPTIONS}
        disabled={true}
        onChange={handleChange}
      />,
    );

    const group = screen.getByRole("radiogroup");
    expect(group).toHaveAttribute("aria-disabled", "true");

    const radios = screen.getAllByRole("radio");
    expect(radios[0]!).toBeDisabled();
    expect(radios[1]!).toBeDisabled();

    await user.click(radios[1]!);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("renderiza badges, indicadores visuales de radio y slots hijos personalizados", () => {
    render(
      <ChoiceCardGroup
        value="chico"
        onChange={vi.fn()}
        options={[
          {
            value: "chico",
            title: "Horno chico",
            description: "Para producción pequeña",
            badge: "Económico",
            children: <div data-testid="chamber-visual">Cámara 17L</div>,
          },
        ]}
      />,
    );

    expect(screen.getByText("Económico")).toBeInTheDocument();
    expect(screen.getByTestId("chamber-visual")).toBeInTheDocument();
  });

  it("soporta configuración de columnas y clases personalizadas", () => {
    const { container } = render(
      <ChoiceCardGroup
        value="menor"
        onChange={vi.fn()}
        options={PRODUCTION_OPTIONS}
        columns={2}
        cardsClassName="custom-cards-layout"
        cardClassName="custom-card-style"
      />,
    );

    const group = screen.getByRole("radiogroup");
    expect(group).toHaveClass("custom-cards-layout");
    expect(group).toHaveClass("sm:grid-cols-2");

    const cards = container.querySelectorAll<HTMLButtonElement>("button[role='radio']");
    cards.forEach((c) => {
      expect(c).toHaveClass("custom-card-style");
    });
  });

  it("muestra hint y error enlazados por ARIA", () => {
    render(
      <ChoiceCardGroup
        label="Selección de Horno"
        value={null}
        onChange={vi.fn()}
        options={PRODUCTION_OPTIONS}
        hint="Elige según el volumen estimado"
        error="Debes seleccionar una opción para continuar"
      />,
    );

    expect(screen.getByText("Debes seleccionar una opción para continuar")).toBeInTheDocument();
    const group = screen.getByRole("radiogroup", { name: "Selección de Horno" });
    expect(group).toHaveAttribute("aria-describedby", expect.stringContaining("error"));
  });
});
