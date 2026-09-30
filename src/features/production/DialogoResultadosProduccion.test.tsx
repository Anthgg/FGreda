import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DialogoResultadosProduccion } from "@/features/production/DialogoResultadosProduccion";

const LINEAS = [{ line_ref: "V2P:301", product_name: "Taza", started_quantity: "30" }];

describe("DialogoResultadosProduccion", () => {
  it("pide captura explícita de buenas y merma, sin valores precargados", () => {
    render(<DialogoResultadosProduccion lines={LINEAS} pending={false} error={null} onClose={vi.fn()} onSubmit={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "Registrar resultados de producción" });

    expect(within(dialog).getByText("Cantidad iniciada:")).toHaveTextContent("30");
    expect(within(dialog).getByLabelText("Buenas")).toHaveValue("");
    expect(within(dialog).getByLabelText("Merma")).toHaveValue("");
  });

  it("rechaza una suma que no coincide con lo iniciado", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<DialogoResultadosProduccion lines={LINEAS} pending={false} error={null} onClose={vi.fn()} onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText("Buenas"), "28");
    await user.type(screen.getByLabelText("Merma"), "1");
    await user.type(screen.getByLabelText("Motivo de merma"), "Prueba");
    await user.click(screen.getByRole("button", { name: "Completar producción" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("deben ser iguales a las 30 unidades iniciadas");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("envía exactamente 30 iniciadas = 27 buenas + 3 merma y su motivo", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<DialogoResultadosProduccion lines={LINEAS} pending={false} error={null} onClose={vi.fn()} onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText("Buenas"), "27");
    await user.type(screen.getByLabelText("Merma"), "3");
    await user.type(screen.getByLabelText("Motivo de merma"), "Defecto de cocción");
    await user.click(screen.getByRole("button", { name: "Completar producción" }));

    expect(onSubmit).toHaveBeenCalledWith([{
      line_ref: "V2P:301",
      good_quantity: "27",
      scrap_quantity: "3",
      scrap_reason: "Defecto de cocción",
    }]);
  });

  it("permite registrar todas las piezas como buenas sin motivo de merma", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<DialogoResultadosProduccion lines={[{ ...LINEAS[0]!, started_quantity: "2" }]} pending={false} error={null} onClose={vi.fn()} onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText("Buenas"), "2");
    await user.type(screen.getByLabelText("Merma"), "0");
    await user.click(screen.getByRole("button", { name: "Completar producción" }));

    expect(onSubmit).toHaveBeenCalledWith([{
      line_ref: "V2P:301",
      good_quantity: "2",
      scrap_quantity: "0",
      scrap_reason: null,
    }]);
  });
});
