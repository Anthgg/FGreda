import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { CotizadorV2NextPage, RedireccionV2Next } from "@/features/cotizadorV2Next/CotizadorV2NextPage";

/**
 * La entrada del Cotizador V2 rediseñado (010O.3): qué pantalla y qué paso
 * corresponden a cada dirección. El listado y el shell se sustituyen por
 * marcadores: se prueban en sus propios archivos, y así el listado puede
 * rehacerse sin tocar esta prueba.
 */

vi.mock("@/features/cotizadorV2Next/list/V2NextQuotationList", () => ({
  V2NextQuotationList: () => <p>listado</p>,
}));

vi.mock("@/features/cotizadorV2Next/shell/V2NextWizard", () => ({
  V2NextWizard: (props: { quotationId: number; paso: string | null; rutaBase: string }) => (
    <p data-testid="asistente">
      {`${props.quotationId}|${props.paso ?? "sin-paso"}|${props.rutaBase}`}
    </p>
  ),
}));

function renderPage(direccion: string) {
  return render(
    <MemoryRouter initialEntries={[direccion]}>
      <Routes>
        <Route path="/cotizador-v2" element={<CotizadorV2NextPage />} />
        <Route path="/cotizador-v2/:id" element={<CotizadorV2NextPage />} />
        <Route path="/cotizador-v2/:id/:step" element={<CotizadorV2NextPage />} />
        <Route path="/cotizador-v2-next/*" element={<RedireccionV2Next />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("entrada del Cotizador V2 (rediseño, 010O.13)", () => {
  it("sin cotización enseña el listado", () => {
    renderPage("/cotizador-v2");
    expect(screen.getByText("listado")).toBeInTheDocument();
  });

  it.each([
    ["/cotizador-v2-next", "listado"],
    ["/cotizador-v2-next/7/precio", "7|precio|/cotizador-v2"],
    ["/cotizador-v2-next/7/3", "7|materiales|/cotizador-v2"],
  ])("la ruta de pruebas del rediseño %s lleva a la definitiva", (direccion, esperado) => {
    renderPage(direccion);
    expect(screen.getByText(esperado)).toBeInTheDocument();
  });

  it.each([
    ["cliente"],
    ["productos"],
    ["materiales"],
    ["mano-de-obra"],
    ["quema"],
    ["precio"],
    ["resumen"],
  ])("el paso «%s» viaja por su nombre", (paso) => {
    renderPage(`/cotizador-v2/7/${paso}`);
    expect(screen.getByTestId("asistente")).toHaveTextContent(`7|${paso}|/cotizador-v2`);
  });

  it.each([
    ["1", "cliente"],
    ["3", "materiales"],
    ["7", "resumen"],
  ])("un paso numérico de antes (%s) se convierte en «%s»", (numero, paso) => {
    renderPage(`/cotizador-v2/7/${numero}`);
    expect(screen.getByTestId("asistente")).toHaveTextContent(`7|${paso}|`);
  });

  it.each([
    ["sin paso", "/cotizador-v2/7"],
    ["número fuera de rango", "/cotizador-v2/7/8"],
    ["nombre inexistente", "/cotizador-v2/7/horno"],
  ])("%s: el shell decide a dónde ir", (_caso, direccion) => {
    renderPage(direccion);
    expect(screen.getByTestId("asistente")).toHaveTextContent("7|sin-paso|");
  });

  it.each([["abc"], ["0"], ["-3"], ["1.5"]])("un id que no es una cotización (%s) lo dice", (id) => {
    renderPage(`/cotizador-v2/${id}`);
    expect(screen.getByText("Esa cotización V2 no existe. Comprueba el enlace.")).toBeInTheDocument();
    expect(screen.queryByTestId("asistente")).not.toBeInTheDocument();
  });
});
