import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FactorControl } from "@/features/cotizadorV2Next/steps/pricing/FactorControl";

/**
 * El deslizador del factor (010O.10): una escritura por decisión, nunca una por
 * cada paso del arrastre, y siempre dentro del rango congelado.
 */

const BASE = {
  factor: "3.000000",
  minimo: "2.000000",
  maximo: "3.000000",
  objetivo: "3.000000",
  editable: true,
  fallo: false,
};

describe("control del factor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("enseña el factor guardado como multiplicador", () => {
    render(<FactorControl {...BASE} onCommit={() => {}} />);
    expect(screen.getByTestId("v2next-factor-valor")).toHaveTextContent("×3.00");
    const deslizador = screen.getByRole("slider", { name: "Multiplicar el costo por" });
    expect(deslizador).toHaveAttribute("aria-valuetext", "×3.00");
    expect(deslizador).toHaveAttribute("max", "4");
  });

  it("arrastrar manda UNA escritura, con el último valor, tras 600 ms quieto", () => {
    const onCommit = vi.fn();
    render(<FactorControl {...BASE} onCommit={onCommit} />);
    const deslizador = screen.getByRole("slider");

    fireEvent.change(deslizador, { target: { value: "3" } });
    fireEvent.change(deslizador, { target: { value: "2" } });
    fireEvent.change(deslizador, { target: { value: "1" } });
    expect(screen.getByTestId("v2next-factor-valor")).toHaveTextContent("×2.25");
    act(() => vi.advanceTimersByTime(599));
    expect(onCommit).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("2.25");
  });

  it("soltar guarda al momento, y el temporizador ya no manda otra", () => {
    const onCommit = vi.fn();
    render(<FactorControl {...BASE} onCommit={onCommit} />);
    const deslizador = screen.getByRole("slider");

    fireEvent.change(deslizador, { target: { value: "2" } });
    fireEvent.pointerUp(deslizador);
    expect(onCommit).toHaveBeenCalledWith("2.5");
    act(() => vi.advanceTimersByTime(2000));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("volver al valor guardado no escribe nada", () => {
    const onCommit = vi.fn();
    render(<FactorControl {...BASE} onCommit={onCommit} />);
    const deslizador = screen.getByRole("slider");
    fireEvent.change(deslizador, { target: { value: "2" } });
    fireEvent.change(deslizador, { target: { value: "4" } });
    fireEvent.blur(deslizador);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("mientras vuelve el guardado enseña lo enviado; si falla, vuelve a lo guardado", () => {
    const onCommit = vi.fn();
    const { rerender } = render(<FactorControl {...BASE} onCommit={onCommit} />);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "0" } });
    fireEvent.pointerUp(screen.getByRole("slider"));
    expect(screen.getByTestId("v2next-factor-valor")).toHaveTextContent("×2.00");

    rerender(<FactorControl {...BASE} fallo onCommit={onCommit} />);
    expect(screen.getByTestId("v2next-factor-valor")).toHaveTextContent("×3.00");
  });

  it("un rango de ×2 a ×10 recorre sus nueve factores", () => {
    render(<FactorControl {...BASE} maximo="10.000000" onCommit={() => {}} />);
    expect(screen.getByRole("slider")).toHaveAttribute("max", "8");
    expect(screen.getByText("×10.00 máximo")).toBeInTheDocument();
    expect(screen.getByText("×3.00 objetivo")).toBeInTheDocument();
  });

  it("sin factor todavía no finge uno", () => {
    render(<FactorControl {...BASE} factor={null} onCommit={() => {}} />);
    expect(screen.getByTestId("v2next-factor-valor")).toHaveTextContent("—");
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "Sin elegir");
  });

  it("sin rango congelado no ofrece un ×2–×3 inventado", () => {
    render(<FactorControl {...BASE} factor={null} minimo={null} maximo={null} onCommit={() => {}} />);
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.getByText(/no tiene un rango de factor/)).toBeInTheDocument();
  });

  it("en solo lectura es texto", () => {
    render(<FactorControl {...BASE} editable={false} onCommit={() => {}} />);
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.getByTestId("v2next-factor-valor")).toHaveTextContent("×3.00");
  });

  it("si el paso se desmonta a mitad de arrastre, el valor se guarda igual", () => {
    const onCommit = vi.fn();
    const { unmount } = render(<FactorControl {...BASE} onCommit={onCommit} />);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "1" } });
    unmount();
    expect(onCommit).toHaveBeenCalledWith("2.25");
  });
});
