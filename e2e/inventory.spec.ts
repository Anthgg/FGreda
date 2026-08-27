import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { hasE2ECredentials } from "./helpers/fixtures";

test.describe("Inventario", () => {
  test.skip(!hasE2ECredentials, "E2E_EMAIL/E2E_PASSWORD no configuradas");

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/inventario");
  });

  test("lista existencias reales por producto y ubicacion", async ({ page }) => {
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 15_000 });
  });

  test("el saldo no es un campo editable en la tabla (el ajuste es una accion explicita)", async ({ page }) => {
    const firstRow = page.locator("table tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 15_000 });
    await expect(firstRow.getByRole("textbox")).toHaveCount(0);
    await expect(firstRow.locator("input[type='number']")).toHaveCount(0);
  });
});

test.describe("Inventario: permisos (limitacion conocida)", () => {
  // No existe una segunda cuenta de prueba con rol no-admin en este entorno:
  // no se inventa una. INVENTORY_PERMISSION_BYPASS queda NOT_VERIFIED hasta
  // que se disponga de un usuario OPERATOR/no-admin real para probar contra
  // el, tal como pide la regla de "backend es la autoridad final".
  test.skip(true, "INVENTORY_PERMISSION_BYPASS: NOT_VERIFIED — falta una cuenta de prueba con rol no-admin real");
});
