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

test.describe("Inventario: permisos", () => {
  // INVENTORY_PERMISSION_BYPASS ya no esta sin verificar: se comprueba en el
  // gate de revision con un operador sembrado en local
  // (e2e/revision/cotizador-v2-pre010i.spec.ts, «A2H-002 inventario»), leyendo
  // la politica que existe y no una inventada: ajustar existencia es del
  // TALLER —el operador puede—, y abrir un almacen es administrativo —POST
  // /inventory/locations responde 403—.
  //
  // Contra produccion no se repite: haria falta crear ahi una cuenta no-admin.
  test.skip(
    true,
    "Verificado en el gate de revision (e2e/revision/cotizador-v2-pre010i.spec.ts, " +
      "«A2H-002 inventario»): el smoke de produccion no aprovisiona cuentas no-admin",
  );
});
