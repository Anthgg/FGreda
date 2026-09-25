import { expect, test } from "@playwright/test";

test.describe("Cotizador V2 Next - Lista y Alta", () => {
  test.beforeEach(async ({ page }) => {
    // 1. Interceptar el perfil
    await page.route("**/users/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          authenticated: true,
          user: { id: "1", email: "test@example.invalid", display_name: "Operador Test", role: "OPERATOR" },
        }),
      });
    });

    // 2. Interceptar el listado
    await page.route("**/quotations-v2?limit=50", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              id: 7,
              code: "V2-0007",
              pricing_engine_version: "V2",
              status: "DRAFT",
              production_type: "RETAIL",
              customer_name: "E2E Customer",
              name: "E2E Test",
              created_at: new Date().toISOString(),
              effective_status: "DRAFT",
              valid_until: null,
            }
          ],
          total: 1
        }),
      });
    });
    
    // 3. Interceptar POST para crear
    await page.route("**/quotations-v2", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ id: 7 }),
        });
      } else {
        await route.continue();
      }
    });

    // 4. Interceptar GET para el shell después de crear
    await page.route("**/quotations-v2/7", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 7,
          code: "V2-0007",
          pricing_engine_version: "V2",
          status: "DRAFT",
          production_type: "RETAIL",
          customer_id: null,
          customer_name: null,
          name: "E2E Test",
          notes: null,
          customer_kind: "EXTERNAL",
          tax_percent: "18.00",
          currency_code: "PEN",
          currency_symbol: "S/",
          exchange_rate: "1.000",
          validity_days: 15,
          workday_hours: "8.00",
          space_service_cost_per_day: "50.00",
          administrative_cost: "10.00",
          commercial_factor: "2.0",
          commercial_factor_min: "1.5",
          commercial_factor_max: "3.0",
          low_fire_enabled: true,
          high_fire_enabled: true,
          settings_version: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          client_notes: null,
          effective_status: "DRAFT",
          issued_at: null,
          valid_until: null,
          expires_at: null,
          issued_by_name: null,
          cancelled_at: null,
          cancelled_by_name: null,
          cancel_reason: null,
          duplicated_from_id: null,
          open_duplicate_id: null,
          production_handoff: null,
        }),
      });
    });
    
    // 5. Interceptar bloqueos
    await page.route("**/quotations-v2/7/confirmation-preview", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          quotation_id: 7,
          code: "V2-0007",
          status: "DRAFT",
          effective_status: "DRAFT",
          can_confirm: false,
          blockers: [{ code: "MISSING_CUSTOMER", line_id: null }],
          warnings: [],
          fingerprint: "hash",
          name: "E2E Test",
          client_notes: null,
          currency_code: "PEN",
          currency_symbol: "S/",
          exchange_rate: "1.000",
          tax_percent: "18.00",
          commercial_factor: "2.0",
          validity_days: 15,
          valid_until: null,
          subtotal_amount: "0.00",
          tax_amount: "0.00",
          total_amount: "0.00",
          lines: [],
        }),
      });
    });
  });

  test("flujo completo de creación de cotización", async ({ page }) => {
    await page.goto("/cotizador-v2-next");

    // 1. Validar que la tabla se pintó y hay un registro
    await expect(page.getByRole("heading", { name: "Cotizaciones" })).toBeVisible();
    await expect(page.getByText("E2E Customer")).toBeVisible();
    await expect(page.getByText("V2-0007")).toBeVisible();

    // 2. Abrir diálogo de alta
    await page.getByRole("button", { name: "Nueva cotización" }).click();
    const dialog = page.getByRole("dialog", { name: "Nueva cotización" });
    await expect(dialog).toBeVisible();

    // 3. Escribir nombre de pedido y enviar
    await dialog.getByLabel("Ponle un nombre (opcional)").fill("E2E Test");
    
    // Validar visualmente que no haya desbordamiento horizontal
    const viewportSize = page.viewportSize();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewportSize!.width);

    await dialog.getByRole("button", { name: "Empezar cotización" }).click();

    // 4. Validar navegación (al shell paso "Cliente")
    await expect(page).toHaveURL(/\/cotizador-v2-next\/7\/cliente/);
    await expect(page.getByRole("heading", { name: "Paso 1 de 7" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cliente" })).toBeVisible();
  });
});
