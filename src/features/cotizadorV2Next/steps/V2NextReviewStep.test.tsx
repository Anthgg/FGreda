import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { V2NextReviewStep } from "@/features/cotizadorV2Next/steps/V2NextReviewStep";
import { COTIZACION } from "@/test/v2next/shellFixtures";

/**
 * Stub de 010O.3: «Revisar y emitir» pinta el resumen del asistente anterior
 * —con la emisión y su huella— y, si la cotización ya no es borrador, el
 * documento que recibió el cliente. Quien reescriba el paso sustituye también
 * esta prueba.
 */

vi.mock("@/features/cotizadorV2/V2ResumenStep", () => ({
  V2ResumenStep: (props: { irAPaso: unknown; estados: unknown[] }) => (
    <p data-testid="resumen-anterior">
      {typeof props.irAPaso === "function" && Array.isArray(props.estados) ? "ok" : "mal"}
    </p>
  ),
}));

vi.mock("@/features/cotizadorV2/V2DocumentoEmitido", () => ({
  V2DocumentoEmitido: (props: { cotizacion: { id: number } }) => (
    <p data-testid="documento-anterior">{props.cotizacion.id}</p>
  ),
}));

const DATOS = {
  cotizacion: COTIZACION,
  productos: undefined,
  manoDeObra: undefined,
  quema: undefined,
  precio: undefined,
};

describe("V2NextReviewStep (interino)", () => {
  it("en borrador pinta el resumen, sin documento emitido", () => {
    render(
      <V2NextReviewStep quotationId={7} canEdit datos={DATOS} estados={[]} irAPaso={() => {}} />,
    );
    expect(screen.getByTestId("resumen-anterior")).toHaveTextContent("ok");
    expect(screen.queryByTestId("documento-anterior")).not.toBeInTheDocument();
  });

  it("emitida: el documento del cliente va antes del resumen", () => {
    render(
      <V2NextReviewStep
        quotationId={7}
        canEdit={false}
        datos={{ ...DATOS, cotizacion: { ...COTIZACION, status: "CONFIRMED" } }}
        estados={[]}
        irAPaso={() => {}}
      />,
    );
    const documento = screen.getByTestId("documento-anterior");
    expect(documento).toHaveTextContent("7");
    expect(
      documento.compareDocumentPosition(screen.getByTestId("resumen-anterior")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
