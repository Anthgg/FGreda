import { expect } from "@playwright/test";
import { test } from "./w4-test";
import {
  interceptarApi,
  COTIZACION,
  vigilarConsola,
  type Escritura,
} from "./support/cotizadorV2NextMocks";

test.describe("Cotizador V2 Next - Paso Piezas", () => {
  let erroresConsola: string[] = [];
  let escrituras: Escritura[] = [];

  test.beforeEach(async ({ page }) => {
    erroresConsola = vigilarConsola(page);

    escrituras = await interceptarApi(page, (ruta, metodo) => {
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

    await page.goto(`/cotizador-v2/${COTIZACION.id}/productos`);
  });

  test.afterEach(() => {
    expect(erroresConsola, "Consola limpia").toEqual([]);
  });

  test("pulsar + 5 veces rápido -> exactamente 1 PUT con la cantidad final", async ({ page }) => {
    const btnPlus = page.getByRole("button", { name: "Más" }).first();

    // Pulsar 5 veces rápido
    await btnPlus.click();
    await btnPlus.click();
    await btnPlus.click();
    await btnPlus.click();
    await btnPlus.click();

    // Esperar los 600ms del debouncer y un poco más
    await page.waitForTimeout(800);

    const puts = escrituras.filter(
      (escritura) =>
        escritura.metodo === "PUT" &&
        escritura.ruta === `/api/v1/quotations-v2/${COTIZACION.id}/products/1`,
    );
    expect(puts).toHaveLength(1);
    expect(puts[0]?.cuerpo).toEqual({ quantity: 6 });
  });

  test("el diálogo de quitar cubre la ventana", async ({ page }) => {
    await page.getByRole("button", { name: "Quitar Plato hondo" }).click();
    
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
