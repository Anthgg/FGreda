import { expect } from "@playwright/test";
import { test } from "./w4-test";

import {
  COTIZACION,
  interceptarApi,
  PRECIO,
  vigilarConsola,
} from "./support/cotizadorV2NextMocks";

/**
 * Paso «Precio» del Cotizador V2 rediseñado, en Chromium (010O.10).
 *
 * Con la API interceptada: sin backend ni credenciales. Comprueba lo que jsdom
 * no puede: que ARRASTRAR el deslizador de verdad —con ratón y con teclado—
 * produce una sola escritura, y que el paso no desborda en un teléfono.
 */

test.describe("Paso «Precio» del rediseño (010O.10)", () => {
  test("arrastrar el factor con el ratón manda una sola escritura", async ({ page }) => {
    const errores = vigilarConsola(page);
    const escrituras = await interceptarApi(page, (ruta, metodo, cuerpo) =>
      ruta.endsWith("/quotations-v2/7/pricing") && metodo === "PUT"
        ? { ...PRECIO, commercial_factor: String((cuerpo as { commercial_factor: string }).commercial_factor) }
        : undefined,
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/cotizador-v2/7/precio");

    const deslizador = page.getByRole("slider", { name: "Multiplicar el costo por" });
    await expect(deslizador).toBeVisible();
    await expect(page.getByTestId("v2next-factor-valor")).toHaveText("×3.00");

    const caja = await deslizador.boundingBox();
    if (!caja) throw new Error("el deslizador no tiene caja");
    const y = caja.y + caja.height / 2;
    await page.mouse.move(caja.x + caja.width - 4, y);
    await page.mouse.down();
    for (let paso = 1; paso <= 12; paso += 1) {
      await page.mouse.move(caja.x + caja.width - 4 - paso * ((caja.width - 8) / 12), y);
    }
    await page.mouse.up();

    await expect(page.getByTestId("v2next-factor-valor")).toHaveText("×2.00");
    await expect.poll(() => escrituras.length).toBe(1);
    // Ni una más al quedarse quieto.
    await page.waitForTimeout(900);
    expect(escrituras).toEqual([
      { metodo: "PUT", ruta: "/api/v1/quotations-v2/7/pricing", cuerpo: { commercial_factor: "2" } },
    ]);
    expect(errores).toEqual([]);
  });

  test("con el teclado también: una escritura tras dejar de pulsar", async ({ page }) => {
    const escrituras = await interceptarApi(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/cotizador-v2/7/precio");

    const deslizador = page.getByRole("slider", { name: "Multiplicar el costo por" });
    await deslizador.focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByTestId("v2next-factor-valor")).toHaveText("×2.50");
    await expect.poll(() => escrituras.length, { timeout: 3000 }).toBe(1);
    expect(escrituras[0]?.cuerpo).toEqual({ commercial_factor: "2.5" });
  });

  test("en dólares: el precio en US$ y los costos en soles", async ({ page }) => {
    await interceptarApi(page, (ruta) => {
      if (ruta.endsWith("/quotations-v2/7")) {
        return { ...COTIZACION, currency_code: "USD", currency_symbol: "US$", exchange_rate: "3.75" };
      }
      if (ruta.endsWith("/quotations-v2/7/pricing")) {
        return { ...PRECIO, currency_code: "USD", subtotal: "754.67", total: "890.51" };
      }
      return undefined;
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/cotizador-v2/7/precio");

    await expect(page.getByTestId("v2next-subtotal")).toHaveText("US$ 754.67");
    await expect(page.getByTestId("v2next-precio-total")).toHaveText("US$ 890.51");
    await expect(page.getByTestId("v2next-costo-produccion")).toHaveText("S/ 943.00");
  });

  test("a 375 px el paso no desborda la página", async ({ page }) => {
    await interceptarApi(page);
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto("/cotizador-v2/7/precio");
    await expect(page.getByTestId("v2next-paso-precio")).toBeVisible();

    const desborde = await page.evaluate(() => {
      const principal = document.querySelector("main") as HTMLElement;
      return principal.scrollWidth - principal.clientWidth;
    });
    expect(desborde).toBeLessThanOrEqual(0);
  });
});
