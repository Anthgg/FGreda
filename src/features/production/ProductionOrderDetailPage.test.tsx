import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { jsonResponse, mockFetch, renderApp, sessionResponse } from "@/test/utils";
import type { ProductionOrder } from "@/types/production";
import type { QuotationPaymentStatus } from "@/types/quotations";

function orden(payment: QuotationPaymentStatus | null): ProductionOrder {
  return {
    id: 2,
    code: "OP-2026-000002",
    status: "CREATED",
    quotation_id: 349,
    quotation_code: "CTZ-2026-000349",
    quotation_customer_name: "ANA MARIA CISNEROS",
    quotation_payment_status: payment,
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
    // Hay material de sobra: lo único que puede faltar es el cobro.
    readiness: { ready: true, issues: [] },
  };
}

function backend(payment: QuotationPaymentStatus | null) {
  return mockFetch((url) => {
    if (url.includes("/auth/me")) return sessionResponse();
    if (url.includes("/production-orders/2")) return jsonResponse(200, orden(payment));
    return jsonResponse(200, {});
  });
}

describe("arrancar producción y el cobro", () => {
  it("cobrada y con material: se ofrece arrancar", async () => {
    backend("PAID");

    renderApp(["/produccion/2"]);

    expect(await screen.findByRole("button", { name: /arrancar producción/i })).toBeInTheDocument();
    expect(screen.queryByText(/pendiente de pago/i)).not.toBeInTheDocument();
  });

  it("sin cobrar no se ofrece arrancar, y se dice por qué", async () => {
    // FRONT_UNPAID_START_DISABLED + FRONT_PAYMENT_REQUIREMENT_VISIBLE.
    // Quitar el botón sin explicar nada deja a quien está en el taller
    // buscando un problema de almacén que no existe.
    backend("UNPAID");

    renderApp(["/produccion/2"]);

    expect(await screen.findByText(/cotización pendiente de pago/i)).toBeInTheDocument();
    expect(
      screen.getByText(/debe estar pagada para iniciar la producción/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /arrancar producción/i })).not.toBeInTheDocument();
  });

  it("«no consta» tampoco alcanza", async () => {
    // El nulo es lo anterior a 009H. No es «impagada», pero para gastar
    // material hace falta un cobro registrado.
    backend(null);

    renderApp(["/produccion/2"]);

    expect(await screen.findByText(/cotización pendiente de pago/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /arrancar producción/i })).not.toBeInTheDocument();
  });

  it("el aviso lleva a la cotización, porque quien fabrica no cobra", async () => {
    backend("UNPAID");

    renderApp(["/produccion/2"]);

    await screen.findByText(/cotización pendiente de pago/i);

    // Por destino y no por el texto del enlace: lo que importa es a dónde
    // lleva. El nombre accesible incluye la flecha y depende de cómo se
    // componga, así que afirmarlo por texto probaría la maquetación.
    const enlaces = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(enlaces).toContain("/cotizaciones/349");
  });
});
