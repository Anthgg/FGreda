import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { V2QuotationSummaryRail } from "@/features/cotizadorV2Next/shell/V2QuotationSummaryRail";
import { V2_PRICING } from "@/test/quoterV2Fixtures";
import { COTIZACION, LINEA } from "@/test/v2next/shellFixtures";

/**
 * El resumen lateral (010O.3). Solo lee campos del backend, y escribe cada uno
 * en su moneda: el precio en la de la cotización, los costos en soles.
 */

const BASE = {
  cotizacion: COTIZACION,
  precio: V2_PRICING,
  precioCargando: false,
  precioError: false,
  lineas: [LINEA, { ...LINEA, id: 12, quantity: 5 }],
  pendientes: <p>lista de pendientes</p>,
  faltas: 0,
};

/** La presentación de tablet y escritorio: la del teléfono empieza plegada. */
function resumenAncho() {
  return within(screen.getByTestId("v2next-resumen-dinero"));
}

describe("resumen lateral", () => {
  it("enseña total, costo, ganancia y margen tal como llegan del backend", () => {
    render(<V2QuotationSummaryRail {...BASE} />);
    const resumen = resumenAncho();
    expect(resumen.getByTestId("v2next-total")).toHaveTextContent("S/ 9077.74");
    expect(resumen.getByText("Nos cuesta").nextSibling).toHaveTextContent("S/ 1868.43");
    expect(resumen.getByText("Ganamos").nextSibling).toHaveTextContent("S/ 5824.57");
    expect(resumen.getByText("Margen").nextSibling).toHaveTextContent("75.7 %");
  });

  it("cuenta las piezas y dice si el total lleva IGV", () => {
    render(<V2QuotationSummaryRail {...BASE} />);
    expect(resumenAncho().getByText("25 piezas · IGV incluido")).toBeInTheDocument();
  });

  it("en dólares, el total va en US$ y los costos siguen en soles", () => {
    render(
      <V2QuotationSummaryRail
        {...BASE}
        cotizacion={{ ...COTIZACION, currency_code: "USD", currency_symbol: "US$", exchange_rate: "3.75" }}
        precio={{ ...V2_PRICING, currency_code: "USD", total: "2420.730000" }}
      />,
    );
    const resumen = resumenAncho();
    expect(resumen.getByTestId("v2next-total")).toHaveTextContent("US$ 2420.73");
    expect(resumen.getByText("Nos cuesta").nextSibling).toHaveTextContent("S/ 1868.43");
    expect(resumen.getByText("Ganamos").nextSibling).toHaveTextContent("S/ 5824.57");
    expect(resumen.getByText(/lo que cuesta y lo que se gana, en soles/)).toBeInTheDocument();
  });

  it("una venta a pérdida lo dice en palabras, no solo en rojo", () => {
    render(
      <V2QuotationSummaryRail
        {...BASE}
        precio={{ ...V2_PRICING, estimated_profit: "-10.000000", warnings: ["V2_PRICING_SELLING_BELOW_REAL_COST"] }}
      />,
    );
    expect(resumenAncho().getByText("Ganamos (pérdida)")).toBeInTheDocument();
  });

  it("sin factor no hay precio, y no se finge un total en cero", () => {
    render(
      <V2QuotationSummaryRail {...BASE} precio={{ ...V2_PRICING, commercial_factor: null, total: "0" }} />,
    );
    const resumen = resumenAncho();
    expect(resumen.getByTestId("v2next-total")).toHaveTextContent("—");
    expect(resumen.getByText(/no hay precio/)).toBeInTheDocument();
  });

  it("mientras calcula lo dice, y si falla también", () => {
    const { rerender } = render(<V2QuotationSummaryRail {...BASE} precio={undefined} precioCargando />);
    expect(screen.getByText("Calculando el precio…")).toBeInTheDocument();
    rerender(<V2QuotationSummaryRail {...BASE} precio={undefined} precioError />);
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo leer el precio");
  });

  it("en el teléfono es una línea que se despliega", async () => {
    const user = userEvent.setup();
    render(<V2QuotationSummaryRail {...BASE} faltas={2} />);
    const compacto = within(screen.getByTestId("v2next-resumen-compacto"));
    const boton = compacto.getByRole("button", { name: /Total para el cliente/ });
    expect(boton).toHaveAttribute("aria-expanded", "false");
    expect(boton).toHaveTextContent("S/ 9077.74");
    expect(boton).toHaveTextContent("Faltan 2 cosas");
    expect(compacto.queryByText("lista de pendientes")).not.toBeInTheDocument();

    await user.click(boton);
    expect(boton).toHaveAttribute("aria-expanded", "true");
    expect(compacto.getByText("lista de pendientes")).toBeInTheDocument();
  });

  it("es un aside con nombre, y la versión ancha se reserva para contenedores ≥ 760 px", () => {
    render(<V2QuotationSummaryRail {...BASE} />);
    const aside = screen.getByRole("complementary", { name: "Resumen de la cotización" });
    expect(within(aside).getByTestId("v2next-resumen-compacto")).toHaveClass("@min-[760px]:hidden");
  });
});
