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
    stock_location_id: null,
    quantity: 1,
    target_days: 5,
    requested_at: "2026-09-01T10:00:00Z",
    started_at: null,
    completed_at: null,
    cancelled_at: null,
    decided_at: null,
    supersedes_prototype_id: null,
    material_count: 0,
    notes: "Histórico",
    quotation_payment_status: null,
    materials: [],
    production_order_id: null,
    production_order_code: null,
    readiness: { ready: true, issues: [] },
    ...overrides,
  };
}

interface BackendDoble {
  enviados: Array<{ url: string; method: string; body: unknown }>;
  visitadas: string[];
}

function setupBackend(opts: {
  cotizaciones?: PrototypeQuotation[];
  muestras?: Prototype[];
} = {}): BackendDoble {
  const cotizaciones = opts.cotizaciones ?? [cpr()];
  const muestras = opts.muestras ?? [prtFisico()];
  const doble: BackendDoble = { enviados: [], visitadas: [] };

  mockFetch((url, init) => {
    doble.visitadas.push(url);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : null;

    if (method !== "GET") {
      doble.enviados.push({ url, method, body });
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
        items: [
          { id: 3, name: "Cliente Prototipo SAC", active: true },
        ],
        total: 1,
      });
    }

    // CPR
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
      if (
        (url.endsWith("/prototype-quotations") ||
          url.includes("/prototype-quotations?")) &&
        method === "POST"
      ) {
        const nuevo = cpr({ id: 88, ...body });
        return jsonResponse(201, nuevo);
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

  return doble;
}

beforeEach(() => {
  resetClientState();
});

describe("Parte 13 — Tests Frontend: Flujo de Cotización de Prototipos y Navegación", () => {
  // TEST 1: Guardar DRAFT nuevo -> create una sola vez. URL final: ruta de edición CPR
  it("TEST 1: guardar DRAFT nuevo ejecuta create una sola vez y navega a la ruta de edición CPR", async () => {
    const user = userEvent.setup();
    const backend = setupBackend();
    renderApp(["/prototipos/cotizador"]);

    await user.click(await screen.findByRole("combobox", { name: /Cliente/i }));
    await user.click(await screen.findByRole("option", { name: /Cliente Prototipo SAC/i }));

    await user.click(screen.getByRole("button", { name: /Prototipo/i }));
    await user.type(screen.getByLabelText(/Descripción/i), "Nuevo Concepto Vaso");
    await user.click(screen.getByRole("combobox", { name: /Familia del nuevo producto/i }));
    await user.click(await screen.findByRole("option", { name: /Macetas/i }));

    const guardarBtn = screen.getByRole("button", { name: /Crear borrador/i });
    await user.click(guardarBtn);

    await waitFor(() => {
      const creates = backend.enviados.filter(
        (e) => e.url.endsWith("/prototype-quotations") && e.method === "POST",
      );
      expect(creates.length).toBe(1);
    });

    // URL final debe ser la ruta de edición /prototipos/cotizador/88 (no /prototipos/:id ni /prototipos/nuevo)
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Cotizador de prototipo/i }),
      ).toBeInTheDocument();
    });
  });

  // TEST 2: Reabrir DRAFT -> carga datos existentes
  it("TEST 2: reabrir DRAFT carga datos reales del backend e hidrata el wizard", async () => {
    const draftGuardado = cpr({
      id: 12,
      description: "Jarrón Reabierto",
      notes: "Observación preservada",
      width_cm: "18",
      length_cm: "18",
      height_cm: "25",
      design_days: "4",
      artist_days: "3",
    });
    setupBackend({ cotizaciones: [draftGuardado] });
    renderApp(["/prototipos/cotizador/12"]);

    // Paso 0: Datos
    expect(
      await screen.findByRole("combobox", { name: /Cliente/i }),
    ).toHaveTextContent(/Cliente Prototipo SAC/);

    // Paso 1: Prototipo
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Prototipo/i }));
    expect(screen.getByDisplayValue("Jarrón Reabierto")).toBeInTheDocument();
    expect(screen.getByLabelText(/Ancho cm/i)).toHaveValue(18);
    expect(screen.getByLabelText(/Largo cm/i)).toHaveValue(18);
    expect(screen.getByLabelText(/Alto cm/i)).toHaveValue(25);
    expect(screen.getByDisplayValue("Observación preservada")).toBeInTheDocument();

    // Paso 2: Trabajo
    await user.click(screen.getByRole("button", { name: /Trabajo/i }));
    expect(screen.getByDisplayValue("4")).toBeInTheDocument();
    expect(screen.getByDisplayValue("3")).toBeInTheDocument();
  });

  // TEST 3: Guardar DRAFT reabierto -> UPDATE, no segundo CREATE
  it("TEST 3: guardar DRAFT reabierto ejecuta UPDATE del mismo CPR y preserva su ID", async () => {
    const draftGuardado = cpr({ id: 12, description: "Jarrón Inicial" });
    const backend = setupBackend({ cotizaciones: [draftGuardado] });
    const user = userEvent.setup();
    renderApp(["/prototipos/cotizador/12"]);

    await user.click(await screen.findByRole("button", { name: /Prototipo/i }));
    const descInput = screen.getByDisplayValue("Jarrón Inicial");
    await user.clear(descInput);
    await user.type(descInput, "Jarrón Modificado");

    const guardarBtn = screen.getByRole("button", { name: /Guardar borrador/i });
    await user.click(guardarBtn);

    await waitFor(() => {
      const updates = backend.enviados.filter(
        (e) => e.url.includes("/prototype-quotations/12") && e.method === "PUT",
      );
      expect(updates.length).toBe(1);
    });

    const creates = backend.enviados.filter(
      (e) => e.url.endsWith("/prototype-quotations") && e.method === "POST",
    );
    expect(creates.length).toBe(0);
  });

  // TEST 4: DRAFT concepto nuevo -> sigue concepto nuevo, no Product auto-created
  it("TEST 4: DRAFT de concepto nuevo sigue como concepto nuevo y no auto-crea Product", async () => {
    const draftConcepto = cpr({
      id: 12,
      product_id: null,
      product_code: null,
      product_name: null,
      product_category_id: 4,
    });
    setupBackend({ cotizaciones: [draftConcepto] });
    renderApp(["/prototipos/cotizador/12"]);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Prototipo/i }));

    expect(screen.getByText(/Nuevo producto · pendiente de código interno/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Familia del nuevo producto/i })).toBeInTheDocument();
    expect(screen.queryByText(/LAB50/i)).not.toBeInTheDocument();
  });

  // TEST 5: DRAFT producto existente -> mantiene product_id
  it("TEST 5: DRAFT de producto existente mantiene product_id", async () => {
    const draftCatalogo = cpr({
      id: 12,
      product_id: 77,
      product_code: "LAB50077",
      product_name: "Maceta Catálogo",
    });
    setupBackend({ cotizaciones: [draftCatalogo] });
    renderApp(["/prototipos/cotizador/12"]);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Prototipo/i }));

    expect(screen.getAllByText(/LAB50077/i).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/Familia del nuevo producto/i)).not.toBeInTheDocument();
  });

  // TEST 6: El botón "Muestra de una cotización" NO existe
  it("TEST 6: el botón «Muestra de una cotización» no existe en la interfaz", async () => {
    setupBackend();
    renderApp(["/prototipos"]);

    expect(
      screen.queryByRole("link", { name: /Muestra de una cotización/i }),
    ).not.toBeInTheDocument();
  });

  // TEST 7: "Cotizar prototipo" sí existe
  it("TEST 7: «Cotizar prototipo» existe como acción principal", async () => {
    setupBackend();
    renderApp(["/prototipos"]);

    const boton = await screen.findByRole("link", { name: /Cotizar prototipo/i });
    expect(boton).toBeInTheDocument();
    expect(boton).toHaveAttribute("href", "/prototipos/cotizador");
  });

  // TEST 8: /prototipos/nuevo no muestra alta física normal y redirige a cotizador
  it("TEST 8: /prototipos/nuevo no muestra alta física normal y redirige al cotizador", async () => {
    setupBackend();
    renderApp(["/prototipos/nuevo"]);

    expect(
      await screen.findByRole("heading", { name: /Cotizador de prototipo/i }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/^nombre \/ producto/i)).not.toBeInTheDocument();
  });

  // TEST 9: DRAFT -> acción Continuar -> /prototipos/cotizador/:id
  it("TEST 9: en el listado, un DRAFT tiene la acción Continuar que lleva a /prototipos/cotizador/:id", async () => {
    const draft = cpr({ id: 12, description: "Borrador Listado" });
    setupBackend({ cotizaciones: [draft] });
    renderApp(["/prototipos"]);

    const continuarLink = await screen.findByRole("link", { name: /Continuar/i });
    expect(continuarLink).toHaveAttribute("href", "/prototipos/cotizador/12");
  });

  // TEST 10: CONFIRMED UNPAID -> NO "Ir a producción"
  it("TEST 10: CONFIRMED UNPAID no muestra la acción «Ir a producción»", async () => {
    const cprUnpaid = cpr({
      id: 12,
      code: "CPR-2026-000012",
      status: "CONFIRMED",
      payment_status: "UNPAID",
      prototype_id: null,
    });
    setupBackend({ cotizaciones: [cprUnpaid] });
    renderApp(["/prototipos/cotizador/12"]);

    await screen.findByRole("heading", { name: /CPR-2026-000012/i });
    expect(screen.queryByRole("link", { name: /Ir a producción/i })).not.toBeInTheDocument();
  });

  // TEST 11: PAID con Prototype -> sí "Ir a producción"
  it("TEST 11: PAID con Prototype físico muestra «Ir a producción»", async () => {
    const cprPaid = cpr({
      id: 12,
      code: "CPR-2026-000012",
      status: "CONFIRMED",
      payment_status: "PAID",
      prototype_id: 99,
      prototype_code: "PRT-2026-000099",
    });
    setupBackend({ cotizaciones: [cprPaid] });
    renderApp(["/prototipos/cotizador/12"]);

    const produccionBtn = await screen.findByRole("link", { name: /Ir a producción/i });
    expect(produccionBtn).toBeInTheDocument();
  });

  // TEST 12: Ir a producción usa prototype_id real
  it("TEST 12: «Ir a producción» navega usando el prototype_id real del backend hacia el módulo Producción", async () => {
    const cprPaid = cpr({
      id: 12,
      code: "CPR-2026-000012",
      status: "CONFIRMED",
      payment_status: "PAID",
      prototype_id: 99,
      prototype_code: "PRT-2026-000099",
    });
    setupBackend({ cotizaciones: [cprPaid] });
    renderApp(["/prototipos/cotizador/12"]);

    const produccionBtn = await screen.findByRole("link", { name: /Ir a producción/i });
    expect(produccionBtn).toHaveAttribute("href", "/produccion/prototipos/99");
  });

  // TEST 13: una muestra histórica se lee por su propia ruta, no en la lista
  it("TEST 13: las muestras PRT históricas se leen en su propia ficha, fuera de la lista", async () => {
    // Fase 009K.4. La lista de /produccion es de ÓRDENES. Colar ahí las once
    // muestras que se fabricaron sin orden las enseñaría como documentos que
    // no existen, y el primer clic llevaría a una orden inventada.
    const muestra = prtFisico({ id: 99, code: "PRT-2026-000099", name: "Jarra Histórica 009K" });
    setupBackend({ muestras: [muestra] });
    renderApp(["/produccion"]);

    // La pestaña desapareció con la unificación, y la muestra no se cuela en
    // la tabla de órdenes. Se lee por su propia ruta, en sólo lectura.
    expect(await screen.findByRole("heading", { name: /Producción/i })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Prototipos/i })).not.toBeInTheDocument();
    expect(screen.queryByText("PRT-2026-000099")).not.toBeInTheDocument();
  });
});
