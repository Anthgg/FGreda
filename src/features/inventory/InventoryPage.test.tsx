import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, mockFetch, renderApp, sessionResponse, csrfResponse } from "@/test/utils";

function mockInventory(productType: "FINISHED_PRODUCT" | "RAW_MATERIAL") {
  let quantity = 20;
  let deliveries = 0;
  let payload: Record<string, unknown> | null = null;
  const fetch = mockFetch((url, init) => {
    const path = new URL(url, "http://localhost").pathname;
    if (path.endsWith("/auth/me")) return sessionResponse();
    if (path.endsWith("/auth/csrf")) return csrfResponse();
    if (path.endsWith("/inventory/locations")) return jsonResponse(200, [{ id: 4, name: "Almacén de producto terminado", active: true }]);
    if (path.endsWith("/inventory/movements")) return jsonResponse(200, { items: [], total: 0, limit: 50, offset: 0 });
    if (path.endsWith("/products/77")) {
      return jsonResponse(200, { id: 77, internal_reference: "PT-0077", name: "Taza terminada", product_type: productType, active: true });
    }
    if (path.endsWith("/inventory/deliveries") && init.method === "POST") {
      payload = JSON.parse(String(init.body)) as Record<string, unknown>;
      quantity -= Number(payload.quantity);
      deliveries += 1;
      return jsonResponse(201, { id: deliveries, product_id: 77, location_id: 4, quantity: `-${payload.quantity}`, balance_after: String(quantity), movement_type: "DELIVERY_OUT" });
    }
    if (path.endsWith("/inventory")) {
      return jsonResponse(200, {
        items: [{ product_id: 77, internal_reference: "PT-0077", product_name: "Taza terminada", location_id: 4, location_name: "Almacén de producto terminado", uom_code: "un", quantity: String(quantity) }],
        total: 1,
        limit: 100,
        offset: 0,
      });
    }
    return jsonResponse(200, { items: [], total: 0, limit: 20, offset: 0 });
  });
  return { fetch, getPayload: () => payload, getDeliveries: () => deliveries };
}

afterEach(() => vi.unstubAllGlobals());

describe("entrega desde inventario", () => {
  it("valida cantidad positiva, registra una entrega parcial e invalida el saldo", async () => {
    const api = mockInventory("FINISHED_PRODUCT");
    const user = userEvent.setup();
    renderApp(["/inventario"]);

    expect(await screen.findByText("20", { selector: "td" })).toBeInTheDocument();
    const initialReads = api.fetch.mock.calls.filter(([url]) => new URL(String(url), "http://localhost").pathname.endsWith("/inventory")).length;
    await user.click(screen.getByRole("button", { name: /Entrega/ }));
    const form = await screen.findByRole("region", { name: "Registrar entrega" });
    expect(form).toHaveTextContent(/disponible: 20 un/);

    const quantity = within(form).getByLabelText(/Cantidad a entregar/);
    await user.type(quantity, "0");
    expect(within(form).getByRole("button", { name: "Registrar entrega" })).toBeDisabled();
    expect(api.getDeliveries()).toBe(0);
    await user.clear(quantity);
    await user.type(quantity, "8");
    await user.type(within(form).getByLabelText(/Motivo/), "Pedido cliente");
    await user.click(within(form).getByRole("button", { name: "Registrar entrega" }));

    await waitFor(() => expect(screen.getByText("12", { selector: "td" })).toBeInTheDocument());
    expect(api.getPayload()).toMatchObject({ product_id: 77, location_id: 4, quantity: "8", reason: "Pedido cliente" });
    expect(api.fetch.mock.calls.filter(([url]) => new URL(String(url), "http://localhost").pathname.endsWith("/inventory")).length).toBeGreaterThan(initialReads);
    expect(screen.getByRole("status")).toHaveTextContent(/Producción completada y entrega son movimientos separados/);
  });

  it("no ofrece registrar entrega cuando el saldo es materia prima", async () => {
    mockInventory("RAW_MATERIAL");
    const user = userEvent.setup();
    renderApp(["/inventario"]);

    await user.click(await screen.findByRole("button", { name: /Entrega/ }));
    const form = await screen.findByRole("region", { name: "Registrar entrega" });
    expect(within(form).getByRole("status")).toHaveTextContent(/sólo aplica a producto terminado/);
    expect(within(form).queryByLabelText("Cantidad a entregar")).not.toBeInTheDocument();
    expect(within(form).queryByRole("button", { name: "Registrar entrega" })).not.toBeInTheDocument();
  });
});
