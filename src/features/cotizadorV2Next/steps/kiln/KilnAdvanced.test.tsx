import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { KilnAdvanced } from "@/features/cotizadorV2Next/steps/kiln/KilnAdvanced";
import { QUEMA_HORNO } from "@/test/v2next/kilnFixtures";

describe("KilnAdvanced", () => {
  it("enseña totales, hornadas y reparto con importes en moneda base", async () => {
    const user = userEvent.setup();
    render(<KilnAdvanced quema={QUEMA_HORNO} canEdit guardarDiferido={vi.fn()} />);

    await user.click(screen.getByText("Ajustes de carga y tarifas"));

    expect(screen.getByText("S/ 1125.00")).toBeInTheDocument();
    expect(screen.getByText("S/ 262.50")).toBeInTheDocument();
    expect(screen.getByText("No es el margen de la cotización.")).toBeInTheDocument();
    expect(screen.getByText("Hornada 3")).toBeInTheDocument();
    expect(screen.getByText("Plato palta")).toBeInTheDocument();
    expect(screen.getByText("S/ 720.00")).toBeInTheDocument();
  });

  it("en solo lectura no monta campos de edición", async () => {
    const user = userEvent.setup();
    render(<KilnAdvanced quema={QUEMA_HORNO} canEdit={false} guardarDiferido={vi.fn()} />);

    await user.click(screen.getByText("Ajustes de carga y tarifas"));

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("Tarifa baja")).toBeInTheDocument();
    expect(screen.getByText("S/ 200.00")).toBeInTheDocument();
  });
});
