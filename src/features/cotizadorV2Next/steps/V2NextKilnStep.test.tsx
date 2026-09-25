import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { V2NextKilnStep } from "@/features/cotizadorV2Next/steps/V2NextKilnStep";
import { COTIZACION } from "@/test/v2next/shellFixtures";

/**
 * Stub de 010O.3: el paso pinta el panel del asistente anterior con las
 * props del shell. Quien reescriba el paso sustituye también esta prueba.
 */

vi.mock("@/features/cotizadorV2/V2FiringPanel", () => ({
  V2FiringPanel: (props: Record<string, unknown>) => (
    <p data-testid="panel-anterior">{JSON.stringify(props, (clave, valor) => (clave === "cotizacion" ? (valor as { id: number }).id : typeof valor === "function" ? "fn" : valor))}</p>
  ),
}));

const PROPS = {
  quotationId: 7,
  canEdit: true,
  datos: {
    cotizacion: COTIZACION,
    productos: undefined,
    manoDeObra: undefined,
    quema: undefined,
    precio: undefined,
  },
  estados: [],
  irAPaso: () => {},
};

describe("V2NextKilnStep (interino)", () => {
  it("pinta el panel del asistente anterior con las props del shell", () => {
    render(<V2NextKilnStep {...PROPS} />);
    expect(JSON.parse(screen.getByTestId("panel-anterior").textContent ?? "{}")).toEqual({ quotationId: 7, canEdit: true });
  });
});
