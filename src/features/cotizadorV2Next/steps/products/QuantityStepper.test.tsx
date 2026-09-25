import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useBorradoresSinGuardar, vaciarRegistroDeBorradores } from "@/components/borradores";

import { QuantityStepper } from "./QuantityStepper";

/**
 * La cantidad mientras su guardado va por la red (010O, integración de la ola 3).
 *
 * Con el backend real la respuesta tarda: entre el envío y la respuesta el
 * campo volvía al valor viejo, quedaba «sucio» contra lo enviado y ya no se
 * recuperaba — se veía 1 con «Cambios sin guardar» aunque el servidor tuviera 10.
 */

afterEach(() => vaciarRegistroDeBorradores());

function Sonda() {
  return <output data-testid="sin-guardar">{useBorradoresSinGuardar()}</output>;
}

function Stepper({ value, onSave }: { value: number; onSave: (valor: number) => void }) {
  return (
    <>
      <QuantityStepper value={value} onSave={onSave} />
      <Sonda />
      <button type="button">Fuera</button>
    </>
  );
}

const sinGuardar = () => screen.getByTestId("sin-guardar").textContent;

describe("QuantityStepper", () => {
  it("mientras el guardado va en vuelo enseña lo enviado, y luego lo confirmado", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { rerender } = render(<Stepper value={1} onSave={onSave} />);
    const campo = screen.getByRole("textbox", { name: "Cantidad" });

    await user.clear(campo);
    await user.type(campo, "10");
    await user.click(screen.getByRole("button", { name: "Fuera" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(10);
    // Aún sin respuesta del servidor: el valor enviado no se pierde.
    expect(campo).toHaveValue("10");
    expect(sinGuardar()).toBe("0");

    rerender(<Stepper value={10} onSave={onSave} />);
    expect(campo).toHaveValue("10");
    expect(sinGuardar()).toBe("0");
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("si el servidor confirma otro valor, el campo se alinea con él", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { rerender } = render(<Stepper value={1} onSave={onSave} />);
    const campo = screen.getByRole("textbox", { name: "Cantidad" });

    await user.clear(campo);
    await user.type(campo, "10");
    await user.click(screen.getByRole("button", { name: "Fuera" }));
    rerender(<Stepper value={8} onSave={onSave} />);

    expect(campo).toHaveValue("8");
    expect(sinGuardar()).toBe("0");
  });
});
