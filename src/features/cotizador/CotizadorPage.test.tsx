import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  csrfResponse,
  errorResponse,
  jsonResponse,
  mockFetch,
  renderApp,
  sessionResponse,
} from "@/test/utils";
import type { Product } from "@/types/masters";
import type { QuotationBuilderOut } from "@/types/quotationBuilder";

const product: Product = {
  id: 42,
  internal_reference: "LAB50042",
  name: "Plato palta QA",
  product_type: "FINISHED_PRODUCT",
  product_category_id: 1,
  product_category_path: "Piezas",
  pos_category_id: null,
  pos_category_name: null,
  base_uom_code: "unit",
  purchase_uom_code: null,
  cost: null,
  sale_price: null,
  sale_tax_rate: null,
  purchase_tax_rate: null,
  material: "Gres",
  grammage: "420",
  width: "20",
  height: null,
  length: "20",
  depth: null,
  sellable: true,
  purchasable: false,
  available_in_pos: true,
  active: true,
  notes: null,
};
const secondProduct: Product = { ...product, id: 43, internal_reference: "LAB50043", name: "Bowl mediano", width: "18", length: "18" };

function itemOut(input: Record<string, unknown>, index: number) {
  const productId = Number(input.product_id);
  const selected = productId === secondProduct.id ? secondProduct : product;
  const dimensions = (input.dimensions ?? {}) as Record<string, string>;
  const quantity = typeof input.quantity === "number" ? input.quantity : null;
  const grams = typeof input.material_grams_per_piece === "string" ? input.material_grams_per_piece : null;
  return {
    id: null,
    product_id: productId,
    product_internal_reference: selected.internal_reference,
    product_name: selected.name,
    product_type: selected.product_type,
    product_uom: selected.base_uom_code,
    product_material: selected.material ?? null,
    product_grammage: selected.grammage == null ? null : String(selected.grammage),
    width: dimensions.width ?? String(selected.width),
    height: dimensions.height ?? null,
    length: dimensions.length ?? String(selected.length),
    depth: dimensions.depth ?? null,
    editable_dimensions: ["height", "depth"] as Array<"height" | "depth">,
    quantity,
    recipe_id: null,
    recipe_version_id: null,
    recipe_version_fingerprint_snapshot: null,
    recipe_auto_selected: false,
    material_grams_per_piece: grams,
    kiln_id: null,
    production_snapshot: {},
    techniques: [],
    additionals: [],
    other_costs: [],
    materials_calculated: "18.40",
    materials_applied: "18.40",
    firing_cost: "96",
    labor_cost: "48",
    calculated_days: 2,
    days_adjustment: 0,
    waiting_days: 0,
    total_days: 2,
    space_cost: "30",
    final_unit_cost: "16.02",
    final_total_cost: "384.48",
    markup_percent: String(input.markup_percent ?? "100"),
    calculated_sale_unit_price: "32.04",
    suggested_commercial_unit_price: "32.10",
    commercial_sale_unit_price: String(input.commercial_sale_unit_price ?? "32.10"),
    effective_profit_unit: "16.08",
    effective_profit_total: "385.92",
    effective_markup_percent: "100.37",
    commercial_subtotal: "770.40",
    tax_percentage_snapshot: "18",
    tax_rate_source_snapshot: "COMMERCIAL_SETTINGS",
    tax_amount: "138.672",
    source_fingerprint: "i".repeat(64),
    warnings: [],
    complete: Boolean(quantity && grams),
    sort_order: index,
  };
}

function builder(overrides: Partial<QuotationBuilderOut> = {}): QuotationBuilderOut {
  return {
    id: null,
    code: null,
    workflow: "COTIZADOR",
    status: "DRAFT",
    name: null,
    customer_id: null,
    customer_name_snapshot: null,
    kiln_id: null,
    kiln_snapshot: {},
    production_summary: {},
    items: [],
    item_count: 0,
    commercial_subtotal: "0",
    tax_percentage_snapshot: "18",
    tax_rate_source_snapshot: "COMMERCIAL_SETTINGS",
    tax_amount: "0",
    total_with_tax: "0",
    currency_code_snapshot: "PEN",
    currency_symbol_snapshot: "S/",
    warnings: ["QUOTATION_NAME_REQUIRED", "CUSTOMER_REQUIRED"],
    complete: false,
    next_step: "GENERAL_DATA",
    source_fingerprint: "q".repeat(64),
    created_at: null,
    updated_at: null,
    confirmed_at: null,
    cancelled_at: null,
    ...overrides,
  };
}

function handler(url: string, init: RequestInit) {
  if (url.includes("/auth/me")) return sessionResponse();
  if (url.includes("/auth/csrf")) return csrfResponse();
  if (url.includes("/partners")) return jsonResponse(200, { items: [], total: 0, limit: 100, offset: 0 });
  if (url.includes("/products")) return jsonResponse(200, { items: [product, secondProduct], total: 2, limit: 50, offset: 0 });
  if (url.includes("/techniques") || url.includes("/additionals") || url.includes("/other-costs")) return jsonResponse(200, { items: [], total: 0, limit: 200, offset: 0 });
  if (url.includes("/quotation-builder/preview") && init.method === "POST") {
    const body = JSON.parse(String(init.body)) as { name?: string; customer_id?: number; items?: Array<Record<string, unknown>>; kiln_id?: number };
    const items = (body.items ?? []).map(itemOut);
    const complete = Boolean(body.name && body.customer_id && body.kiln_id && items.length && items.every((item) => item.complete));
    return jsonResponse(200, builder({
      name: body.name ?? null,
      customer_id: body.customer_id ?? null,
      items,
      item_count: items.length,
      kiln_id: body.kiln_id ?? null,
      commercial_subtotal: items.length ? "770.40" : "0",
      tax_amount: items.length ? "138.672" : "0",
      total_with_tax: items.length ? "909.072" : "0",
      complete,
      next_step: complete ? "SUMMARY" : "PRODUCTION",
    }));
  }
  if (url.endsWith("/quotation-builder") && init.method === "POST") return jsonResponse(201, builder({ id: 81, code: "CTZ-2026-000081", created_at: "2026-08-24T12:00:00Z", updated_at: "2026-08-24T12:00:00Z" }));
  return errorResponse(404, "NOT_FOUND");
}

describe("Cotizador integral", () => {
  it("expone seis etapas separadas de Cotizaciones y sólo solicita preview al backend", async () => {
    const fetchSpy = mockFetch(handler);
    const { container } = renderApp(["/cotizador/nuevo"]);

    expect(await screen.findByRole("heading", { name: "Nuevo cotizador." })).toBeInTheDocument();
    for (const step of ["Datos", "Piezas", "Producción", "Costeo", "Margen y precio", "Resumen"]) {
      expect(screen.getByRole("button", { name: new RegExp(step, "i") })).toBeInTheDocument();
    }
    await waitFor(() => expect(fetchSpy.mock.calls.some(([url]) => String(url).includes("/quotation-builder/preview"))).toBe(true));
    expect(fetchSpy.mock.calls.some(([url]) => String(url).includes("/firings/calculate"))).toBe(false);
    expect(container.querySelectorAll("select")).toHaveLength(0);
  });

  it("permite agregar una pieza y bloquea dimensiones ya definidas en el maestro", async () => {
    const user = userEvent.setup();
    mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);

    await screen.findByRole("heading", { name: "Nuevo cotizador." });
    await user.click(screen.getByRole("button", { name: /Piezas/i }));
    await user.click(screen.getByRole("button", { name: /Agregar producto/i }));
    await user.click(screen.getByRole("combobox", { name: "Pieza terminada" }));
    await user.click(await screen.findByText("Plato palta QA"));

    expect(screen.getByRole("combobox", { name: "Pieza terminada" })).toHaveTextContent("LAB50042 · Plato palta QA");
    expect(await screen.findByLabelText(/Ancho \(cm\)/i)).toBeDisabled();
    expect(screen.getByLabelText(/Largo \(cm\)/i)).toBeDisabled();
    expect(screen.getByLabelText(/Alto \(cm\)/i)).toBeEnabled();
    expect(screen.getByLabelText(/Profundidad \(cm\)/i)).toBeEnabled();
    expect(screen.getByText(/Sólo se habilitan datos ausentes/i)).toBeInTheDocument();
  });

  it("crea un DRAFT progresivo mediante el endpoint dedicado", async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);

    await screen.findByRole("heading", { name: "Nuevo cotizador." });
    await user.click(screen.getByRole("button", { name: "Crear borrador" }));
    await waitFor(() => expect(fetchSpy.mock.calls.some(([url, init]) => String(url).endsWith("/quotation-builder") && (init as RequestInit).method === "POST")).toBe(true));
    expect(await screen.findByRole("heading", { name: "CTZ-2026-000081" })).toBeInTheDocument();

    const createCall = fetchSpy.mock.calls.find(([url, init]) => String(url).endsWith("/quotation-builder") && (init as RequestInit).method === "POST");
    expect(createCall).toBeTruthy();
    expect(JSON.parse(String((createCall?.[1] as RequestInit).body))).toMatchObject({ items: [] });
  });

  it("administra múltiples piezas y conserva markup y precio por producto en el payload", async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetch(handler);
    renderApp(["/cotizador/nuevo"]);

    await screen.findByRole("heading", { name: "Nuevo cotizador." });
    await user.click(screen.getByRole("button", { name: /Piezas/i }));
    await user.click(screen.getByRole("button", { name: /Agregar producto/i }));
    await user.click(screen.getByRole("combobox", { name: "Pieza terminada" }));
    await user.click(await screen.findByText("Plato palta QA"));
    await user.click(screen.getByRole("button", { name: /Agregar producto/i }));
    const pieceSelectors = screen.getAllByRole("combobox", { name: "Pieza terminada" });
    await user.click(pieceSelectors[1]!);
    await user.click(await screen.findByText("Bowl mediano"));
    expect(screen.getAllByText("LAB50042 · Plato palta QA").length).toBeGreaterThan(0);
    expect(screen.getAllByText("LAB50043 · Bowl mediano").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /Margen y precio/i }));
    const markups = screen.getAllByLabelText(/Markup/i);
    const prices = screen.getAllByLabelText(/Precio comercial unitario/i);
    await user.clear(markups[0]!);
    await user.type(markups[0]!, "120");
    await user.clear(markups[1]!);
    await user.type(markups[1]!, "80");
    await user.type(prices[0]!, "35.50");
    await user.type(prices[1]!, "28.90");

    await waitFor(() => {
      const previews = fetchSpy.mock.calls.filter(([url]) => String(url).includes("/quotation-builder/preview"));
      const lastBody = JSON.parse(String((previews.at(-1)?.[1] as RequestInit | undefined)?.body)) as { items: Array<Record<string, unknown>> };
      expect(lastBody.items).toHaveLength(2);
      expect(lastBody.items[0]).toMatchObject({ markup_percent: "120", commercial_sale_unit_price: "35.50" });
      expect(lastBody.items[1]).toMatchObject({ markup_percent: "80", commercial_sale_unit_price: "28.90" });
    });

    await user.click(screen.getByRole("button", { name: /Piezas/i }));
    await user.click(screen.getAllByRole("button", { name: "Quitar" })[0]!);
    expect(screen.queryAllByText("LAB50042 · Plato palta QA")).toHaveLength(0);
    expect(screen.getAllByText("LAB50043 · Bowl mediano").length).toBeGreaterThan(0);
  });

  it("reabre, confirma con versión esperada y bloquea la edición posterior", async () => {
    const user = userEvent.setup();
    const updatedAt = "2026-08-24T12:00:00Z";
    const saved = builder({
      id: 81,
      code: "CTZ-2026-000081",
      name: "Vajilla agosto",
      customer_id: 7,
      customer_name_snapshot: "Restaurante Lima",
      kiln_id: 3,
      items: [itemOut({ product_id: 42, quantity: 24, material_grams_per_piece: "450", markup_percent: "120", commercial_sale_unit_price: "35.50" }, 0)],
      item_count: 1,
      complete: true,
      next_step: "SUMMARY",
      created_at: updatedAt,
      updated_at: updatedAt,
    });
    const fetchSpy = mockFetch((url, init) => {
      if (url.includes("/quotation-builder/81/confirm") && init.method === "POST") {
        return jsonResponse(200, { ...saved, status: "CONFIRMED", confirmed_at: "2026-08-24T13:00:00Z" });
      }
      if (url.includes("/quotation-builder/81") && init.method === "GET") return jsonResponse(200, saved);
      return handler(url, init);
    });
    renderApp(["/cotizador/81"]);

    expect(await screen.findByRole("heading", { name: "CTZ-2026-000081" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Resumen/i }));
    const confirmButton = await screen.findByRole("button", { name: "Confirmar cotización" });
    await waitFor(() => expect(confirmButton).toBeEnabled());
    await user.click(confirmButton);
    expect(await screen.findByText("Confirmada")).toBeInTheDocument();

    const confirmCall = fetchSpy.mock.calls.find(([url]) => String(url).includes("/quotation-builder/81/confirm"));
    expect(JSON.parse(String((confirmCall?.[1] as RequestInit).body))).toEqual({ expected_updated_at: updatedAt });
    expect(screen.queryByRole("button", { name: /Guardar borrador/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Datos/i }));
    expect(screen.getByLabelText(/Nombre \/ referencia/i)).toBeDisabled();
  });

  it("mantiene el snapshot inmutable y reinicia el estado al navegar a un alta nueva", async () => {
    const user = userEvent.setup();
    const saved = builder({
      id: 81,
      code: "CTZ-2026-000081",
      status: "CONFIRMED",
      name: "Snapshot confirmado",
      customer_id: 7,
      customer_name_snapshot: "Restaurante Lima",
      commercial_subtotal: "1000",
      tax_amount: "180",
      total_with_tax: "1180",
      complete: true,
      next_step: "SUMMARY",
      created_at: "2026-08-24T12:00:00Z",
      updated_at: "2026-08-24T12:00:00Z",
      confirmed_at: "2026-08-24T13:00:00Z",
    });
    const fetchSpy = mockFetch((url, init) => {
      if (url.includes("/quotation-builder/81") && init.method === "GET") {
        return jsonResponse(200, saved);
      }
      return handler(url, init);
    });
    renderApp(["/cotizador/81"]);

    expect(await screen.findByRole("heading", { name: "CTZ-2026-000081" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Resumen/i }));
    expect(screen.getByText(/1180\.00/)).toBeInTheDocument();
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    expect(
      fetchSpy.mock.calls.some(([url]) => String(url).includes("/quotation-builder/preview")),
    ).toBe(false);

    await user.click(screen.getByRole("link", { name: "Cotizador" }));
    expect(await screen.findByRole("heading", { name: "Nuevo cotizador." })).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre \/ referencia/i)).toBeEnabled();
    expect(screen.getByLabelText(/Nombre \/ referencia/i)).toHaveValue("");
    expect(screen.getByRole("button", { name: "Crear borrador" })).toBeInTheDocument();
  });
});
