import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DecimalField } from "@/components/DecimalField";

/**
 * El campo numérico compartido del Cotizador V2 (Fase 010G).
 *
 * Lo que aquí se fija es el comportamiento que las tres copias anteriores
 * tenían cada una a su manera: cuándo guarda, qué manda cuando está vacío y
 * qué NO manda cuando el texto no es un número.
 */
describe("DecimalField", () => {
  it("guarda al salir del campo, no mientras se escribe", async () => {
    const onCommit = vi.fn();
    render(<DecimalField label="Peso" value="500.000000" onCommit={onCommit} />);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/^Peso/));
    await user.type(screen.getByLabelText(/^Peso/), "300");
    // Todavía dentro del campo: nada ha salido.
    expect(onCommit).not.toHaveBeenCalled();

    await user.tab();
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("300");
  });

  it("acepta la coma peruana y manda el punto", async () => {
    const onCommit = vi.fn();
    render(<DecimalField label="Tarifa" value="" onCommit={onCommit} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^Tarifa/), "2,5");
    await user.tab();

    expect(onCommit).toHaveBeenCalledExactlyOnceWith("2.5");
  });

  it("un campo vacío manda null, no cero", async () => {
    const onCommit = vi.fn();
    render(<DecimalField label="Peso" value="500.000000" onCommit={onCommit} />);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/^Peso/));
    await user.tab();

    expect(onCommit).toHaveBeenCalledExactlyOnceWith(null);
  });

  it("un texto que no es número no manda nada y se explica", async () => {
    const onCommit = vi.fn();
    render(<DecimalField label="Peso" value="500.000000" onCommit={onCommit} />);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/^Peso/));
    await user.type(screen.getByLabelText(/^Peso/), "abc");
    await user.tab();

    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText(/coma o punto/i)).toBeInTheDocument();
  });

  it("no gasta una petición si el valor acaba donde empezó", async () => {
    const onCommit = vi.fn();
    render(<DecimalField label="Peso" value="500.000000" onCommit={onCommit} />);
    const user = userEvent.setup();

    await user.click(screen.getByLabelText(/^Peso/));
    await user.tab();

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("escribir la misma cifra de otra forma tampoco gasta una petición", async () => {
    // «500» guardado y «500,0» escrito son el mismo número. Comparando texto
    // no lo eran, y cada visita al campo mandaba un guardado que no cambiaba
    // nada: una petición, un recálculo de la cotización entera y una entrada
    // de auditoría por reescribir el mismo valor.
    const onCommit = vi.fn();
    render(<DecimalField label="Peso" value="500.000000" onCommit={onCommit} />);
    const user = userEvent.setup();

    for (const forma of ["500,0", "0500", "500."]) {
      await user.clear(screen.getByLabelText(/^Peso/));
      await user.type(screen.getByLabelText(/^Peso/), forma);
      await user.tab();
    }

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("enseña el valor guardado sin los ceros de cola", () => {
    render(<DecimalField label="Costo" value="0.001300" onCommit={vi.fn()} />);
    expect(screen.getByLabelText(/^Costo/)).toHaveValue("0.0013");
  });

  it("un entero rechaza el separador decimal", async () => {
    const onCommit = vi.fn();
    render(<DecimalField label="Piezas" value="20" onCommit={onCommit} entero />);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/^Piezas/));
    await user.type(screen.getByLabelText(/^Piezas/), "10,5");
    await user.tab();

    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText(/entero/i)).toBeInTheDocument();
  });

  it("un obligatorio vacío se explica en vez de mandarse", async () => {
    // Ni `null` —que lo retiraría— ni 0 —que lo inventaría—.
    const onCommit = vi.fn();
    render(
      <DecimalField label="Piezas" requirement="required" value="20" onCommit={onCommit} entero />,
    );
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/^Piezas/));
    await user.tab();

    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText(/vacío no es cero/i)).toBeInTheDocument();
  });

  it("rechaza un negativo salvo que se permita", async () => {
    const onCommit = vi.fn();
    render(<DecimalField label="Tarifa" value="" onCommit={onCommit} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^Tarifa/), "-5");
    await user.tab();

    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText(/negativo/i)).toBeInTheDocument();
  });

  it("el error se retira en cuanto se corrige", async () => {
    render(<DecimalField label="Peso" value="" onCommit={vi.fn()} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^Peso/), "abc");
    await user.tab();
    expect(screen.getByText(/coma o punto/i)).toBeInTheDocument();

    // `user.type` CONCATENA: sin limpiar antes, el campo quedaria en «abc1» y
    // la prueba pasaria por el motivo equivocado —cualquier tecla retira el
    // error— sin comprobar nunca que lo escrito ya es valido.
    await user.clear(screen.getByLabelText(/^Peso/));
    await user.type(screen.getByLabelText(/^Peso/), "1");
    expect(screen.queryByText(/coma o punto/i)).toBeNull();

    await user.tab();
    expect(screen.queryByText(/coma o punto/i)).toBeNull();
  });
});
