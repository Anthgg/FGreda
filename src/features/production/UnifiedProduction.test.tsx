import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { resetClientState } from "@/api/client";
import {
  csrfResponse,
  errorResponse,
  jsonResponse,
  mockFetch,
  renderApp,
  sessionResponse,
} from "@/test/utils";
import type { ProductionOrder } from "@/types/production";
import type {
  PrototypeCostBreakdown,
  PrototypeQuotation,
} from "@/types/prototypeQuotations";
import type { Prototype } from "@/types/prototypes";

const COSTEO: PrototypeCostBreakdown = {
  design_cost: "240.00",
  artist_cost: "200.00",
  mold_maker_cost: "0.00",
  materials_cost: "10.00",
  fixed_cost: "0.00",
  base_cost: "450.00",
  raw_net_total: "450.00",
  currency: "PEN",
  exchange_rate: null,
  raw_tax: "81.00",
  raw_gross_total: "531.00",
  commercial_net_total: "450.00",
  tax_percent: "18",
  commercial_tax_total: "81.00",
  commercial_gross_total: "531.00",
  total_per_prototype: "531.00",
  rounding_step: "0.50",
  rounding_source: "COMMERCIAL_SETTINGS",
  design_rate: "80.00",
  artist_rate: "100.00",
  mold_maker_price: "0.00",
  design_days: "3",
  artist_days: "2",
  mold_maker_days: "0",
  drying_days: "1",
  adjustment_days: "0",
  estimated_days: "6",
  target_date: "2026-09-11",
  materials: [
    {
      id: 1,
      product_id: 5,
      product_name: "Pasta prototipo",
      quantity_per_prototype: "1.25",
      total_quantity: "1.25",
      uom_code: "kg",
      unit_cost: "8.00",
      cost: "10.00",
      is_body_material: true,
    },
  ],
};

function cpr(overrides: Partial<PrototypeQuotation> = {}): PrototypeQuotation {
  return {
    id: 12,
    code: null,
    status: "DRAFT",
    payment_status: "UNPAID",
    paid_at: null,
    confirmed_at: null,
    cancelled_at: null,
    created_by_name: null,
    confirmed_by_name: null,
    customer_id: 3,
    customer_name: "Cliente Prototipo SAC",
    product_id: null,
    product_category_id: 4,
    product_code: null,
    product_name: null,
    description: "Maceta Terracota",
    quantity: 1,
    width_cm: "15",
    length_cm: "15",
    height_cm: "20",
    depth_cm: null,
    technical_specifications: null,
    notes: "Nota inicial",
    design_days: "3",
    design_rate_override: null,
    artist_days: "2",
    artist_rate_override: null,
    mold_maker_partner_id: null,
    mold_maker_price_override: null,
    mold_maker_days: "0",
    drying_days: "1",
    adjustment_days: "0",
    fixed_cost_override: null,
    currency_code: "PEN",
    currency_symbol: "S/",
    exchange_rate: null,
    costing: COSTEO,
    prototype_id: null,
    prototype_code: null,
    updated_at: "2026-09-06T12:00:00Z",
    ...overrides,
  };
}

function ordenCTZ(overrides: Partial<ProductionOrder> = {}): ProductionOrder {
  return {
    id: 2,
    code: "OP-2026-000002",
    status: "CREATED",
    quotation_id: 349,
    quotation_code: "CTZ-2026-000349",
    quotation_customer_name: "ANA MARIA CISNEROS",
    quotation_payment_status: "PAID",
    stock_location_id: 1,
    stock_location_name: "Almacén principal",
    line_count: 1,
    created_at: "2026-09-02T06:06:00Z",
    started_at: null,
    completed_at: null,
    cancelled_at: null,
    qr_token: "t".repeat(43),
    lines: [
      {
        id: 1,
        quotation_item_id: 1,
        sort_order: 1,
        product_id: 1,
        product_name: "JARRAS",
        product_internal_reference: "LAB50021",
        quantity: 12,
        width: null,
        height: null,
        length: null,
        depth: null,
        recipe_id: 1,
        recipe_version_id: 1,
        material_grams_per_piece: "100",
        prepared_product_id: 7,
        prepared_product_name: "BARNIZ BASE 57",
        prepared_product_internal_reference: "LAB70005",
        required_material_quantity: "1200",
        required_material_uom: "g",
      },
    ],
    readiness: { ready: true, issues: [] },
    ...overrides,
  };
}

function prtFisico(overrides: Partial<Prototype> = {}): Prototype {
  return {
    id: 99,
    code: "PRT-2026-000099",
    name: "Maceta física en taller",
    status: "CREATED",
    approval: "PENDING",
    technical_specifications: null,
    origin_quotation_ids: [],
    quotation_id: null,
    quotation_code: null,
    product_id: null,
    stock_location_id: 1,
    quantity: 1,
    target_days: 5,
    requested_at: "2026-09-01T10:00:00Z",
    started_at: null,
    completed_at: null,
    cancelled_at: null,
    decided_at: null,
    supersedes_prototype_id: null,
    material_count: 1,
    notes: "Histórico",
    quotation_payment_status: null,
    materials: [
      {
        id: 1,
        product_id: 5,
        sort_order: 1,
        product_name: "Pasta prototipo",
        product_internal_reference: "LAB70001",
        quantity: "1.25",
        quantity_planned: "1.25",
        quantity_actual: null,
        uom_code: "kg",
        material_role: "BODY",
        stage: "PREPARATION",
      },
    ],
    readiness: { ready: true, issues: [] },
    ...overrides,
  };
}

interface TestBackend {
  enviados: Array<{ url: string; method: string; body: unknown }>;
  visitadas: string[];
}

function setupBackend(opts: {
  cotizaciones?: PrototypeQuotation[];
  ordenes?: ProductionOrder[];
  muestras?: Prototype[];
} = {}): TestBackend {
  const cotizaciones = opts.cotizaciones ?? [cpr()];
  const ordenes = opts.ordenes ?? [ordenCTZ()];
  const muestras = opts.muestras ?? [prtFisico()];
  const testBackend: TestBackend = { enviados: [], visitadas: [] };

  mockFetch((url, init) => {
    testBackend.visitadas.push(url);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : null;

    if (method !== "GET") {
      testBackend.enviados.push({ url, method, body });
    }

    if (url.includes("/auth/csrf")) return csrfResponse();
    if (url.includes("/auth/me")) return sessionResponse();
    if (url.includes("/categories")) {
      return jsonResponse(200, [
        { id: 4, name: "Macetas", display_path: "Macetas", active: true },
      ]);
    }
    if (url.includes("/products")) {
      return jsonResponse(200, {
        items: [
          {
            id: 77,
            internal_reference: "LAB50077",
            name: "Maceta Catálogo",
            active: true,
          },
        ],
        total: 1,
      });
    }
    if (url.includes("/partners")) {
      return jsonResponse(200, {
        items: [{ id: 3, name: "Cliente Prototipo SAC", active: true }],
        total: 1,
      });
    }

    // Órdenes de producción CTZ
    if (url.includes("/production-orders")) {
      const matchId = url.match(/\/production-orders\/(\d+)/);
      if (matchId) {
        const id = Number(matchId[1]);
        const o = ordenes.find((x) => x.id === id) ?? ordenes[0]!;
        return jsonResponse(200, o);
      }
      return jsonResponse(200, {
        items: ordenes,
        total: ordenes.length,
        limit: 25,
        offset: 0,
      });
    }

    // Cotizaciones CPR
    if (url.includes("/prototype-quotations")) {
      if (url.includes("/preview")) {
        return jsonResponse(200, { ...cotizaciones[0], costing: COSTEO });
      }
      if (
        (url.endsWith("/prototype-quotations") ||
          url.includes("/prototype-quotations?")) &&
        method === "GET"
      ) {
        return jsonResponse(200, {
          items: cotizaciones.map((c) => ({
            id: c.id,
            code: c.code,
            status: c.status,
            payment_status: c.payment_status,
            customer_name: c.customer_name,
            description: c.description,
            quantity: c.quantity,
            commercial_gross_total: c.costing?.commercial_gross_total ?? "531.00",
            currency_code: c.currency_code,
            currency_symbol: c.currency_symbol,
            estimated_days: c.costing?.estimated_days ?? "6",
            confirmed_at: c.confirmed_at,
          })),
          total: cotizaciones.length,
        });
      }
      const matchId = url.match(/\/prototype-quotations\/(\d+)/);
      if (matchId) {
        const id = Number(matchId[1]);
        const encontrada = cotizaciones.find((c) => c.id === id) ?? cotizaciones[0]!;
        if (method === "PUT") {
          return jsonResponse(200, { ...encontrada, ...body, updated_at: "2026-09-06T13:00:00Z" });
        }
        return jsonResponse(200, encontrada);
      }
    }

    // PRT físicas
    if (url.includes("/prototypes")) {
      if (url.includes("/start")) {
        const matchId = url.match(/\/prototypes\/(\d+)\/start/);
        const id = Number(matchId?.[1] ?? 99);
        const m = muestras.find((x) => x.id === id) ?? muestras[0]!;
        return jsonResponse(200, {
          ...m,
          status: "STARTED",
          started_at: "2026-09-07T10:00:00Z",
        });
      }
      const matchId = url.match(/\/prototypes\/(\d+)/);
      if (matchId) {
        const id = Number(matchId[1]);
        const m = muestras.find((x) => x.id === id) ?? muestras[0]!;
        return jsonResponse(200, m);
      }
      return jsonResponse(200, {
        items: muestras,
        total: muestras.length,
        limit: 25,
        offset: 0,
      });
    }

    return errorResponse(404, "NOT_FOUND");
  });

  return testBackend;
}

beforeEach(() => {
  resetClientState();
});

describe("Fase 009K.2.1: Unificar Producción CTZ + Prototipos (F1 a F14)", () => {
  // F1: /prototipos muestra CPR
  it("F1: /prototipos muestra la lista de cotizaciones CPR con sus campos", async () => {
    const cotizacion = cpr({
      id: 15,
      code: "CPR-2026-000015",
      status: "CONFIRMED",
      payment_status: "UNPAID",
      customer_name: "Empresa Cerámica SAC",
      description: "Jarrón Floral",
      confirmed_at: "2026-09-06T10:00:00Z",
    });
    setupBackend({ cotizaciones: [cotizacion] });
    renderApp(["/prototipos"]);

    expect(await screen.findByText("CPR-2026-000015")).toBeInTheDocument();
    expect(screen.getByText("Empresa Cerámica SAC")).toBeInTheDocument();
    expect(screen.getByText("Jarrón Floral")).toBeInTheDocument();
    expect(screen.getByText("Emitida")).toBeInTheDocument();
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
  });

  // F2: no aparece pestaña "Muestras en producción"
  it("F2: en /prototipos NO aparece la pestaña «Muestras en producción»", async () => {
    setupBackend();
    renderApp(["/prototipos"]);

    expect(await screen.findByRole("heading", { name: /Prototipos\./i })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Muestras en producción/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  // F3: /prototipos/nuevo redirige al cotizador
  it("F3: /prototipos/nuevo redirige inmediatamente al cotizador de prototipos", async () => {
    setupBackend();
    renderApp(["/prototipos/nuevo"]);

    expect(
      await screen.findByRole("heading", { name: /Cotizador de prototipo/i }),
    ).toBeInTheDocument();
  });

  // F4: DRAFT puede Continuar
  it("F4: un CPR en DRAFT muestra la acción Continuar que lleva a su cotizador", async () => {
    const draft = cpr({ id: 25, description: "Borrador de prueba" });
    setupBackend({ cotizaciones: [draft] });
    renderApp(["/prototipos"]);

    const continuarBtn = await screen.findByRole("link", { name: /Continuar/i });
    expect(continuarBtn).toHaveAttribute("href", "/prototipos/cotizador/25");
  });

  // F5: CONFIRMED no muestra producción si no está PAID
  it("F5: un CPR CONFIRMED pero UNPAID no muestra la acción de Ir a producción", async () => {
    const confirmedUnpaid = cpr({
      id: 30,
      code: "CPR-2026-000030",
      status: "CONFIRMED",
      payment_status: "UNPAID",
      prototype_id: null,
    });
    setupBackend({ cotizaciones: [confirmedUnpaid] });
    renderApp(["/prototipos"]);

    await screen.findByText("CPR-2026-000030");
    expect(screen.queryByRole("link", { name: /Ir a producción/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /PDF/i })).toBeInTheDocument();
  });

  // F6: PAID muestra Ir a producción
  it("F6: un CPR PAID con prototype_id muestra «Ir a producción»", async () => {
    const paidCpr = cpr({
      id: 35,
      code: "CPR-2026-000035",
      status: "CONFIRMED",
      payment_status: "PAID",
      prototype_id: 88,
    });
    setupBackend({ cotizaciones: [paidCpr] });
    renderApp(["/prototipos"]);

    const irAProduccion = await screen.findByRole("link", { name: /Ir a producción/i });
    expect(irAProduccion).toBeInTheDocument();
  });

  // F7: Ir a producción usa prototype_id real
  it("F7: «Ir a producción» navega hacia /produccion/prototipos/:prototypeId con el ID real", async () => {
    const paidCpr = cpr({
      id: 40,
      code: "CPR-2026-000040",
      status: "CONFIRMED",
      payment_status: "PAID",
      prototype_id: 77,
    });
    setupBackend({ cotizaciones: [paidCpr] });
    renderApp(["/prototipos"]);

    const irAProduccion = await screen.findByRole("link", { name: /Ir a producción/i });
    expect(irAProduccion).toHaveAttribute("href", "/produccion/prototipos/77");
  });

  // F8: /produccion conserva órdenes CTZ
  it("F8: /produccion muestra la lista de órdenes CTZ en la pestaña por defecto", async () => {
    const orden = ordenCTZ({
      id: 5,
      code: "OP-2026-000005",
      quotation_code: "CTZ-2026-000100",
      stock_location_name: "Almacén Central",
    });
    setupBackend({ ordenes: [orden] });
    renderApp(["/produccion"]);

    expect(await screen.findByText("OP-2026-000005")).toBeInTheDocument();
    expect(screen.getByText("CTZ-2026-000100")).toBeInTheDocument();
    expect(screen.getByText("Almacén Central")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver detalle/i })).toHaveAttribute(
      "href",
      "/produccion/5",
    );
  });

  // F9: /produccion permite visualizar Prototipos
  it("F9: /produccion permite cambiar a la pestaña Prototipos y ver los PRT físicos", async () => {
    const muestra = prtFisico({ id: 50, code: "PRT-2026-000050", name: "Jarrón Prototipo F9" });
    setupBackend({ muestras: [muestra] });
    const user = userEvent.setup();
    renderApp(["/produccion"]);

    const tabPrototipos = await screen.findByRole("tab", { name: /Prototipos/i });
    await user.click(tabPrototipos);

    expect(await screen.findByText("PRT-2026-000050")).toBeInTheDocument();
    expect(screen.getByText("Jarrón Prototipo F9")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver detalle/i })).toHaveAttribute(
      "href",
      "/produccion/prototipos/50",
    );
  });

  // F10: PRT históricos sin CPR siguen visibles
  it("F10: PRT históricos sin cotización ni producto siguen visibles en Producción -> Prototipos", async () => {
    const legacyPrt = prtFisico({
      id: 60,
      code: "PRT-2026-000060",
      name: "Muestra Legacy Sin CPR",
      quotation_id: null,
      quotation_code: null,
      product_id: null,
    });
    setupBackend({ muestras: [legacyPrt] });
    const user = userEvent.setup();
    renderApp(["/produccion"]);

    await user.click(await screen.findByRole("tab", { name: /Prototipos/i }));

    expect(await screen.findByText("PRT-2026-000060")).toBeInTheDocument();
    expect(screen.getByText("Muestra Legacy Sin CPR")).toBeInTheDocument();
    expect(screen.getByText("Sin cotización")).toBeInTheDocument();
    expect(screen.getByText("Sin producto")).toBeInTheDocument();
  });

  // F11: PRT detail sigue accesible en /produccion/prototipos/:id
  it("F11: el detalle físico de un prototipo es accesible directamente en /produccion/prototipos/:id", async () => {
    const muestra = prtFisico({
      id: 70,
      code: "PRT-2026-000070",
      name: "Taza Detalle F11",
      target_days: 7,
    });
    setupBackend({ muestras: [muestra] });
    renderApp(["/produccion/prototipos/70"]);

    expect(await screen.findByText("Taza Detalle F11")).toBeInTheDocument();
    expect(screen.getAllByText("PRT-2026-000070").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /← Producción/i })).toHaveAttribute(
      "href",
      "/produccion?tab=prototipos",
    );
  });

  // F12: legacy /prototipos/:id no rompe y redirige a /produccion/prototipos/:id
  it("F12: la ruta legacy /prototipos/:id redirige sin romper hacia /produccion/prototipos/:id", async () => {
    const muestra = prtFisico({ id: 80, code: "PRT-2026-000080", name: "Plato Redirigido" });
    setupBackend({ muestras: [muestra] });
    renderApp(["/prototipos/80"]);

    expect(await screen.findByText("Plato Redirigido")).toBeInTheDocument();
    expect(screen.getAllByText("PRT-2026-000080").length).toBeGreaterThan(0);
  });

  // F13: START no cambia
  it("F13: la acción de iniciar fabricación de un prototipo sigue invocando POST /prototypes/:id/start", async () => {
    const muestra = prtFisico({
      id: 90,
      code: "PRT-2026-000090",
      name: "Muestra Lista para Arrancar",
      status: "CREATED",
      readiness: { ready: true, issues: [] },
    });
    const backend = setupBackend({ muestras: [muestra] });
    const user = userEvent.setup();
    renderApp(["/produccion/prototipos/90/operacion"]);

    const startBtn = await screen.findByRole("button", { name: /Iniciar fabricación/i });
    await user.click(startBtn);

    await waitFor(() => {
      const starts = backend.enviados.filter(
        (e) => e.url.includes("/prototypes/90/start") && e.method === "POST",
      );
      expect(starts.length).toBe(1);
    });
  });

  // F14: PR #59 resumable CPR sigue intacto
  it("F14: flujo de cotización CPR resumible (PR #59) sigue intacto y ejecuta PUT sin duplicar", async () => {
    const draft = cpr({ id: 95, description: "Borrador CPR Resumible" });
    const backend = setupBackend({ cotizaciones: [draft] });
    const user = userEvent.setup();
    renderApp(["/prototipos/cotizador/95"]);

    await user.click(await screen.findByRole("button", { name: /Prototipo/i }));
    const inputDesc = screen.getByDisplayValue("Borrador CPR Resumible");
    await user.clear(inputDesc);
    await user.type(inputDesc, "Borrador CPR Modificado");

    const guardarBtn = screen.getByRole("button", { name: /Guardar borrador/i });
    await user.click(guardarBtn);

    await waitFor(() => {
      const updates = backend.enviados.filter(
        (e) => e.url.includes("/prototype-quotations/95") && e.method === "PUT",
      );
      expect(updates.length).toBe(1);
    });

    const creates = backend.enviados.filter(
      (e) => e.url.endsWith("/prototype-quotations") && e.method === "POST",
    );
    expect(creates.length).toBe(0);
  });
});
