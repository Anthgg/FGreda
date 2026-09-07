import { screen, waitFor, within } from "@testing-library/react";
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
    production_order_id: null,
    production_order_code: null,
    updated_at: "2026-09-06T12:00:00Z",
    ...overrides,
  };
}

function ordenCTZ(overrides: Partial<ProductionOrder> = {}): ProductionOrder {
  return {
    id: 2,
    code: "OP-2026-000002",
    status: "CREATED",
    origin_type: "QUOTATION",
    quotation_id: 349,
    quotation_code: "CTZ-2026-000349",
    prototype_id: null,
    prototype_code: null,
    prototype_quotation_id: null,
    prototype_quotation_code: null,
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

/** Fase 009K.4. La orden que nace al cobrar una cotización de prototipo. */
function ordenPRT(overrides: Partial<ProductionOrder> = {}): ProductionOrder {
  return {
    ...ordenCTZ(),
    id: 501,
    code: "OP-2026-000501",
    origin_type: "PROTOTYPE",
    quotation_id: null,
    quotation_code: null,
    quotation_customer_name: null,
    quotation_payment_status: null,
    prototype_id: 101,
    prototype_code: "PRT-2026-000101",
    prototype_quotation_id: 12,
    prototype_quotation_code: "CPR-2026-000012",
    lines: [
      {
        id: 9,
        quotation_item_id: null,
        sort_order: 0,
        product_id: 77,
        product_name: "Maceta de muestra",
        product_internal_reference: "LAB50077",
        quantity: 1,
        width: "15",
        height: "20",
        length: "15",
        depth: null,
        recipe_id: null,
        recipe_version_id: null,
        material_grams_per_piece: null,
        prepared_product_id: null,
        prepared_product_name: null,
        prepared_product_internal_reference: null,
        required_material_quantity: null,
        required_material_uom: null,
      },
    ],
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
    production_order_id: null,
    production_order_code: null,
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
  failPayment?: boolean;
  /**
   * El cobro responde 200 pero SIN muestra.
   *
   * No es un caso legitimo del contrato —`mark_paid` siempre materializa el
   * prototipo y lo devuelve—, pero es exactamente lo que la pantalla no puede
   * resolver adivinando: existe la opcion para poder comprobar que no adivina.
   */
  nullPrototypeId?: boolean;
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
    // Fase 009K.4: cobrar exige elegir almacén, así que el diálogo los pide.
    if (url.includes("/inventory/locations")) {
      return jsonResponse(200, [
        { id: 1, name: "Almacén principal", active: true },
        { id: 2, name: "Almacén secundario", active: true },
      ]);
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
      if (url.includes("/mark-paid") && method === "POST") {
        if (opts.failPayment) {
          return errorResponse(500, "PAYMENT_PROCESSING_ERROR");
        }
        const matchId = url.match(/\/prototype-quotations\/(\d+)\/mark-paid/);
        const id = Number(matchId?.[1] ?? 12);
        const encontrada = cotizaciones.find((c) => c.id === id) ?? cotizaciones[0]!;
        return jsonResponse(200, {
          ...encontrada,
          status: "CONFIRMED",
          payment_status: "PAID",
          paid_at: "2026-09-07T12:00:00Z",
          prototype_id: opts.nullPrototypeId ? null : (encontrada.prototype_id ?? 101),
          prototype_code: opts.nullPrototypeId
            ? null
            : (encontrada.prototype_code ?? "PRT-2026-000101"),
          production_order_id: opts.nullPrototypeId
            ? null
            : (encontrada.production_order_id ?? 501),
          production_order_code: opts.nullPrototypeId
            ? null
            : (encontrada.production_order_code ?? "OP-2026-000501"),
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

  // F9: la lista única incluye las órdenes nacidas de una muestra
  it("F9: /produccion lista también las órdenes de prototipo, en la misma tabla", async () => {
    // Fase 009K.4. Ya no hay pestaña de Prototipos: hay UNA lista, porque hay
    // un solo documento de ejecución física.
    setupBackend({ ordenes: [ordenCTZ(), ordenPRT()] });
    renderApp(["/produccion"]);

    expect((await screen.findAllByText("OP-2026-000501")).length).toBeGreaterThan(0);
    expect(screen.getByText("OP-2026-000002")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Prototipos/i })).not.toBeInTheDocument();
    // Y el origen se lee con códigos, no con identificadores.
    expect(screen.getByText("CPR-2026-000012")).toBeInTheDocument();
    expect(screen.getByText("PRT-2026-000101")).toBeInTheDocument();
    expect(screen.getByText("CTZ-2026-000349")).toBeInTheDocument();
  });

  // F10: las muestras históricas NO se cuelan como órdenes falsas
  it("F10: las muestras históricas sin orden no aparecen en la lista de producción", async () => {
    const legacyPrt = prtFisico({
      id: 60,
      code: "PRT-2026-000060",
      name: "Muestra Legacy Sin CPR",
      quotation_id: null,
      quotation_code: null,
      product_id: null,
    });
    setupBackend({ ordenes: [ordenCTZ()], muestras: [legacyPrt] });
    renderApp(["/produccion"]);

    expect(await screen.findByText("OP-2026-000002")).toBeInTheDocument();
    // Fabricarles una orden retroactiva habría inventado un documento para un
    // hecho que ya ocurrió sin él, y con un almacén que nadie eligió.
    expect(screen.queryByText("PRT-2026-000060")).not.toBeInTheDocument();
    expect(screen.queryByText("Muestra Legacy Sin CPR")).not.toBeInTheDocument();
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
      "/produccion",
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

  // F13: arrancar una muestra se hace desde SU ORDEN, y sólo desde ahí
  it("F13: arrancar una muestra invoca POST /production-orders/:id/start", async () => {
    // PROTOTYPE_VISIBLE_START_ENTRYPOINT_COUNT: 1. El arranque propio del
    // prototipo desapareció de la interfaz: dos botones para el mismo consumo
    // eran dos formas de gastar el mismo barro.
    const backend = setupBackend({
      ordenes: [ordenPRT()],
      muestras: [prtFisico({ id: 101, code: "PRT-2026-000101" })],
    });
    const user = userEvent.setup();
    renderApp(["/produccion/501"]);

    await user.click(await screen.findByRole("button", { name: /Arrancar producción/i }));

    await waitFor(() => {
      const starts = backend.enviados.filter(
        (e) => e.url.includes("/production-orders/501/start") && e.method === "POST",
      );
      expect(starts.length).toBe(1);
    });
    expect(
      backend.enviados.filter((e) => e.url.includes("/prototypes/101/start")),
    ).toHaveLength(0);
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

  // F15: cobrar exige elegir almacén y termina en la ORDEN, no en la muestra
  it("F15: cobrar pide el almacén y navega a /produccion/:order_id", async () => {
    const cotizacion = cpr({
      id: 12,
      code: "CPR-2026-000012",
      status: "CONFIRMED",
      payment_status: "UNPAID",
      prototype_id: 101,
    });
    const backend = setupBackend({
      cotizaciones: [cotizacion],
      ordenes: [ordenPRT()],
      muestras: [prtFisico({ id: 101, code: "PRT-2026-000101" })],
    });
    const user = userEvent.setup();
    renderApp(["/prototipos/cotizador/12"]);

    await user.click(await screen.findByRole("button", { name: /Registrar cobro/i }));

    // El diálogo se abre con el almacén VACÍO. Aunque hubiera uno solo activo,
    // seguiría vacío: el día que haya dos, un valor por defecto descontaría del
    // equivocado sin que nadie lo notara.
    const dialogo = await screen.findByRole("dialog", { name: /Registrar cobro/i });
    expect(dialogo).toBeInTheDocument();
    await user.click(
      await within(dialogo).findByRole("combobox", { name: /almacén de salida/i }),
    );
    await user.click(await screen.findByRole("option", { name: /Almacén principal/i }));
    await user.click(within(dialogo).getByRole("button", { name: /Registrar cobro/i }));

    // Termina en la ORDEN. La ejecución física vive ahí desde 009K.4.
    expect((await screen.findAllByText("OP-2026-000501")).length).toBeGreaterThan(0);

    const pagos = backend.enviados.filter(
      (e) => e.url.includes("/prototype-quotations/12/mark-paid") && e.method === "POST",
    );
    expect(pagos).toHaveLength(1);
    expect(pagos[0]!.body).toEqual({ stock_location_id: 1 });
  });

  // F16: un cobro fallido no navega a ninguna parte
  it("F16: si el cobro falla, no redirige y enseña el mensaje de alerta", async () => {
    const cotizacion = cpr({
      id: 12,
      code: "CPR-2026-000012",
      status: "CONFIRMED",
      payment_status: "UNPAID",
      prototype_id: 101,
    });
    setupBackend({
      cotizaciones: [cotizacion],
      ordenes: [ordenPRT()],
      failPayment: true,
    });
    const user = userEvent.setup();
    renderApp(["/prototipos/cotizador/12"]);

    await user.click(await screen.findByRole("button", { name: /Registrar cobro/i }));
    const dialogo = await screen.findByRole("dialog", { name: /Registrar cobro/i });
    await user.click(
      await within(dialogo).findByRole("combobox", { name: /almacén de salida/i }),
    );
    await user.click(await screen.findByRole("option", { name: /Almacén principal/i }));
    await user.click(within(dialogo).getByRole("button", { name: /Registrar cobro/i }));

    // El error sale DENTRO del diálogo, que sigue abierto: quien cobra ve por
    // qué falló sin perder el almacén que acababa de elegir.
    expect((await screen.findAllByRole("alert")).length).toBeGreaterThan(0);
    // Se queda en la cotización, con el estado como estaba.
    expect(screen.getByText("Pendiente de cobro")).toBeInTheDocument();
    expect(screen.queryByText("OP-2026-000501")).not.toBeInTheDocument();
  });

  // F17: una CPR ya pagada enlaza a su ORDEN, sin volver a cobrar
  it("F17: una cotización ya pagada enlaza a /produccion/:order_id sin re-ejecutar el cobro", async () => {
    const cotizacion = cpr({
      id: 12,
      code: "CPR-2026-000012",
      status: "CONFIRMED",
      payment_status: "PAID",
      prototype_id: 101,
      prototype_code: "PRT-2026-000101",
      production_order_id: 501,
      production_order_code: "OP-2026-000501",
    });
    const backend = setupBackend({
      cotizaciones: [cotizacion],
      ordenes: [ordenPRT()],
      muestras: [prtFisico({ id: 101, code: "PRT-2026-000101" })],
    });
    const user = userEvent.setup();
    renderApp(["/prototipos/cotizador/12"]);

    expect(screen.queryByRole("button", { name: /Registrar cobro/i })).not.toBeInTheDocument();
    const enlace = await screen.findByRole("link", { name: /Ir a producción/i });
    expect(enlace).toHaveAttribute("href", "/produccion/501");

    await user.click(enlace);
    expect((await screen.findAllByText("OP-2026-000501")).length).toBeGreaterThan(0);
    expect(backend.enviados.filter((e) => e.url.includes("/mark-paid"))).toHaveLength(0);
  });

  // F18: el mismo diálogo desde el panel del PDF
  it("F18: cobrar desde la pestaña PDF abre el mismo diálogo y acaba en la orden", async () => {
    const cotizacion = cpr({
      id: 12,
      code: "CPR-2026-000012",
      status: "CONFIRMED",
      payment_status: "UNPAID",
      prototype_id: 101,
    });
    setupBackend({
      cotizaciones: [cotizacion],
      ordenes: [ordenPRT()],
      muestras: [prtFisico({ id: 101, code: "PRT-2026-000101" })],
    });
    const user = userEvent.setup();
    renderApp(["/prototipos/cotizador/12"]);

    await user.click(await screen.findByRole("button", { name: /PDF/i }));
    const botones = screen.getAllByRole("button", { name: /Registrar cobro/i });
    await user.click(botones[0]!);

    const dialogo = await screen.findByRole("dialog", { name: /Registrar cobro/i });
    await user.click(
      await within(dialogo).findByRole("combobox", { name: /almacén de salida/i }),
    );
    await user.click(await screen.findByRole("option", { name: /Almacén principal/i }));
    await user.click(within(dialogo).getByRole("button", { name: /Registrar cobro/i }));

    expect((await screen.findAllByText("OP-2026-000501")).length).toBeGreaterThan(0);
  });

  // F19: el destino es la MUESTRA, no la cotizacion
  it("F19: la redirección usa el id de la ORDEN, no el de la CPR ni el de la muestra", async () => {
    // Los tres identificadores son distintos a propósito: si la pantalla usara
    // el de la cotización o el de la muestra, /produccion/12 y /produccion/101
    // existirían como rutas y llevarían a OTRA orden sin dar ningún error.
    const cotizacion = cpr({
      id: 12,
      code: "CPR-2026-000012",
      status: "CONFIRMED",
      payment_status: "UNPAID",
      prototype_id: 101,
    });
    const suya = ordenPRT({ id: 501, code: "OP-2026-000501" });
    const ajena = ordenCTZ({ id: 101, code: "OP-2026-000101" });
    setupBackend({
      cotizaciones: [cotizacion],
      ordenes: [suya, ajena],
      muestras: [prtFisico({ id: 101, code: "PRT-2026-000101" })],
    });
    const user = userEvent.setup();
    renderApp(["/prototipos/cotizador/12"]);

    await user.click(await screen.findByRole("button", { name: /Registrar cobro/i }));
    const dialogo = await screen.findByRole("dialog", { name: /Registrar cobro/i });
    await user.click(
      await within(dialogo).findByRole("combobox", { name: /almacén de salida/i }),
    );
    await user.click(await screen.findByRole("option", { name: /Almacén principal/i }));
    await user.click(within(dialogo).getByRole("button", { name: /Registrar cobro/i }));

    expect((await screen.findAllByText("OP-2026-000501")).length).toBeGreaterThan(0);
    expect(screen.queryByText("OP-2026-000101")).not.toBeInTheDocument();
  });

  // F20: un cobro sin orden ni muestra no se resuelve adivinando
  it("F20: si el cobro responde sin orden ni muestra, no navega a ninguna parte", async () => {
    // Cobrar SIEMPRE materializa las dos —`mark_paid` las crea, las devuelve y
    // es idempotente—, así que esto no es un caso legítimo sino una respuesta
    // rara. Llevar a la lista de Producción con la esperanza de que alguien
    // encuentre la suya sería adivinar, y fabricar un identificador sería peor:
    // se queda donde está, con el cobro ya registrado, y al recargar aparece el
    // botón con el id de verdad.
    const cotizacion = cpr({
      id: 12,
      code: "CPR-2026-000012",
      status: "CONFIRMED",
      payment_status: "UNPAID",
      prototype_id: 101,
    });
    setupBackend({
      cotizaciones: [cotizacion],
      ordenes: [ordenPRT()],
      muestras: [prtFisico({ id: 101, code: "PRT-2026-000101" })],
      nullPrototypeId: true,
    });
    const user = userEvent.setup();
    renderApp(["/prototipos/cotizador/12"]);

    await user.click(await screen.findByRole("button", { name: /Registrar cobro/i }));
    const dialogo = await screen.findByRole("dialog", { name: /Registrar cobro/i });
    await user.click(
      await within(dialogo).findByRole("combobox", { name: /almacén de salida/i }),
    );
    await user.click(await screen.findByRole("option", { name: /Almacén principal/i }));
    await user.click(within(dialogo).getByRole("button", { name: /Registrar cobro/i }));

    // Sigue en el cotizador: ni orden, ni muestra, ni destino inventado.
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: /Registrar cobro/i })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: /Volver al tablero/i })).toBeInTheDocument();
    expect(screen.queryByText("OP-2026-000501")).not.toBeInTheDocument();
    expect(screen.queryByText("PRT-2026-000101")).not.toBeInTheDocument();
  });
});
