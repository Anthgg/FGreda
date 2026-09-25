import { test, expect } from "@playwright/test";
import { interceptarApi, vigilarConsola, COTIZACION } from "./support/cotizadorV2NextMocks";

test.describe("Cotizador V2 Next - Cliente", () => {
  test("abrir paso cliente, cambiar a Dólares y verificar tipo de cambio", async ({ page }) => {
    const erroresConsola = vigilarConsola(page);
    
    // Intercept API with specific response when getting quotation to allow USD
    let isUSD = false;
    const escrituras = await interceptarApi(page, (ruta, metodo, cuerpo) => {
      if (metodo === "GET" && ruta.endsWith("/quotations-v2/7")) {
        return {
          ...COTIZACION,
          currency_code: isUSD ? "USD" : "PEN",
          exchange_rate: isUSD ? "3.80" : null,
        };
      }
      if (metodo === "PUT" && ruta.endsWith("/quotations-v2/7")) {
        const body = cuerpo as Record<string, unknown>;
        if (body.currency_code === "USD") {
          isUSD = true;
          return { ...COTIZACION, currency_code: "USD", exchange_rate: "3.80" };
        }
      }
      return undefined; // fall back to default
    });

    await page.goto("/cotizador-v2/7/cliente");

    // Esperar a que el título del paso cargue (del shell)
    await expect(page.getByRole("heading", { level: 2, name: "Cliente", exact: true })).toBeVisible();

    // Verificamos que al principio es PEN (Soles)
    await expect(page.getByRole("radio", { name: "Soles" })).toBeChecked();
    await expect(page.locator("text=Tipo de cambio")).not.toBeVisible();

    // Cambiar a Dólares
    await page.getByRole("radio", { name: "Dólares" }).click();

    // Esperamos que el UI se actualice y muestre "Tipo de cambio"
    await expect(page.getByRole("radio", { name: "Dólares" })).toBeChecked();
    const inputTC = page.getByLabel("Tipo de cambio");
    await expect(inputTC).toBeVisible();
    
    // Verificar que sea obligatorio (si el HTML5 validation applies) o al menos visible
    // "El tipo de cambio aparece solo en USD y es obligatorio."
    await expect(inputTC).toHaveAttribute("required", "");

    // Verificamos la mutación 
    const putMoneda = escrituras.find(e => e.metodo === "PUT" && (e.cuerpo as Record<string, unknown>).currency_code === "USD");
    expect(putMoneda).toBeDefined();

    // Comprobamos desborde
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Esperamos un momento para el layout
    await page.waitForTimeout(500);

    const isOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(isOverflowing).toBe(false);

    // Consola limpia
    expect(erroresConsola).toEqual([]);
  });
});
