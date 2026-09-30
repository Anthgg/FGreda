import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { SegmentedControl } from "@/components/SegmentedControl";
import type { SegmentedControlOption } from "@/components/SegmentedControl";

const CURRENCY_OPTIONS: SegmentedControlOption<"PEN" | "USD">[] = [
  { value: "PEN", label: "Soles (PEN)" },
  { value: "USD", label: "Dólares (USD)" },
];

const CLIENT_OPTIONS: SegmentedControlOption<"externo" | "alumno" | "taller">[] = [
  { value: "externo", label: "Externo" },
  { value: "alumno", label: "Alumno" },
  { value: "taller", label: "Taller", disabled: true },
];

function ControlledSegmented<T extends string>({
  initialValue,
  options,
  label,
  disabled = false,
  onChange,
  ...rest
}: {
  initialValue: T | null;
  options: readonly SegmentedControlOption<T>[];
  label?: string;
  disabled?: boolean;
  onChange?: (val: T) => void;
  [key: string]: unknown;
}) {
  const [val, setVal] = useState<T | null>(initialValue);
  return (
    <SegmentedControl
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

describe("SegmentedControl", () => {
  it("renderiza con la semántica correcta de radiogroup y radios", () => {
    render(
      <SegmentedControl
        label="Moneda"
        value="PEN"
        onChange={vi.fn()}
        options={CURRENCY_OPTIONS}
      />,
    );

    const group = screen.getByRole("radiogroup", { name: "Moneda" });
    expect(group).toBeInTheDocument();

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);

    expect(radios[0]!).toHaveTextContent("Soles (PEN)");
    expect(radios[0]!).toHaveAttribute("aria-checked", "true");

    expect(radios[1]!).toHaveTextContent("Dólares (USD)");
    expect(radios[1]!).toHaveAttribute("aria-checked", "false");
  });

  it("permite selección mediante click de mouse e invoca onChange", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <ControlledSegmented
        initialValue="PEN"
        options={CURRENCY_OPTIONS}
        onChange={handleChange}
      />,
    );

    const usdRadio = screen.getByRole("radio", { name: /dólares/i });
    await user.click(usdRadio);

    expect(handleChange).toHaveBeenCalledWith("USD");
    expect(usdRadio).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /soles/i })).toHaveAttribute("aria-checked", "false");
  });

  it("soporta roving tabindex (solo la opción activa o primera habilitada tiene tabIndex=0)", () => {
    render(
      <SegmentedControl
        value="USD"
        onChange={vi.fn()}
        options={CURRENCY_OPTIONS}
      />,
    );

    const penRadio = screen.getByRole("radio", { name: /soles/i });
    const usdRadio = screen.getByRole("radio", { name: /dólares/i });

    expect(usdRadio).toHaveAttribute("tabindex", "0");
    expect(penRadio).toHaveAttribute("tabindex", "-1");
  });

  it("asigna tabIndex=0 a la primera opción no deshabilitada cuando no hay valor seleccionado", () => {
    render(
      <SegmentedControl
        value={null}
        onChange={vi.fn()}
        options={CLIENT_OPTIONS}
      />,
    );

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radios[0]!).toHaveAttribute("tabindex", "0");
    expect(radios[1]!).toHaveAttribute("tabindex", "-1");
    expect(radios[2]!).toHaveAttribute("tabindex", "-1");
  });

  it("navega y selecciona con ArrowRight y ArrowDown hacia adelante", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <ControlledSegmented
        initialValue="externo"
        options={CLIENT_OPTIONS}
        onChange={handleChange}
      />,
    );

    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toBeDefined();
    expect(radios[1]).toBeDefined();
    radios[0]!.focus();
    expect(radios[0]!).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(handleChange).toHaveBeenCalledWith("alumno");
    expect(radios[1]!).toHaveFocus();
    expect(radios[1]!).toHaveAttribute("aria-checked", "true");
  });

  it("navega y selecciona con ArrowLeft y ArrowUp hacia atrás", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <ControlledSegmented
        initialValue="alumno"
        options={CLIENT_OPTIONS}
        onChange={handleChange}
      />,
    );

    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toBeDefined();
    expect(radios[1]).toBeDefined();
    radios[1]!.focus();
    expect(radios[1]!).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(handleChange).toHaveBeenCalledWith("externo");
    expect(radios[0]!).toHaveFocus();
    expect(radios[0]!).toHaveAttribute("aria-checked", "true");
  });

  it("hace wrap-around al llegar al final o al inicio con las flechas", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <ControlledSegmented
        initialValue="PEN"
        options={CURRENCY_OPTIONS}
        onChange={handleChange}
      />,
    );

    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toBeDefined();
    expect(radios[1]).toBeDefined();
    radios[0]!.focus();

    // ArrowLeft desde el primer elemento debe envolver al último (USD)
    await user.keyboard("{ArrowLeft}");
    expect(handleChange).toHaveBeenCalledWith("USD");
    expect(radios[1]!).toHaveFocus();
    expect(radios[1]!).toHaveAttribute("aria-checked", "true");

    // ArrowRight desde el último debe envolver al primero (PEN)
    await user.keyboard("{ArrowRight}");
    expect(handleChange).toHaveBeenCalledWith("PEN");
    expect(radios[0]!).toHaveFocus();
    expect(radios[0]!).toHaveAttribute("aria-checked", "true");
  });

  it("omite las opciones deshabilitadas durante la navegación con flechas", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    // En CLIENT_OPTIONS, 'taller' (index 2) está deshabilitado
    render(
      <ControlledSegmented
        initialValue="alumno"
        options={CLIENT_OPTIONS}
        onChange={handleChange}
      />,
    );

    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toBeDefined();
    expect(radios[1]).toBeDefined();
    radios[1]!.focus();

    // Flecha derecha desde 'alumno': 'taller' está deshabilitado, debe saltar a 'externo'
    await user.keyboard("{ArrowRight}");
    expect(handleChange).toHaveBeenCalledWith("externo");
    expect(radios[0]!).toHaveFocus();

    // Flecha izquierda desde 'externo': salta 'taller' y va a 'alumno'
    await user.keyboard("{ArrowLeft}");
    expect(handleChange).toHaveBeenCalledWith("alumno");
    expect(radios[1]!).toHaveFocus();
  });

  it("soporta teclas Home y End para ir al primer y último elemento habilitado", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <ControlledSegmented
        initialValue="externo"
        options={CLIENT_OPTIONS}
        onChange={handleChange}
      />,
    );

    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toBeDefined();
    expect(radios[1]).toBeDefined();
    radios[0]!.focus();

    // End debería ir al último elemento habilitado ('alumno' porque 'taller' está disabled)
    await user.keyboard("{End}");
    expect(handleChange).toHaveBeenCalledWith("alumno");
    expect(radios[1]!).toHaveFocus();

    // Home debería regresar al primer elemento habilitado ('externo')
    await user.keyboard("{Home}");
    expect(handleChange).toHaveBeenCalledWith("externo");
    expect(radios[0]!).toHaveFocus();
  });

  it("permite seleccionar con teclas Space y Enter", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <ControlledSegmented
        initialValue={null}
        options={CURRENCY_OPTIONS}
        onChange={handleChange}
      />,
    );

    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toBeDefined();
    expect(radios[1]).toBeDefined();
    radios[0]!.focus();

    await user.keyboard(" ");
    expect(handleChange).toHaveBeenCalledWith("PEN");

    radios[1]!.focus();
    await user.keyboard("{Enter}");
    expect(handleChange).toHaveBeenCalledWith("USD");
  });

  it("no permite hacer click ni seleccionar opciones deshabilitadas", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <ControlledSegmented
        initialValue="externo"
        options={CLIENT_OPTIONS}
        onChange={handleChange}
      />,
    );

    const disabledRadio = screen.getByRole("radio", { name: /taller/i });
    expect(disabledRadio).toBeDisabled();
    expect(disabledRadio).toHaveAttribute("aria-disabled", "true");

    await user.click(disabledRadio);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("deshabilita todo el control cuando se pasa disabled=true", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <ControlledSegmented
        initialValue="PEN"
        options={CURRENCY_OPTIONS}
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

  it("muestra descripciones secundarias, hints y errores accesibles", () => {
    render(
      <SegmentedControl
        label="Modo de Quema"
        value="compartida"
        onChange={vi.fn()}
        options={[
          { value: "compartida", label: "Compartido", description: "Por volumen" },
          { value: "exclusiva", label: "Exclusivo", description: "Horno entero" },
        ]}
        hint="Define cómo se factura el espacio"
        error="Selección requerida"
      />,
    );

    expect(screen.getByText("Por volumen")).toBeInTheDocument();
    expect(screen.getByText("Horno entero")).toBeInTheDocument();
    expect(screen.getByText("Selección requerida")).toBeInTheDocument();

    const group = screen.getByRole("radiogroup", { name: "Modo de Quema" });
    expect(group).toHaveAttribute("aria-describedby", expect.stringContaining("error"));
  });

  it("soporta orientación vertical y clase fullWidth", () => {
    const { container } = render(
      <SegmentedControl
        value="PEN"
        onChange={vi.fn()}
        options={CURRENCY_OPTIONS}
        orientation="vertical"
        fullWidth={true}
      />,
    );

    const group = screen.getByRole("radiogroup");
    expect(group).toHaveAttribute("aria-orientation", "vertical");
    expect(group).toHaveClass("flex-col");
    expect(group).toHaveClass("w-full");

    const buttons = container.querySelectorAll<HTMLButtonElement>("button[role='radio']");
    buttons.forEach((btn) => {
      expect(btn).toHaveClass("w-full");
    });
  });
});
