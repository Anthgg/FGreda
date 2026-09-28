import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { V2_PRICING } from "@/test/quoterV2Fixtures";
import { jsonResponse, renderApp } from "@/test/utils";
import { COTIZACION, mockShell } from "@/test/v2next/shellFixtures";
import type { V2Pricing } from "@/types/quoterV2Pricing";

type MockShellOptions = NonNullable<Parameters<typeof mockShell>[0]>;

const PRICING_010P: V2Pricing = {
  ...V2_PRICING,
  pricing_rules_version: 2,
  active_production_minutes: "360.000000",
  active_production_hours: "6.000000",
  commercial_external_labor_cost: "150.000000",
  real_external_labor_cost: "240.000000",
  labor_cost_gap: "90.000000",
  external_workers: [{
    worker_id: 22,
    name: "Rosa externa",
    daily_rate: "120.000000",
    workday_hours: "8.000000",
    hourly_equivalent: "15.000000",
    days_paid: 2,
    commercial_cost: "150.000000",
    real_cost: "240.000000",
  }],
  space_cost_per_hour_snapshot: "17.500000",
  space_cost_per_hour_override: "18.000000",
  effective_space_cost_per_hour: "18.000000",
  passive_time_hours: "24.000000",
  passive_space_suggestion: "420.000000",
  wholesale_threshold: 40,
  total_units: 50,
  wholesale_suggested: true,
  wholesale_suggestion_declined: false,
};

/**
 * El paso «Precio» del rediseño, montado en el shell (010O.10).
 *
 * Lo que se protege: que la única decisión —el factor— se mande una vez y con
 * el valor del rango congelado, que cada cifra sea la del backend en su moneda,
 * y que nada del detalle que el taller consulta se haya perdido.
 */

async function abrirPrecio(opciones: Parameters<typeof mockShell>[0] = {}) {
  const espia = mockShell(opciones);
  renderApp(["/cotizador-v2/7/precio"]);
  const paso = await screen.findByTestId("v2next-paso-precio");
  return { espia, paso: within(paso) };
}

async function abrirPrecio010P(extra?: MockShellOptions["extra"]) {
  const espia = mockShell({ extra: (url, init) => {
    const own = extra?.(url, init);
    if (own) return own;
    if (url.endsWith("/pricing")) return jsonResponse(200, PRICING_010P);
    return undefined;
  } });
  renderApp(["/cotizador-v2/7/precio"]);
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
    expect(paso.queryByTestId("v2next-tiempo-activo")).not.toBeInTheDocument();
    expect(paso.queryByTestId("v2next-wholesale-banner")).not.toBeInTheDocument();
    expect(paso.queryByLabelText("Costo de espacio por hora")).not.toBeInTheDocument();
    expect(paso.getByTestId("v2next-factor-valor")).toHaveTextContent("×3.00");
  });

  it("presenta valores 010P devueltos por backend: tiempo paralelo, mano de obra y espacio", async () => {
    const { paso } = await abrirPrecio010P();
    expect(paso.getByTestId("v2next-tiempo-activo")).toHaveTextContent("6 h");
    expect(paso.getByTestId("v2next-tiempo-activo")).toHaveTextContent(/tramo más largo/);
    expect(paso.getByTestId("v2next-external-workers")).toHaveTextContent("Rosa externa");
    expect(paso.getByTestId("v2next-external-workers")).toHaveTextContent("S/ 150.00");
    expect(paso.getByTestId("v2next-external-workers")).toHaveTextContent("S/ 240.00");
    expect(paso.getByText(/Usando S\/ 18.00/)).toBeInTheDocument();
    expect(paso.getByText(/Sugerencia del sistema: S\/ 420.00/)).toHaveTextContent(/No está incluida automáticamente/);
  });

  it("muestra umbral y envía aceptar wholesale al endpoint W2; traduce warnings", async () => {
    const user = userEvent.setup();
    const warnings = ["V2_WHOLESALE_EXTERNAL_WORKER_MISSING", "V2_WHOLESALE_DEFAULT_WORKER_LACKS_TECHNIQUE"];
    const { espia, paso } = await abrirPrecio010P((url) =>
      url.endsWith("/apply-wholesale-defaults")
        ? jsonResponse(200, { quotation: { ...COTIZACION, production_type: "WHOLESALE" }, warnings })
        : undefined,
    );
    expect(paso.getByTestId("v2next-wholesale-banner")).toHaveTextContent("50 unidades · umbral 40");
    await user.click(paso.getByRole("button", { name: "Aplicar Por mayor" }));

    await waitFor(() => expect(espia.mock.calls.some(([url, init]) => String(url).endsWith("/apply-wholesale-defaults") && init?.method === "POST")).toBe(true));
    expect(await paso.findByText(/No se encontró un trabajador externo/)).toBeInTheDocument();
    expect(paso.getByText(/no tiene habilitada una técnica necesaria/)).toBeInTheDocument();
  });

  it("declina la recomendación por endpoint y oculta el banner cuando el backend la guarda", async () => {
    const user = userEvent.setup();
    let declined = false;
    const { espia, paso } = await abrirPrecio010P((url) => {
      if (url.endsWith("/decline-wholesale-suggestion")) {
        declined = true;
        return jsonResponse(200, { ...COTIZACION, wholesale_suggestion_declined_at: "2026-09-27T12:00:00Z" });
      }
      if (url.endsWith("/pricing")) {
        return jsonResponse(200, { ...PRICING_010P, wholesale_suggested: !declined, wholesale_suggestion_declined: declined });
      }
      return undefined;
    });
    await user.click(paso.getByRole("button", { name: "Mantener como minorista" }));

    await waitFor(() => expect(espia.mock.calls.some(([url, init]) => String(url).endsWith("/decline-wholesale-suggestion") && init?.method === "POST")).toBe(true));
    await waitFor(() => expect(paso.queryByTestId("v2next-wholesale-banner")).not.toBeInTheDocument());
  });
});
