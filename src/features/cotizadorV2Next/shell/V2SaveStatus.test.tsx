import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { EstadoDeGuardado } from "@/features/cotizadorV2/useEstadoDeGuardado";
import { V2FailedSaves, V2SaveStatus } from "@/features/cotizadorV2Next/shell/V2SaveStatus";

/**
 * El estado de los guardados (010O.3): cuatro frases verdaderas y un aviso de
 * fallos que se puede resolver sin quedar encerrado.
 */

function estado(cambios: Partial<EstadoDeGuardado> = {}): EstadoDeGuardado {
  return {
    enVuelo: 0,
    fallidos: [],
    borradores: 0,
    hayRiesgo: false,
    descartar: vi.fn(),
    ...cambios,
  };
}

const FALLO = {
  firma: "planificacion",
  tipo: "planificacion" as const,
  error: new Error("fallo"),
};

describe("estado de guardado", () => {
  it.each([
    [{}, "Guardado"],
    [{ borradores: 1, hayRiesgo: true }, "Cambios sin guardar"],
    [{ enVuelo: 1, borradores: 1, hayRiesgo: true }, "Guardando…"],
    [{ fallidos: [FALLO], enVuelo: 1, hayRiesgo: true }, "Error al guardar"],
  ])("%o → %s", (cambios, texto) => {
    render(<V2SaveStatus guardado={estado(cambios)} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(texto);
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("no dice «Último guardado ahora» ni ofrece un botón de guardar", () => {
    render(<V2SaveStatus guardado={estado()} />);
    expect(screen.queryByText(/último guardado/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("guardados fallidos", () => {
  it("sin fallos no pinta nada", () => {
    const { container } = render(<V2FailedSaves guardado={estado()} irAPaso={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("dice qué no se guardó y lleva al paso donde se arregla", async () => {
    const user = userEvent.setup();
    const irAPaso = vi.fn();
    render(<V2FailedSaves guardado={estado({ fallidos: [FALLO] })} irAPaso={irAPaso} />);

    const aviso = screen.getByRole("alert");
    expect(aviso).toHaveTextContent("Un cambio no se guardó.");
    expect(aviso).toHaveTextContent("los días efectivos");
    await user.click(screen.getByRole("button", { name: "Ir a corregirlo" }));
    expect(irAPaso).toHaveBeenCalledWith("mano-de-obra");
  });

  it("descartar es una decisión explícita sobre ESE cambio", async () => {
    const user = userEvent.setup();
    const guardado = estado({ fallidos: [FALLO] });
    render(<V2FailedSaves guardado={guardado} irAPaso={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Descartar este cambio" }));
    expect(guardado.descartar).toHaveBeenCalledWith("planificacion");
  });
});
