import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { V2_PRICING } from "@/test/quoterV2Fixtures";
import { jsonResponse, renderApp } from "@/test/utils";
import { mockShell } from "@/test/v2next/shellFixtures";

/**
 * El paso «Precio» del rediseño, montado en el shell (010O.10).
 *
 * Lo que se protege: que la única decisión —el factor— se mande una vez y con
 * el valor del rango congelado, que cada cifra sea la del backend en su moneda,
 * y que nada del detalle que el taller consulta se haya perdido.
 */

async function abrirPrecio(opciones: Parameters<typeof mockShell>[0] = {}) {
  const espia = mockShell(opciones);
  renderApp(["/cotizador-v2-next/7/precio"]);
  const paso = await screen.findByTestId("v2next-paso-precio");
  return { espia, paso: within(paso) };
}

function escriturasDelFactor(espia: ReturnType<typeof mockShell>) {
  return espia.mock.calls
    .filter(
      ([url, init]) =>
        String(url).endsWith("/quotations-v2/7/pricing") &&
        (init as RequestInit | undefined)?.method === "PUT",
    )
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)));
}

describe("paso «Precio» del rediseño", () => {
  it("cuenta costo, factor y precio con las cifras del backend", async () => {
    const { paso } = await abrirPrecio();
    expect(paso.getByTestId("v2next-costo-produccion")).toHaveTextContent("S/ 2558.43");
    expect(paso.getByTestId("v2next-factor-valor")).toHaveTextContent("×3.00");
    expect(paso.getByTestId("v2next-subtotal")).toHaveTextContent("S/ 7693.00");
    expect(paso.getByTestId("v2next-precio-total")).toHaveTextContent("S/ 9077.74");
    expect(paso.getByText("Precio mínimo ×2.00")).toBeInTheDocument();
    expect(paso.getByText("Precio objetivo ×3.00")).toBeInTheDocument();
    expect(paso.getByText("IGV 18 %")).toBeInTheDocument();
  });

  it("mover el factor manda UNA escritura con el valor elegido al soltar", async () => {
    const { espia, paso } = await abrirPrecio({
      extra: (url, init) =>
        url.endsWith("/quotations-v2/7/pricing") && init.method === "PUT"
          ? jsonResponse(200, { ...V2_PRICING, commercial_factor: "2.500000" })
          : undefined,
    });
    const deslizador = paso.getByRole("slider", { name: "Multiplicar el costo por" });
    fireEvent.change(deslizador, { target: { value: "3" } });
    fireEvent.change(deslizador, { target: { value: "2" } });
    fireEvent.pointerUp(deslizador);

    await waitFor(() => expect(escriturasDelFactor(espia)).toEqual([{ commercial_factor: "2.5" }]));
  });

  it("en dólares: precio en US$, costos en soles, y se dice", async () => {
    const { paso } = await abrirPrecio({
      cotizacion: { currency_code: "USD", currency_symbol: "US$", exchange_rate: "3.750000" },
      extra: (url) =>
        url.endsWith("/quotations-v2/7/pricing")
          ? jsonResponse(200, { ...V2_PRICING, currency_code: "USD", subtotal: "2051.47" })
          : undefined,
    });
    expect(paso.getByTestId("v2next-subtotal")).toHaveTextContent("US$ 2051.47");
    expect(paso.getByTestId("v2next-costo-produccion")).toHaveTextContent("S/ 2558.43");
    expect(paso.getByText(/van en soles, antes de convertir/)).toBeInTheDocument();
  });

  it("los avisos del backend se dicen en palabras, nunca con el código", async () => {
    const { paso } = await abrirPrecio({
      extra: (url) =>
        url.endsWith("/quotations-v2/7/pricing")
          ? jsonResponse(200, {
              ...V2_PRICING,
              warnings: ["V2_PRICING_SELLING_BELOW_REAL_COST", "V2_CODIGO_NUEVO"],
            })
          : undefined,
    });
    const avisos = paso.getByTestId("v2next-avisos-precio");
    expect(avisos).toHaveTextContent("se vendería a pérdida");
    expect(avisos).not.toHaveTextContent("V2_");
    expect(paso.getByText("Ganancia estimada (pérdida)")).toBeInTheDocument();
  });

  it("conserva adicionales, reparto y rebajas, estos dos plegados", async () => {
    const { paso } = await abrirPrecio();
    expect(await paso.findByTestId("adicionales")).toBeInTheDocument();
    const reparto = paso.getByText("Cómo se reparte el costo entre las piezas").closest("details");
    expect(reparto).not.toHaveAttribute("open");
    expect(paso.getByTestId("v2next-rebaja").tagName).toBe("DETAILS");
  });

  it("una cotización emitida se lee sin controles", async () => {
    const { paso } = await abrirPrecio({
      cotizacion: {
        status: "CONFIRMED",
        effective_status: "CONFIRMED",
        issued_at: "2026-09-20T10:00:00Z",
      },
    });
    expect(paso.queryByRole("slider")).not.toBeInTheDocument();
    expect(paso.getByTestId("v2next-factor-valor")).toHaveTextContent("×3.00");
  });
});
