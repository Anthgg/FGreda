import { expect, test } from "@playwright/test";

test.describe("Prototipos 009K · smoke local con contrato real", () => {
  test.skip(!process.env.E2E_PROTOTYPE_LOCAL, "Solo se ejecuta contra el frontend local de la rama 009K");

  test("crear, material, reabrir, readiness, start y complete", async ({ page }) => {
    let prototype = {
      id: 7, code: "PRT-2026-000007", name: "E2E-009K-local", status: "CREATED", approval: "PENDING",
      quotation_id: null as number | null, quotation_code: null as string | null, product_id: null as number | null,
      stock_location_id: null as number | null, quantity: 1, target_days: null as number | null,
      requested_at: "2026-09-03T10:00:00Z", started_at: null as string | null, completed_at: null as string | null,
      cancelled_at: null, decided_at: null, supersedes_prototype_id: null, material_count: 0, notes: null,
      quotation_payment_status: null as "PAID" | null,
      materials: [] as Array<{ id: number; product_id: number; sort_order: number; product_name: string; product_internal_reference: string; quantity: string; uom_code: string }>,
      readiness: { ready: false, issues: [{ code: "NO_QUOTATION", product_id: null, product_name: null, required_quantity: null, available_quantity: null, uom: null }] },
    };

    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const method = request.method();
      const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (path.endsWith("/auth/me")) return json({ authenticated: true, user: { id: "e2e", email: "admin@e2e.local", display_name: "E2E Admin", role: "ADMIN" } });
      if (path.endsWith("/auth/csrf")) return json({ csrf_token: "e2e-csrf", expires_in: 3600 });
      if (path.endsWith("/products")) return json({ items: [{ id: 11, internal_reference: "MAT-011", name: "Arcilla blanca", product_type: "RAW_MATERIAL", product_category_id: 1, product_category_path: null, pos_category_id: null, pos_category_name: null, base_uom_code: "g", purchase_uom_code: "kg", cost: "1", sale_price: null, sale_tax_rate: null, purchase_tax_rate: null, sellable: false, purchasable: true, available_in_pos: false, active: true, notes: null }], total: 1, limit: 200, offset: 0 });
      if (path.endsWith("/inventory/locations")) return json([{ id: 3, name: "Almacén principal", active: true }]);
      if (path.endsWith("/quotations")) return json({ items: [{ id: 21, code: "CTZ-2026-000021", name: "Pedido E2E pagado", status: "CONFIRMED", product_id: 11, product_name: "Arcilla blanca", payment_status: "PAID", created_at: "2026-09-03", total: "10", calculated_unit_price: "10", calculated_total: "10", total_with_tax: "11.8", currency_code_snapshot: "PEN", currency_symbol_snapshot: "S/", exchange_rate_snapshot: null }], total: 1, limit: 200, offset: 0 });
      if (path.endsWith("/prototypes") && method === "GET") return json({ items: [], total: 0, limit: 25, offset: 0 });
      if (path.endsWith("/prototypes") && method === "POST") return json(prototype, 201);
      if (path.endsWith("/prototypes/7/materials") && method === "PUT") {
        prototype = { ...prototype, materials: [{ id: 1, product_id: 11, sort_order: 0, product_name: "Arcilla blanca", product_internal_reference: "MAT-011", quantity: "5", uom_code: "g" }], material_count: 1 };
        return json(prototype);
      }
      if (path.endsWith("/prototypes/7") && method === "PUT") {
        prototype = { ...prototype, quotation_id: 21, quotation_code: "CTZ-2026-000021", quotation_payment_status: "PAID", stock_location_id: 3, readiness: { ready: true, issues: [] } };
        return json(prototype);
      }
      if (path.endsWith("/prototypes/7/start") && method === "POST") {
        prototype = { ...prototype, status: "STARTED", started_at: "2026-09-03T11:00:00Z", readiness: { ready: false, issues: [{ code: "INVALID_STATE", product_id: null, product_name: null, required_quantity: null, available_quantity: null, uom: null }] } };
        return json(prototype);
      }
      if (path.endsWith("/prototypes/7/complete") && method === "POST") {
        prototype = { ...prototype, status: "COMPLETED", completed_at: "2026-09-03T12:00:00Z" };
        return json(prototype);
      }
      if (path.endsWith("/prototypes/7")) return json(prototype);
      return json({});
    });

    await page.goto("/prototipos/nuevo");
    await page.getByLabel("Nombre").fill("E2E-009K-local");
    await page.getByRole("button", { name: "Crear prototipo" }).click();
    await expect(page.getByText(/creado con código PRT-2026-000007/i)).toBeVisible();

    await page.getByRole("link", { name: "Materiales" }).click();
    await page.getByRole("button", { name: "Añadir material" }).click();
    await page.getByRole("combobox", { name: "Material" }).click();
    await page.getByRole("option", { name: /MAT-011 · Arcilla blanca/ }).click();
    await page.getByLabel(/Cantidad \(g\)/).fill("5");
    await page.getByRole("button", { name: "Guardar materiales" }).click();
    await expect(page.getByText("Materiales guardados.")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Arcilla blanca")).toBeVisible();
    await page.getByRole("link", { name: "Disponibilidad y operación" }).click();
    await expect(page.getByText(/Vincula una cotización pagada/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Iniciar fabricación" })).toHaveCount(0);

    await page.getByRole("link", { name: "Edición" }).click();
    await page.getByRole("combobox", { name: "Cotización" }).click();
    await page.getByRole("option", { name: /CTZ-2026-000021/ }).click();
    await page.getByRole("combobox", { name: "Almacén" }).click();
    await page.getByRole("option", { name: "Almacén principal" }).click();
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await page.getByRole("link", { name: "Disponibilidad y operación" }).click();
    await page.getByRole("button", { name: "Iniciar fabricación" }).click();
    await expect(page.getByText("En fabricación")).toBeVisible();
    await page.getByRole("button", { name: "Completar prototipo" }).click();
    await expect(page.getByText("Completado", { exact: true })).toBeVisible();
  });
});
