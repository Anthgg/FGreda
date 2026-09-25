import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { V2PendingList } from "@/features/cotizadorV2Next/shell/V2PendingList";
import { LINEA } from "@/test/v2next/shellFixtures";

/**
 * Los pendientes (010O.3) salen de los bloqueos del backend, en palabras, con
 * un atajo al paso donde se arreglan. Nunca el código crudo.
 */

const BASE = {
  cargando: false,
  error: false,
  editable: true,
  avisos: 0,
  lineas: [LINEA],
  irAPaso: () => {},
};

describe("pendientes", () => {
  it("traduce cada bloqueo y dice su paso y su pieza", () => {
    render(
      <V2PendingList
        {...BASE}
        bloqueos={[
          { code: "V2_CONFIRM_KILN_REQUIRED", line_id: null },
          { code: "V2_CONFIRM_LINE_BODY_MATERIAL_REQUIRED", line_id: 11 },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Faltan 2 cosas para emitir" })).toBeInTheDocument();
    const horno = screen.getByRole("button", { name: /Falta elegir el horno/ });
    expect(horno).toHaveTextContent("Paso 5: Horno");
    const pasta = screen.getByRole("button", { name: /no tiene pasta elegida/ });
    expect(pasta).toHaveTextContent("Paso 3: Arcilla y esmalte · Plato palta");
    expect(screen.getByTestId("v2next-pendientes")).not.toHaveTextContent("V2_");
  });

  it("cada pendiente lleva a su paso", async () => {
    const user = userEvent.setup();
    const irAPaso = vi.fn();
    render(
      <V2PendingList
        {...BASE}
        irAPaso={irAPaso}
        bloqueos={[{ code: "V2_CONFIRM_WORK_DAYS_REQUIRED", line_id: null }]}
      />,
    );
    await user.click(screen.getByRole("button", { name: /días efectivos/ }));
    expect(irAPaso).toHaveBeenCalledWith("mano-de-obra");
  });

  it("un bloqueo de configuración se dice, pero no finge un paso donde arreglarlo", () => {
    render(<V2PendingList {...BASE} bloqueos={[{ code: "V2_CONFIRM_TAX_REQUIRED", line_id: null }]} />);
    expect(screen.getByText(/no tiene IGV/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Configuración comercial")).toBeInTheDocument();
  });

  it("sin bloqueos: todo listo, y los avisos se cuentan aparte", () => {
    render(<V2PendingList {...BASE} bloqueos={[]} avisos={2} />);
    expect(screen.getByText("Todo listo para emitir")).toBeInTheDocument();
    expect(screen.getByText("2 avisos menores: no impiden emitir.")).toBeInTheDocument();
  });

  it("mientras se comprueba no dice ni «listo» ni «falta»", () => {
    render(<V2PendingList {...BASE} bloqueos={undefined} cargando />);
    expect(screen.getByText("Comprobando qué falta…")).toBeInTheDocument();
    expect(screen.queryByText(/todo listo/i)).not.toBeInTheDocument();
  });

  it("si no se pudo comprobar, lo dice sin inventar una lista", () => {
    render(<V2PendingList {...BASE} bloqueos={undefined} error />);
    expect(screen.getByText(/No se pudo comprobar qué falta/)).toBeInTheDocument();
  });

  it("una cotización emitida no tiene pendientes", () => {
    render(
      <V2PendingList
        {...BASE}
        editable={false}
        bloqueos={[{ code: "V2_CONFIRM_KILN_REQUIRED", line_id: null }]}
      />,
    );
    expect(screen.getByText(/valores están congelados/)).toBeInTheDocument();
    expect(screen.queryByText(/Falta elegir el horno/)).not.toBeInTheDocument();
  });
});
