import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  csrfResponse,
  errorResponse,
  jsonResponse,
  mockFetch,
  renderApp,
  sessionResponse,
} from "@/test/utils";
import type { Product, StockBalance } from "@/types/masters";
import type { QuotationSummaryOut } from "@/types/quotations";

const mockQuoteConfirmed: QuotationSummaryOut = {
  id: 18,
  code: "CTZ-2026-0018",
  name: "Cotización Jarra",
  status: "CONFIRMED",
  customer_id: 1,
  customer_name: "Cerámicas del Sur",
  customer_document_number: "20123456789",
  workflow: "COTIZADOR",
  item_count: 2,
  product_id: null,
  product_internal_reference: null,
  product_name: "2 productos",
  quantity: 10,
  calculated_unit_price: "85.00",
  calculated_total: "850.00",
  final_unit_cost: "85.00",
  commercial_sale_unit_price: "85.00",
  commercial_total: "850.00",
  total_with_tax: "850.00",
  total: "850.00",
  created_at: new Date().toISOString(),
};

const mockQuoteDraft: QuotationSummaryOut = {
  id: 14,
  code: "CTZ-2026-0014",
  name: "Cotización Plato",
  status: "DRAFT",
  customer_id: 2,
  customer_name: "Diseños Modernos",
  customer_document_number: "20987654321",
  workflow: "COTIZADOR",
  item_count: 1,
  product_id: null,
  product_internal_reference: null,
  product_name: "1 producto",
  quantity: 5,
  calculated_unit_price: "196.00",
  calculated_total: "980.00",
  final_unit_cost: "196.00",
  commercial_sale_unit_price: "196.00",
  commercial_total: "980.00",
  total_with_tax: "980.00",
  total: "980.00",
  created_at: new Date().toISOString(),
};

const mockProductIncomplete: Product = {
  id: 101,
  internal_reference: "ART-001",
  name: "Jarra Artesanal",
  product_type: "FINISHED_PRODUCT",
  product_category_id: 1,
  product_category_path: "Cerámica",
  pos_category_id: null,
  pos_category_name: null,
  base_uom_code: "unit",
  purchase_uom_code: null,
  cost: "15.00",
  sale_price: "45.00",
  sale_tax_rate: "0.18",
  purchase_tax_rate: null,
  width: null, // falta medida
  height: null, // falta medida
  length: null,
  depth: null,
  grammage: null,
  sellable: true,
  purchasable: false,
  available_in_pos: true,
  active: true,
  notes: null,
};

const mockStockLow: StockBalance = {
  product_id: 101,
  internal_reference: "ART-001",
  product_name: "Jarra Artesanal",
  location_id: 1,
  location_name: "Almacén Principal",
  uom_code: "unit",
  quantity: "0",
};

function defaultDashboardHandler(url: string) {
  if (url.includes("/auth/me")) return sessionResponse();
  if (url.includes("/auth/csrf")) return csrfResponse();
  if (url.includes("/quotations")) {
    // El stub respeta `status`, como hace el backend real. Sin esto, cada
    // contador leeria el mismo `total` y el test no distinguiria "cuenta el
    // backend" de "cuenta la pagina".
    if (url.includes("status=CONFIRMED")) {
      return jsonResponse(200, { items: [mockQuoteConfirmed], total: 1, limit: 200, offset: 0 });
    }
    if (url.includes("status=DRAFT")) {
      return jsonResponse(200, { items: [mockQuoteDraft], total: 1, limit: 1, offset: 0 });
    }
    return jsonResponse(200, {
      items: [mockQuoteConfirmed, mockQuoteDraft],
      total: 2,
      limit: 100,
      offset: 0,
    });
  }
  if (url.includes("/products")) {
    return jsonResponse(200, {
      items: [mockProductIncomplete],
      total: 1,
      limit: 100,
      offset: 0,
    });
  }
  if (url.includes("/inventory")) {
    return jsonResponse(200, {
      items: [mockStockLow],
      total: 1,
      limit: 50,
      offset: 0,
    });
  }
  if (url.includes("/partners")) {
    return jsonResponse(200, {
      items: [
        {
          id: 1,
          name: "Cerámicas del Sur",
          role: "CLIENT",
          document_type: "RUC",
          document_number: "20123456789",
          active: true,
        },
      ],
      total: 1,
      limit: 10,
      offset: 0,
    });
  }
  return errorResponse(404, "NOT_FOUND");
}

describe("Dashboard Operativo de Inicio (HomePage)", () => {
  it("renderiza el header con título, subtítulo y botón a Cotizador", async () => {
    mockFetch(defaultDashboardHandler);
    renderApp(["/"]);

    expect(await screen.findByRole("heading", { name: "Inicio." })).toBeInTheDocument();
    expect(screen.getByText("Resumen general del taller.")).toBeInTheDocument();

    const newQuoteBtn = screen.getByRole("link", { name: /nueva cotización/i });
    expect(newQuoteBtn).toBeInTheDocument();
    expect(newQuoteBtn).toHaveAttribute("href", "/cotizador/nuevo");
  });

  it("calcula y muestra los 4 KPIs operacionales con datos reales", async () => {
    mockFetch(defaultDashboardHandler);
    renderApp(["/"]);

    expect(await screen.findByText("CTZ-2026-0018")).toBeInTheDocument();
    const metricsSection = screen.getByLabelText("Métricas del taller");
    expect(metricsSection).toBeInTheDocument();

    // 2 cotizaciones en total este mes
    expect(within(metricsSection).getByText("Cotizaciones este mes")).toBeInTheDocument();
    expect(within(metricsSection).getByText("2")).toBeInTheDocument();

    // 1 confirmada y 1 borrador
    expect(within(metricsSection).getByText("Confirmadas")).toBeInTheDocument();
    expect(within(metricsSection).getByText("Borradores pendientes")).toBeInTheDocument();
    expect(within(metricsSection).getAllByText("1").length).toBe(2);

    // S/ 850.00 confirmado
    expect(within(metricsSection).getByText("Total cotizado (mes)")).toBeInTheDocument();
    expect(within(metricsSection).getByText(/S\/\s*850[.,]00/)).toBeInTheDocument();
  });

  it("los contadores salen del `total` del backend, no del tamano de la pagina", async () => {
    // Reproduce produccion: 229 cotizaciones, de las que el endpoint devuelve
    // como mucho una pagina. Antes se contaba `items.length` y el panel se
    // quedaba clavado en el limite de la pagina por muchas que hubiera.
    const page = Array.from({ length: 100 }, (_, i) => ({
      ...mockQuoteDraft,
      id: 1000 + i,
      code: `CTZ-2026-00${1000 + i}`,
    }));
    mockFetch((url) => {
      if (url.includes("/auth/me")) return sessionResponse();
      if (url.includes("/auth/csrf")) return csrfResponse();
      if (url.includes("/quotations")) {
        if (url.includes("status=CONFIRMED")) {
          return jsonResponse(200, { items: [], total: 0, limit: 200, offset: 0 });
        }
        if (url.includes("status=DRAFT")) {
          return jsonResponse(200, { items: [mockQuoteDraft], total: 187, limit: 1, offset: 0 });
        }
        return jsonResponse(200, { items: page, total: 229, limit: 100, offset: 0 });
      }
      if (url.includes("/products")) return jsonResponse(200, { items: [], total: 0, limit: 100, offset: 0 });
      if (url.includes("/inventory")) return jsonResponse(200, { items: [], total: 0, limit: 50, offset: 0 });
      if (url.includes("/partners")) return jsonResponse(200, { items: [], total: 0, limit: 10, offset: 0 });
      return errorResponse(404, "NOT_FOUND");
    });
    renderApp(["/"]);

    const metricsSection = await screen.findByLabelText("Métricas del taller");
    // 229, no 100.
    expect(await within(metricsSection).findByText("229")).toBeInTheDocument();
    // 187 borradores, no 1 (que es lo que trae la pagina de `limit: 1`).
    expect(await within(metricsSection).findByText("187")).toBeInTheDocument();
    expect(within(metricsSection).queryByText("100")).not.toBeInTheDocument();
  });

  it("el importe del mes recorre TODAS las paginas, no solo la primera", async () => {
    // 250 confirmadas de S/ 10 cada una en un endpoint que entrega 200 por
    // pagina. Quedarse en la primera daria S/ 2000: el mismo truncamiento que
    // tenian los contadores, solo que en soles.
    const CONFIRMED_TOTAL = 250;
    const PAGE_SIZE = 200;
    const confirmed = Array.from({ length: CONFIRMED_TOTAL }, (_, i) => ({
      ...mockQuoteConfirmed,
      id: 5000 + i,
      code: `CTZ-2026-01${5000 + i}`,
      commercial_total: "10.00",
      total_with_tax: "10.00",
      total: "10.00",
      created_at: new Date().toISOString(),
    }));
    const pageRequests: number[] = [];

    mockFetch((url) => {
      if (url.includes("/auth/me")) return sessionResponse();
      if (url.includes("/auth/csrf")) return csrfResponse();
      if (url.includes("/quotations")) {
        if (url.includes("status=CONFIRMED")) {
          const offset = Number(new URL(url, "http://x").searchParams.get("offset") ?? 0);
          pageRequests.push(offset);
          return jsonResponse(200, {
            items: confirmed.slice(offset, offset + PAGE_SIZE),
            total: CONFIRMED_TOTAL,
            limit: PAGE_SIZE,
            offset,
          });
        }
        if (url.includes("status=DRAFT")) {
          return jsonResponse(200, { items: [], total: 0, limit: 1, offset: 0 });
        }
        return jsonResponse(200, { items: [], total: CONFIRMED_TOTAL, limit: 1, offset: 0 });
      }
      if (url.includes("/products")) return jsonResponse(200, { items: [], total: 0, limit: 100, offset: 0 });
      if (url.includes("/inventory")) return jsonResponse(200, { items: [], total: 0, limit: 50, offset: 0 });
      if (url.includes("/partners")) return jsonResponse(200, { items: [], total: 0, limit: 10, offset: 0 });
      return errorResponse(404, "NOT_FOUND");
    });
    renderApp(["/"]);

    const metricsSection = await screen.findByLabelText("Métricas del taller");
    // 250 x 10 = 2500, no 2000.
    expect(await within(metricsSection).findByText(/S\/\s*2[.,]?500[.,]00/)).toBeInTheDocument();
    // Y se pidieron las dos paginas del mes actual.
    expect(pageRequests).toContain(0);
    expect(pageRequests).toContain(PAGE_SIZE);
  });

  it("suma el total que resuelve el backend, sin elegir entre campos", async () => {
    // Fase 009E: el caso que motivo este test —CTZ-2026-000001, con
    // commercial_total en el Decimal-cero que Python serializa como "0E-18"
    // tapando un total_with_tax real— ya NO se decide aqui. Lo resuelve
    // `_summary_total` en el backend y tiene su propia prueba alli.
    //
    // Lo que se comprueba ahora es lo contrario de lo que se comprobaba
    // antes: que el dashboard NO mira los otros campos. Por eso el fixture
    // deja los tres en cero y solo `total` trae el importe: si quedara
    // cualquier resto de la cascada, el KPI mostraria cero.
    const { workflow: _workflow, ...sinWorkflow } = mockQuoteConfirmed;
    const legacyQuote: QuotationSummaryOut = {
      ...sinWorkflow,
      id: 1,
      code: "CTZ-2026-000001",
      customer_id: null,
      customer_name: null,
      commercial_total: "0E-18",
      total_with_tax: "0E-18",
      calculated_total: "0E-18",
      total: "20267.70",
      created_at: new Date().toISOString(),
    };
    mockFetch((url) => {
      if (url.includes("/quotations")) {
        return jsonResponse(200, {
          items: [legacyQuote],
          total: 1,
          limit: 100,
          offset: 0,
        });
      }
      return defaultDashboardHandler(url);
    });
    renderApp(["/"]);

    const metricsSection = await screen.findByLabelText("Métricas del taller");
    expect(
      await within(metricsSection).findByText(/S\/\s*20[.,]267[.,]70/),
    ).toBeInTheDocument();
  });

  it("renderiza la tabla de cotizaciones recientes con navegación a detalle", async () => {
    mockFetch(defaultDashboardHandler);
    renderApp(["/"]);

    expect(await screen.findByText("CTZ-2026-0018")).toBeInTheDocument();
    expect(screen.getByText("Cotizaciones recientes")).toBeInTheDocument();
    expect(screen.getByText("Cerámicas del Sur")).toBeInTheDocument();
    expect(screen.getByText("CTZ-2026-0014")).toBeInTheDocument();
    expect(screen.getByText("Diseños Modernos")).toBeInTheDocument();

    const verTodasLinks = screen.getAllByRole("link", { name: /ver todas/i });
    expect(verTodasLinks[0]).toHaveAttribute("href", "/cotizaciones");
  });

  it("muestra alertas operacionales de borradores, productos sin medida y stock bajo", async () => {
    mockFetch(defaultDashboardHandler);
    renderApp(["/"]);

    expect(await screen.findByText("CTZ-2026-0018")).toBeInTheDocument();
    expect(screen.getByText("Pendientes / Alertas")).toBeInTheDocument();
    expect(await screen.findByText(/1 borrador/i)).toBeInTheDocument();
    expect(screen.getByText("Cotizaciones sin finalizar")).toBeInTheDocument();

    expect(await screen.findByText(/1 producto sin medida/i)).toBeInTheDocument();
    expect(screen.getByText("Completar dimensiones")).toBeInTheDocument();

    expect(await screen.findByText(/1 alerta de stock/i)).toBeInTheDocument();
    expect(screen.getByText(/stock mínimo o agotado/i)).toBeInTheDocument();
  });

  it("renderiza actividad reciente y accesos rápidos secundarios", async () => {
    mockFetch(defaultDashboardHandler);
    renderApp(["/"]);

    expect(await screen.findByText("CTZ-2026-0018")).toBeInTheDocument();
    expect(screen.getByText("Actividad reciente")).toBeInTheDocument();
    expect(await screen.findByText(/Cotización CTZ-2026-0018 confirmada/i)).toBeInTheDocument();

    const quickSection = screen.getByLabelText("Accesos rápidos");
    expect(quickSection).toBeInTheDocument();
    const links = quickSection.querySelectorAll("a");
    const hrefs = Array.from(links).map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/cotizador/nuevo");
    expect(hrefs).toContain("/productos");
    expect(hrefs).toContain("/terceros");
    expect(hrefs).toContain("/cotizaciones");
  });

  it("muestra estados vacíos y limpios cuando no hay datos", async () => {
    mockFetch((url) => {
      if (url.includes("/auth/me")) return sessionResponse();
      if (url.includes("/auth/csrf")) return csrfResponse();
      if (url.includes("/quotations")) return jsonResponse(200, { items: [], total: 0, limit: 100, offset: 0 });
      if (url.includes("/products")) return jsonResponse(200, { items: [], total: 0, limit: 100, offset: 0 });
      if (url.includes("/inventory")) return jsonResponse(200, { items: [], total: 0, limit: 50, offset: 0 });
      if (url.includes("/partners")) return jsonResponse(200, { items: [], total: 0, limit: 10, offset: 0 });
      return errorResponse(404, "NOT_FOUND");
    });

    renderApp(["/"]);

    expect(await screen.findByText("No hay cotizaciones registradas aún.")).toBeInTheDocument();
    expect(screen.getByText("Todo al día")).toBeInTheDocument();
    expect(screen.getByText("No hay actividad reciente.")).toBeInTheDocument();
  });
});
