import { test, expect } from "@playwright/test";
import { interceptarApi, COTIZACION } from "./support/cotizadorV2NextMocks";

test.describe("Cotizador V2 Next - Paso Piezas", () => {
  test.beforeEach(async ({ page }) => {
    const errorLogs: string[] = [];
    page.on("pageerror", (err) => errorLogs.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errorLogs.push(msg.text());
    });

    await interceptarApi(page, (ruta, metodo) => {
      if (ruta === `/api/v1/quotations-v2/${COTIZACION.id}/products` && metodo === "GET") {
        return {
          items: [
            {
              id: 1,
              product_id: 101,
              product_name: "Plato hondo",
              quantity: 1,
              length_cm: "20.0",
              width_cm: "20.0",
              height_cm: "5.0",
              unit_volume_cm3: "2000.0",
              total_volume_cm3: "2000.0",
              firing_occupancy_percent: "3.10",
              firing_volume_share_percent: "100.00",
              warnings: [],
            },
          ],
          materials_cost: "0",
        };
      }
    });

    await page.goto(`/cotizaciones-v2/${COTIZACION.id}/editar/piezas`);
    
    test.info().annotations.push({ type: "errors", description: errorLogs.join("\n") });
  });

  test.afterEach(() => {
    const errors = test.info().annotations.find((a) => a.type === "errors")?.description;
    expect(errors, "Consola limpia").toBe("");
  });

  test("pulsar + 5 veces rápido -> exactamente 1 PUT con la cantidad final", async ({ page }) => {
    let putCount = 0;
    let putPayload: Record<string, unknown> | null = null;

    await page.route(`**/api/v1/quotations-v2/${COTIZACION.id}/products/1`, async (route) => {
      if (route.request().method() === "PUT") {
        putCount++;
        putPayload = JSON.parse(route.request().postData() || "{}");
        await route.fulfill({ status: 200, json: {} });
      } else {
        await route.continue();
      }
    });

    const btnPlus = page.getByRole("button", { name: "Más" }).first();
    
    // Pulsar 5 veces rápido
    await btnPlus.click();
    await btnPlus.click();
    await btnPlus.click();
    await btnPlus.click();
    await btnPlus.click();

    // Esperar los 600ms del debouncer y un poco más
    await page.waitForTimeout(800);

    expect(putCount).toBe(1);
    expect(putPayload).toEqual({ quantity: 6 });
  });

  test("el diálogo de quitar cubre la ventana", async ({ page }) => {
    await page.getByRole("button", { name: "Quitar" }).first().click();
    
    const dialog = page.getByRole("dialog", { name: "¿Quitar pieza?" });
    await expect(dialog).toBeVisible();

    // Verificar que un overlay fijo cubre la ventana
    // Buscamos un elemento con fixed inset-0 que es el contenedor del dialog
    const overlay = dialog.locator(".."); // The parent of the dialog
    const box = await overlay.boundingBox();
    const viewport = page.viewportSize();
    
    expect(box?.x).toBe(0);
    expect(box?.y).toBe(0);
    expect(box?.width).toBe(viewport?.width);
    expect(box?.height).toBe(viewport?.height);
  });

  test("sin desborde horizontal a 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Verificar que no hay scroll horizontal evaluando el scrollWidth del body vs clientWidth
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    
    expect(hasHorizontalScroll).toBe(false);
  });
});
