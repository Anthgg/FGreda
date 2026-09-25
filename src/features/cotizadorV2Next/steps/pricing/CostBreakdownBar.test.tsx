import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CostBreakdownBar } from "@/features/cotizadorV2Next/steps/pricing/CostBreakdownBar";
import { PricePerPieceTable } from "@/features/cotizadorV2Next/steps/pricing/PricePerPieceTable";
import { V2_PRICING } from "@/test/quoterV2Fixtures";

/**
 * Costo y precio por pieza (010O.10): los totales son los del backend. La
 * pantalla reparte anchos y pone símbolos, y nada más.
 */

describe("lo que nos cuesta", () => {
  it("el total es production_cost del backend, no una suma de las partes", () => {
    // Partes que NO suman el total: si la pantalla sumara, se notaría.
    render(
      <CostBreakdownBar
        precio={{ ...V2_PRICING, production_cost: "1000.000000", materials_cost: "100.000000" }}
      />,
    );
    expect(screen.getByTestId("v2next-costo-produccion")).toHaveTextContent("S/ 1000.00");
  });

  it("cada parte tiene nombre e importe en la leyenda, y ancho proporcional en la barra", () => {
    render(
      <CostBreakdownBar
        precio={{
          ...V2_PRICING,
          production_cost: "1000.000000",
          materials_cost: "250.000000",
          labor_cost: "0.000000",
        }}
      />,
    );
    const leyenda = screen.getByRole("list");
    expect(within(leyenda).getByText("Materiales").parentElement).toHaveTextContent("S/ 250.00");
    expect(within(leyenda).getByText("Mano de obra").parentElement).toHaveTextContent("—");

    const barra = screen.getByTestId("v2next-barra-costo");
    expect(barra).toHaveAttribute("aria-hidden", "true");
    const materiales = barra.querySelector('[data-parte="materials_cost"]') as HTMLElement;
    expect(materiales.style.width).toBe("25%");
    expect(barra.querySelector('[data-parte="labor_cost"]')).toBeNull();
  });

  it("sin costo no pinta segmentos", () => {
    render(<CostBreakdownBar precio={{ ...V2_PRICING, production_cost: "0" }} />);
    expect(screen.getByTestId("v2next-barra-costo").children).toHaveLength(0);
  });
});

describe("precio por pieza", () => {
  it("unitarios y totales en la moneda de la cotización, tal como llegan", () => {
    render(
      <PricePerPieceTable
        precio={{
          ...V2_PRICING,
          currency_code: "USD",
          tax_percent: "10.500000",
          subtotal: "944.000000",
          tax: "99.120000",
          total: "1043.120000",
          lines: V2_PRICING.lines.map((linea) => ({
            ...linea,
            unit_price: "47.200000",
            line_subtotal: "944.000000",
          })),
        }}
        moneda={{ currency_code: "USD", currency_symbol: "US$" }}
      />,
    );
    const tabla = screen.getByRole("table");
    expect(within(tabla).getByText("US$ 47.20")).toBeInTheDocument();
    expect(screen.getByText("IGV 10.5 %")).toBeInTheDocument();
    expect(screen.getByTestId("v2next-precio-total")).toHaveTextContent("US$ 1043.12");
    expect(screen.queryByText(/S\/ /)).not.toBeInTheDocument();
  });

  it("el IGV sale de la cotización, no de un 18 escrito aquí", () => {
    render(
      <PricePerPieceTable
        precio={{ ...V2_PRICING, tax_percent: "0.000000", tax: "0" }}
        moneda={{ currency_code: "PEN", currency_symbol: "S/" }}
      />,
    );
    expect(screen.getByText("IGV 0 %")).toBeInTheDocument();
  });
});
