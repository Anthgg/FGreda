/**
 * Fase 009K.1 — los cargos comerciales en pantalla.
 *
 * Lo que se protege aquí es que el navegador siga sin ser autoridad del
 * dinero: manda el importe neto que teclea una persona y muestra lo que el
 * backend devuelve. Si alguien vuelve a meter aquí un IGV, una conversión de
 * moneda o una suma de totales, estas pruebas se caen.
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CommercialLines } from "@/features/cotizador/CommercialLines";
import {
  csrfResponse,
  errorResponse,
  jsonResponse,
  mockFetch,
  renderWithProviders,
  sessionResponse,
} from "@/test/utils";
import type { CommercialLineOut } from "@/types/quotationBuilder";

const CARGO: CommercialLineOut = {
  id: 3,
  kind: "PROTOTYPE",
  description: "Prototipo PRT-2026-000007",
  prototype_id: 7,
  quantity: 1,
  manual_net_amount: "200.000000",
  sort_order: 0,
  // Derivados del backend: 200 netos + 18 % = 236 brutos.
  line_total_net: "200.000000",
  line_total_tax: "36.000000",
  line_total_gross: "236.000000",
};

function mockApi(captura?: (body: unknown) => void) {
  return mockFetch((url, init) => {
    if (url.includes("/auth/csrf")) return csrfResponse();
    if (url.includes("/auth/me")) return sessionResponse();
    if (url.includes("/commercial-lines")) {
      captura?.(init?.body ? JSON.parse(String(init.body)) : null);
      return jsonResponse(201, { id: 9, commercial_lines: [CARGO] });
    }
    return errorResponse(404, "NOT_FOUND");
  });
}

function render(props: Partial<Parameters<typeof CommercialLines>[0]> = {}) {
  renderWithProviders(
    <CommercialLines
      quotationId={9}
      lines={[]}
      currencyCode="PEN"
      editable
      {...props}
    />,
  );
}

describe("Cotizador · cargos comerciales", () => {
  it("un borrador sin cargos lo dice, en vez de no mostrar nada", () => {
    mockApi();
    render();
    expect(screen.getByText(/no tiene cargos/i)).toBeInTheDocument();
  });

  it("FRONT_COMMERCIAL_LINE_PRICING_AUTHORITY: manda el neto y nada más", async () => {
    const user = userEvent.setup();
    let enviado: unknown = null;
    mockApi((body) => {
      enviado = body;
    });
    render();

    await user.type(screen.getByLabelText(/Concepto/), "Prototipo PRT-2026-000007");
    await user.type(screen.getByLabelText(/Importe neto/), "200");
    await user.click(screen.getByRole("button", { name: "Añadir" }));

    await vi.waitFor(() => expect(enviado).not.toBeNull());
    // Ni impuesto, ni bruto, ni total: eso lo calcula el backend.
    expect(enviado).toEqual({
      kind: "PROTOTYPE",
      description: "Prototipo PRT-2026-000007",
      quantity: 1,
      manual_net_amount: "200",
    });
  });

  it("muestra los derivados que llegan del backend, no unos recalculados", () => {
    // 200 netos con IGV dan 236. Si la pantalla lo recompusiera, bastaría con
    // que el IGV cambiara para que empezara a mentir.
    mockApi();
    render({ lines: [CARGO] });

    const fila = screen.getByText(CARGO.description).closest("li");
    expect(fila).not.toBeNull();
    expect(within(fila!).getByText(/236/)).toBeInTheDocument();
  });

  it("el importe se pide en la moneda de emisión, sin convertir", async () => {
    // FRONT_COMMERCIAL_LINE_CURRENCY_CONVERSION_AUTHORITY: 0. Cotizando en
    // dólares, 200 significa doscientos dólares.
    const user = userEvent.setup();
    let enviado: unknown = null;
    mockApi((body) => {
      enviado = body;
    });
    render({ currencyCode: "USD" });

    expect(screen.getByLabelText(/Importe neto \(USD\)/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Concepto/), "Prototipo");
    await user.type(screen.getByLabelText(/Importe neto/), "200");
    await user.click(screen.getByRole("button", { name: "Añadir" }));

    await vi.waitFor(() => expect(enviado).not.toBeNull());
    expect((enviado as { manual_net_amount: string }).manual_net_amount).toBe("200");
  });

  it("FRONT_COMMERCIAL_LINE_CONFIRMED_READ_ONLY: una confirmada se ve pero no se toca", () => {
    mockApi();
    render({ lines: [CARGO], editable: false });

    expect(screen.getByText(CARGO.description)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Añadir" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar" })).not.toBeInTheDocument();
  });

  it("no se puede guardar un cargo a medio rellenar", async () => {
    const user = userEvent.setup();
    mockApi();
    render();

    const anadir = screen.getByRole("button", { name: "Añadir" });
    expect(anadir).toBeDisabled();

    await user.type(screen.getByLabelText(/Concepto/), "Prototipo");
    expect(anadir).toBeDisabled();

    await user.type(screen.getByLabelText(/Importe neto/), "50");
    expect(anadir).toBeEnabled();
  });

  it("sin cotización guardada no se ofrece añadir un cargo", () => {
    // Un borrador que todavía no existe en el servidor no tiene dónde
    // colgarlo, y ofrecerlo daría un error al pulsar.
    mockApi();
    render({ quotationId: null });
    expect(screen.queryByText(/Cargos comerciales/)).not.toBeInTheDocument();
  });
});
