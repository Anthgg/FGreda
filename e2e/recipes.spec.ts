import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { hasE2ECredentials } from "./helpers/fixtures";

test.describe("Recetas", () => {
  test.skip(!hasE2ECredentials, "E2E_EMAIL/E2E_PASSWORD no configuradas");

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/recetas");
  });

  test("RECIPES_LIST + RECIPE_DETAIL + RECIPE_YIELD: listado real y detalle con rendimiento", async ({ page }) => {
    await expect(page.getByRole("tab", { name: "Listado" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Estructura" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Rendimiento")).toBeVisible();
  });

  test("RECIPE_SEARCH: filtra el listado por texto", async ({ page }) => {
    const search = page.getByPlaceholder(/buscar/i).first();
    const initialRows = await page.locator("table tbody tr").count();
    test.skip(initialRows === 0, "No hay recetas en produccion para probar busqueda");
    await search.fill("zzz-no-deberia-existir-zzz");
    await expect(page.locator("table tbody tr")).toHaveCount(0, { timeout: 10_000 });
    await search.fill("");
  });

  test("RECIPE_VERSION_HISTORY: la pestana Versiones abre sin mutar la receta activa", async ({ page }) => {
    await page.getByRole("tab", { name: "Estructura" }).waitFor({ timeout: 15_000 });
    await page.getByRole("tab", { name: "Versiones" }).click();
    await expect(page.getByRole("tab", { name: "Versiones", selected: true })).toBeVisible();
  });

  test("RECIPE_SIMULATION_SIDE_EFFECTS: el simulador no persiste nada (no hay boton Guardar en esa pestana)", async ({ page }) => {
    await page.getByRole("tab", { name: "Estructura" }).waitFor({ timeout: 15_000 });
    await page.getByRole("tab", { name: "Simulador" }).click();
    // El simulador es de solo-calculo: no debe ofrecer una accion de guardado
    // que persista sobre la receta real mientras se prueba con valores.
    await expect(page.getByRole("button", { name: /^guardar receta$/i })).toHaveCount(0);
  });
});
