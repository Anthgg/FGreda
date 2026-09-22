import { expect, test } from "@playwright/test";

import { login } from "../helpers/auth";

test.describe("Mapa interactivo de distribución física del horno (Fase 010M - M4)", () => {
  test("navega desde hornadas al mapa físico y renderiza el viewport SVG sin datos comerciales", async ({
    page,
  }) => {
    await login(page);

    // 1. Ir al listado de hornadas
    await page.goto("/produccion/hornadas");
    await expect(page.getByRole("heading", { name: "Hornadas." })).toBeVisible();

    // 2. Si hay hornadas, hacer clic en el enlace al mapa
    const mapLink = page.getByRole("link", { name: /mapa y distribución del horno/i });
    if (await mapLink.isVisible()) {
      await mapLink.click();

      // 3. Validar URL
      await expect(page).toHaveURL(/\/produccion\/hornadas\/\d+\/mapa/);

      // 4. Validar cabecera operativa y SVG
      await expect(
        page.getByRole("heading", { name: /mapa de distribución física del horno/i }),
      ).toBeVisible();

      // 5. Validar que el lienzo SVG esté presente
      const svg = page.locator("svg[viewBox]");
      await expect(svg.first()).toBeVisible();

      // 6. Validar que no existan campos comerciales (precios, costos, IGV, márgenes)
      await expect(page.getByText(/s\/\./i)).not.toBeVisible();
      await expect(page.getByText(/subtotal/i)).not.toBeVisible();
      await expect(page.getByText(/igv/i)).not.toBeVisible();
      await expect(page.getByText(/margen/i)).not.toBeVisible();
    }
  });
});
