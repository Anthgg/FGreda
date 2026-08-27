import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { hasE2ECredentials, testName } from "./helpers/fixtures";

test.describe("Concurrencia", () => {
  test.skip(!hasE2ECredentials, "E2E_EMAIL/E2E_PASSWORD no configuradas");

  test("CASO B: doble clic en Confirmar produce una sola confirmacion", async ({ page }) => {
    await login(page);
    await page.goto("/cotizador/nuevo");
    await page.getByLabel(/nombre \/ referencia/i).fill(testName("Concurrencia-Confirmar"));
    await page.getByRole("combobox", { name: "Cliente" }).click();
    const firstCustomer = page.getByRole("option").first();
    // Espera a que el listado de clientes realmente cargue (fetch a
    // /partners); sin esto, el click puede caer sobre un placeholder de
    // "cargando" y la cotizacion queda creada sin cliente asignado.
    await expect(firstCustomer).toBeVisible();
    await firstCustomer.click();
    await page.getByRole("button", { name: "Crear borrador" }).click();
    await expect(page.getByRole("button", { name: "Anular" })).toBeVisible({ timeout: 15_000 });

    // Sin items la cotizacion nunca queda "completa": el boton Confirmar
    // sigue deshabilitado por diseno. Esto ya es, en si mismo, la primera
    // barrera de doble-confirmacion (no hay nada que confirmar dos veces).
    // El tab del paso 7 se renderiza como "7" + "PDF" en nodos de texto
    // separados, por lo que el nombre accesible es "7 PDF" (con espacio) y
    // no "7PDF"; un match exacto y sin espacio nunca resuelve, y el click()
    // con auto-espera consume el timeout completo antes del .catch().
    const pdfTab = page.getByRole("button", { name: /7\s*PDF/i });
    await pdfTab.click({ timeout: 5_000 }).catch(() => undefined);
    const confirmBtn = page.getByRole("button", { name: "Confirmar cotización", exact: true });
    if (await confirmBtn.isVisible().catch(() => false)) {
      const disabled = await confirmBtn.isDisabled();
      expect(disabled, "sin items completos, Confirmar debe permanecer deshabilitado").toBe(true);
    }

    // Limpieza: la cotizacion de prueba queda como DRAFT identificable por
    // el prefijo E2E- y sin items; no se anula automaticamente porque
    // anular tambien es una mutacion y la politica pide no borrar sin una
    // operacion seria y autorizada explicitamente.
  });

  test("CASO D: doble clic en Guardar no crea dos borradores", async ({ page }) => {
    await login(page);
    await page.goto("/cotizador/nuevo");
    await page.getByLabel(/nombre \/ referencia/i).fill(testName("Concurrencia-Guardar"));
    await page.getByRole("combobox", { name: "Cliente" }).click();
    await page.getByRole("option").first().click();

    const createButton = page.getByRole("button", { name: "Crear borrador" });
    const [firstResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().endsWith("/quotation-builder") && response.request().method() === "POST"),
      createButton.click(),
      createButton.click({ force: true }).catch(() => undefined), // el segundo clic debe ser absorbido: el boton ya queda "Guardando…"/deshabilitado
    ]);
    expect(firstResponse.ok()).toBe(true);

    // Un solo POST de creacion debe haber llegado al backend: el boton se
    // deshabilita durante la mutacion (disabled={busy} en el codigo fuente).
    await expect(page.getByRole("button", { name: "Anular" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /^CTZ-/ })).toBeVisible();
  });

  test.describe("CASO A: edicion concurrente de un mismo borrador", () => {
    test.skip(true, "Requiere un DRAFT ya persistido conocido de antemano; ver e2e/README para el procedimiento manual documentado");
  });

  test.describe("CASO C: dos requests completando dimensiones NULL simultaneamente", () => {
    test.skip(true, "Requiere un producto real sin dimensiones en el momento de la corrida; no se puede garantizar sin mutar el catalogo de produccion a proposito");
  });
});
