/**
 * Fase 009E en la pantalla: el precio se muestra, no se calcula.
 *
 * El paso «Margen y precio» enseña la cadena entera —base, margen, IGV, bruto
 * crudo, redondeo, bruto final, neto e IGV reconstruidos— y cada número sale
 * tal cual de la respuesta del backend. Estos tests fallan si alguien vuelve a
 * meter aritmética comercial en el cliente: bastaría con que el frontend
 * multiplicara por el margen para que la cotización guardada y la que se ve en
 * pantalla pudieran discrepar en céntimos.
 *
 * Lo único que el usuario decide aquí son dos campos: el margen y el precio
 * manual. Todo lo demás es lectura.
 */

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CotizadorItemCard } from "@/features/cotizador/CotizadorItemCard";
import { emptyCotizadorItem } from "@/features/cotizador/draft";
import type { CotizadorItemDraft } from "@/features/cotizador/draft";
import { renderWithProviders } from "@/test/utils";
import type { QuotationBuilderItemOut } from "@/types/quotationBuilder";

/**
 * El caso canónico del motor, el mismo que fija `test_pricing_math.py`:
 * 10 piezas, costo técnico 100, factor 3, fijos asignados 192, margen 100 %,
 * IGV 18 %, paso 0,50. El bruto crudo cae en 116.112 y el CEILING lo sube a
 * 116.50 — una diferencia que el redondeo al más cercano NO produciría.
 */
const CANONICAL = {
  quantity: 10,
  technical_cost: "100",
  production_factor: "3",
  factored_cost: "300",
  fixed_cost_allocation: "192",
  commercial_base_cost: "492",
  commercial_base_unit_cost: "49.20",
  raw_net_unit: "98.40",
  raw_tax_unit: "17.712",
  raw_gross_unit: "116.112",
  rounding_step: "0.50",
  rounding_adjustment_unit: "0.39",
  final_gross_unit: "116.50",
  final_net_unit: "98.73",
  final_tax_unit: "17.77",
  line_total_gross: "1165.00",
  line_total_net: "987.30",
  line_total_tax: "177.70",
  tax_percentage_snapshot: "18",
  markup_percent: "100",
};

const previewOut = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 1,
    product_id: 42,
    product_internal_reference: "LAB50042",
    product_name: "Plato palta QA",
    product_type: "FINISHED_PRODUCT",
    product_uom: "unit",
    product_grammage: "500",
    editable_dimensions: [],
    dimensions_overridden: false,
    recipe_auto_selected: false,
    production_snapshot: {},
    glaze_plan: null,
    glaze_unit: "g",
    glaze_selection_touched: false,
    techniques: [],
    additionals: [],
    other_costs: [],
    materials_calculated: "0",
    materials_applied: "40",
    firing_cost: "50",
    labor_cost: "10",
    calculated_days: 0,
    days_adjustment: 0,
    waiting_days: 0,
    total_days: 0,
    space_cost: "192",
    final_unit_cost: "10",
    final_total_cost: "100",
    calculated_sale_unit_price: "0",
    suggested_commercial_unit_price: "98.73",
    commercial_sale_unit_price: "98.73",
    effective_profit_unit: "0",
    effective_profit_total: "0",
    effective_markup_percent: "0",
    commercial_subtotal: "987.30",
    commercial_unit_price_with_tax: "116.50",
    commercial_total: "1165.00",
    tax_rate_source_snapshot: "COMMERCIAL_SETTINGS",
    tax_amount: "177.70",
    source_fingerprint: "f".repeat(64),
    warnings: [],
    complete: true,
    sort_order: 0,
    ...CANONICAL,
    ...overrides,
  }) as unknown as QuotationBuilderItemOut;

const draft = (overrides: Partial<CotizadorItemDraft> = {}): CotizadorItemDraft => ({
  ...emptyCotizadorItem(),
  productId: "42",
  quantity: "10",
  markupPercent: "100",
  ...overrides,
});

function renderCard(
  preview: QuotationBuilderItemOut | undefined,
  item: CotizadorItemDraft = draft(),
  disabled = false,
  mode: "MARGIN" | "SUMMARY" = "MARGIN",
) {
  const onChange = vi.fn();
  renderWithProviders(
    <CotizadorItemCard
      item={item}
      index={0}
      mode={mode}
      preview={preview}
      disabled={disabled}
      excludedProductIds={[]}
      onChange={onChange}
      onRemove={vi.fn()}
    />,
  );
  return onChange;
}

describe("Margen y precio · la cadena comercial del backend", () => {
  it("RAW_GROSS_RENDER: enseña el bruto ANTES de redondear", async () => {
    renderCard(previewOut());
    // 116.112 se muestra a dos decimales, pero es el crudo, no el final.
    expect(await screen.findByText("S/ 116.11")).toBeInTheDocument();
  });

  it("FINAL_GROSS_RENDER: y el precio de contrato después del redondeo", async () => {
    renderCard(previewOut());
    expect(await screen.findByText("S/ 116.50")).toBeInTheDocument();
  });

  it("ROUNDING_DIFFERENCE_RENDER: la política y lo que añadió son visibles", async () => {
    renderCard(previewOut());
    // «Hacia arriba», no «al más cercano»: es la diferencia que 009E introduce.
    expect(await screen.findByText(/Hacia arriba a S\/ 0\.50/)).toBeInTheDocument();
    expect(screen.getByText(/Suma S\/ 0\.39/)).toBeInTheDocument();
  });

  it("COSTEO_BACKEND_VALUES_RENDER: base, IGV y neto crudo vienen del backend", async () => {
    renderCard(previewOut());
    expect(await screen.findByText("S/ 49.20")).toBeInTheDocument();
    expect(screen.getByText("18.00 %")).toBeInTheDocument();
    expect(screen.getByText("S/ 98.40")).toBeInTheDocument();
  });

  it("RECONSTRUCTED_NET_TAX_RENDER: el neto y el IGV finales suman el bruto", async () => {
    renderCard(previewOut());
    expect(await screen.findByText("S/ 98.73")).toBeInTheDocument();
    expect(screen.getByText("S/ 17.77")).toBeInTheDocument();
    // 98.73 + 17.77 = 116.50, que es justo el bruto final que se muestra.
    expect(screen.getByText("S/ 116.50")).toBeInTheDocument();
  });

  it("TOTAL_FROM_BACKEND: el total de la línea es el del backend, no cantidad × precio", async () => {
    // El backend manda un total que NO es 116.50 × 10. Si el frontend
    // multiplicara por su cuenta, aquí aparecería 1165.00 en su lugar.
    renderCard(previewOut({ line_total_gross: "9999.99" }));
    expect(await screen.findByText("S/ 9999.99")).toBeInTheDocument();
  });

  it("CEILING_100_RENDER: con paso 1,00 el texto cambia con la política", async () => {
    renderCard(
      previewOut({
        rounding_step: "1.00",
        raw_gross_unit: "142.01",
        final_gross_unit: "143.00",
        rounding_adjustment_unit: "0.99",
      }),
    );
    expect(await screen.findByText(/Hacia arriba a S\/ 1\.00/)).toBeInTheDocument();
    expect(screen.getByText("S/ 143.00")).toBeInTheDocument();
  });

  it("HISTORIC_CEILING_CASE: 388.50 se queda igual al más cercano y sube a 389.00 con CEILING", async () => {
    renderCard(
      previewOut({
        rounding_step: "1.00",
        raw_gross_unit: "388.50",
        final_gross_unit: "389.00",
        rounding_adjustment_unit: "0.50",
      }),
    );
    expect(await screen.findByText("S/ 388.50")).toBeInTheDocument();
    expect(screen.getByText("S/ 389.00")).toBeInTheDocument();
  });
});

describe("Margen y precio · lo que el usuario decide", () => {
  it("MARGIN_PER_PRODUCT_EDIT: el margen es editable y viaja como texto", async () => {
    const onChange = renderCard(previewOut(), draft({ markupPercent: "" }));
    const campo = await screen.findByLabelText(/Margen \/ markup/i);
    await userEvent.type(campo, "5");
    expect(onChange).toHaveBeenCalled();
    // Se manda tal cual; el porcentaje lo aplica el backend.
    expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({ markupPercent: "5" });
  });

  it("MANUAL_PRICE_PERSISTS: el precio manual escrito se conserva en el borrador", async () => {
    const onChange = renderCard(previewOut());
    const campo = await screen.findByLabelText(/Precio neto manual/i);
    await userEvent.type(campo, "9");
    expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({ commercialSaleUnitPrice: "9" });
  });

  it("MANUAL_PRICE_OVERRIDES_MARKUP: se avisa de que reemplaza al margen", async () => {
    renderCard(previewOut(), draft({ commercialSaleUnitPrice: "120.00" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/reemplaza al margen/i);
  });

  it("MANUAL_PRICE_STILL_ROUNDED: el aviso dice que igual pasa por IGV y redondeo", async () => {
    // Es lo que el backend ya garantiza y la pantalla no puede contradecir:
    // un precio manual no se salta el redondeo contractual.
    const aviso = await (async () => {
      renderCard(previewOut(), draft({ commercialSaleUnitPrice: "120.00" }));
      return screen.findByRole("status");
    })();
    expect(aviso).toHaveTextContent(/IGV/);
    expect(aviso).toHaveTextContent(/redondeo contractual/i);
  });

  it("volver al margen limpia el precio manual", async () => {
    const onChange = renderCard(previewOut(), draft({ commercialSaleUnitPrice: "120.00" }));
    await userEvent.click(await screen.findByRole("button", { name: /Volver al margen/i }));
    expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({ commercialSaleUnitPrice: "" });
  });

  it("CONFIRMED_READONLY: en solo lectura no hay edición ni botón de volver", async () => {
    renderCard(previewOut(), draft({ commercialSaleUnitPrice: "120.00" }), true);
    expect(await screen.findByLabelText(/Margen \/ markup/i)).toBeDisabled();
    expect(screen.getByLabelText(/Precio neto manual/i)).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Volver al margen/i })).not.toBeInTheDocument();
  });
});

describe("Margen y precio · autoridad y mensajes", () => {
  it("RAW_DOMAIN_CODES_NOT_VISIBLE: un aviso llega traducido, nunca como código", async () => {
    renderCard(previewOut({ warnings: ["FIRING_REQUIRED"], complete: false }), draft(), false, "SUMMARY");
    expect(await screen.findByText(/quema baja o una quema alta/i)).toBeInTheDocument();
    expect(screen.queryByText("FIRING_REQUIRED")).not.toBeInTheDocument();
  });

  it("UNKNOWN_ERROR_SAFE_FALLBACK: un código fuera del catálogo no se pinta", async () => {
    renderCard(previewOut({ warnings: ["ALGO_QUE_NO_EXISTE"], complete: false }), draft(), false, "SUMMARY");
    expect(await screen.findByText("S/ 116.50")).toBeInTheDocument();
    expect(screen.queryByText("ALGO_QUE_NO_EXISTE")).not.toBeInTheDocument();
  });

  it("FRONT_COMMERCIAL_TOTAL_AUTHORITY: sin respuesta no se inventa ningún importe", async () => {
    renderCard(undefined);
    // Cada casilla queda en guión: un hueco honesto es mejor que un cero que
    // se lee como un precio real.
    expect((await screen.findAllByText("S/ —")).length).toBeGreaterThan(0);
    expect(screen.queryByText("S/ 0.00")).not.toBeInTheDocument();
  });
});
