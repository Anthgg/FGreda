import { expect, test, type Page } from "@playwright/test";

import { createApiSession, firingsCount, inventoryMovementsCount } from "./helpers/api";
import { login } from "./helpers/auth";
import { hasE2ECredentials, testName } from "./helpers/fixtures";

/**
 * Fase 009C — quemas opcionales y multi-hornada, contra el ambiente real.
 *
 * El backend es la autoridad del calculo: aqui se comprueba que la UI deja
 * elegir baja y alta por separado y que muestra el plan de hornadas que ese
 * calculo devuelve, sin recalcular nada por su cuenta.
 *
 * Politica no destructiva heredada de 009A/009B: borradores con prefijo
 * E2E-, nunca se muta el maestro y planificar jamas crea una quema real.
 */

const DAYS_PER_BATCH = 3;

/** Crea un borrador con una pieza y deja abierto el paso Produccion. */
async function startDraftInProduction(page: Page, label: string): Promise<void> {
  await page.goto("/cotizador/nuevo");
  await page.getByLabel(/nombre \/ referencia/i).fill(testName(label));
  await page.getByRole("combobox", { name: "Cliente" }).click();
  // options[0] es el placeholder "Sin cliente asignado"; ver e2e/README.
  const firstCustomer = page.getByRole("option").nth(1);
  await expect(firstCustomer).toBeVisible();
  await firstCustomer.click();
  await page.getByRole("button", { name: "Crear borrador" }).click();
  await expect(page.getByRole("button", { name: "Anular" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /^2\s*Piezas/i }).click();
  await page.getByRole("button", { name: /agregar producto/i }).click();
  await page.getByRole("combobox", { name: "Pieza terminada" }).first().click();
  const firstProduct = page.getByRole("option").first();
  await expect(firstProduct).toBeVisible();
  await firstProduct.click();

  await page.getByRole("button", { name: /^3\s*Producción/i }).click();
}

/** Elige el primer horno disponible para una quema. */
async function pickKiln(page: Page, label: string): Promise<void> {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option").first().click();
}

/** Lee el valor mostrado junto a una etiqueta del plan de hornadas. */
async function planValue(page: Page, label: string): Promise<string> {
  return (await page.getByText(label, { exact: true }).first().locator("+ dd").innerText()).trim();
}

test.describe("Cotizador: planificacion de quemas (Fase 009C)", () => {
  test.skip(!hasE2ECredentials, "E2E_EMAIL/E2E_PASSWORD no configuradas");

  test("CASO 1 LOW_ONLY: solo quema baja, su horno queda y el de alta desaparece", async ({
    page,
  }) => {
    await login(page);
    await startDraftInProduction(page, "Prod-LowOnly");

    const low = page.getByRole("checkbox", { name: "Quema baja" });
    const high = page.getByRole("checkbox", { name: "Quema alta" });
    await expect(low).toBeChecked();
    await expect(high).toBeChecked();

    await high.uncheck();
    await expect(high).not.toBeChecked();
    await expect(low).toBeChecked();
    await expect(page.getByRole("combobox", { name: "Horno de quema baja" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Horno de quema alta" })).toHaveCount(0);
  });

  test("CASO 2 HIGH_ONLY: solo quema alta", async ({ page }) => {
    await login(page);
    await startDraftInProduction(page, "Prod-HighOnly");

    await page.getByRole("checkbox", { name: "Quema baja" }).uncheck();

    await expect(page.getByRole("checkbox", { name: "Quema alta" })).toBeChecked();
    await expect(page.getByRole("combobox", { name: "Horno de quema alta" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Horno de quema baja" })).toHaveCount(0);
  });

  test("CASO 3 LOW_AND_HIGH: ambas quemas conviven y suman hornadas", async ({ page }) => {
    await login(page);
    await startDraftInProduction(page, "Prod-Both");

    await pickKiln(page, "Horno de quema baja");
    await pickKiln(page, "Horno de quema alta");
    await page.getByPlaceholder("Ej. 24").first().fill("1");

    // Dos quemas -> dos planes de hornadas visibles.
    await expect(page.getByText("Hornadas necesarias", { exact: true })).toHaveCount(2, {
      timeout: 20_000,
    });
  });

  test("CASO 4 + 5 + 6: una hornada dentro de capacidad, mas de una al excederla", async ({
    page,
  }) => {
    await login(page);
    await startDraftInProduction(page, "Prod-Batches");

    await page.getByRole("checkbox", { name: "Quema alta" }).uncheck();
    await pickKiln(page, "Horno de quema baja");

    const quantity = page.getByPlaceholder("Ej. 24").first();
    await quantity.fill("1");
    await expect(page.getByText("Hornadas necesarias", { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    const fewBatches = Number(await planValue(page, "Hornadas necesarias"));
    expect(fewBatches).toBeGreaterThanOrEqual(1);
    const fewDays = await planValue(page, "Tiempo");
    expect(fewDays).toBe(`${fewBatches * DAYS_PER_BATCH} días`);

    // Mucha mas cantidad: el mismo horno necesita mas hornadas y el costo y
    // los dias crecen con ellas.
    await quantity.fill("5000");
    await expect
      .poll(async () => Number(await planValue(page, "Hornadas necesarias")), { timeout: 20_000 })
      .toBeGreaterThan(fewBatches);

    const manyBatches = Number(await planValue(page, "Hornadas necesarias"));
    expect(await planValue(page, "Tiempo")).toBe(`${manyBatches * DAYS_PER_BATCH} días`);
    await expect(page.getByText(new RegExp(`Total ${manyBatches} hornadas`, "i"))).toBeVisible();
  });

  test("CASO 7: una medida personalizada mayor puede aumentar las hornadas", async ({ page }) => {
    await login(page);
    await startDraftInProduction(page, "Prod-Dims");

    await page.getByRole("checkbox", { name: "Quema alta" }).uncheck();
    await pickKiln(page, "Horno de quema baja");
    await page.getByPlaceholder("Ej. 24").first().fill("50");
    await expect(page.getByText("Hornadas necesarias", { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    const standardBatches = Number(await planValue(page, "Hornadas necesarias"));

    // Medida personalizada mucho mayor (Fase 009B) -> mas volumen por pieza.
    await page.getByRole("button", { name: /^2\s*Piezas/i }).click();
    await page.getByRole("radio", { name: /personalizar medidas/i }).click();
    await page.getByLabel(/ancho \(cm\)/i).fill("60");
    await page.getByLabel(/alto \(cm\)/i).fill("60");
    await page.getByLabel(/largo \(cm\)/i).fill("60");
    await page.getByRole("button", { name: /^3\s*Producción/i }).click();

    await expect
      .poll(async () => Number(await planValue(page, "Hornadas necesarias")), { timeout: 20_000 })
      .toBeGreaterThanOrEqual(standardBatches);
  });

  test("CASO 8: guardar y reabrir conserva la seleccion de quemas", async ({ page }) => {
    await login(page);
    await startDraftInProduction(page, "Prod-Reopen");

    await page.getByRole("checkbox", { name: "Quema alta" }).uncheck();
    await pickKiln(page, "Horno de quema baja");
    await page.getByPlaceholder("Ej. 24").first().fill("1");
    await page.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(page.getByText(/borrador guardado y recalculado/i)).toBeVisible({
      timeout: 20_000,
    });

    await page.reload();
    // El wizard reabre en Datos: hay que volver a Produccion.
    await page.getByRole("button", { name: /^3\s*Producción/i }).click();
    await expect(page.getByRole("checkbox", { name: "Quema baja" })).toBeChecked({
      timeout: 20_000,
    });
    await expect(page.getByRole("checkbox", { name: "Quema alta" })).not.toBeChecked();
  });

  test("CASO 10: planificar no crea quemas reales ni mueve inventario", async ({ page }) => {
    const api = await createApiSession();
    try {
      const firingsBefore = await firingsCount(api);
      const movementsBefore = await inventoryMovementsCount(api);

      await login(page);
      await startDraftInProduction(page, "Prod-NoMutation");
      await page.getByRole("checkbox", { name: "Quema alta" }).uncheck();
      await pickKiln(page, "Horno de quema baja");
      // Cantidad grande: mucha planificacion de hornadas, cero realidad.
      await page.getByPlaceholder("Ej. 24").first().fill("5000");
      await page.getByRole("button", { name: "Guardar borrador" }).click();
      await expect(page.getByText(/borrador guardado y recalculado/i)).toBeVisible({
        timeout: 20_000,
      });

      expect(await firingsCount(api)).toBe(firingsBefore);
      expect(await inventoryMovementsCount(api)).toBe(movementsBefore);
    } finally {
      await api.dispose();
    }
  });

  test("VALIDACION: sin ninguna quema seleccionada se avisa y no se puede completar", async ({
    page,
  }) => {
    await login(page);
    await startDraftInProduction(page, "Prod-NoFiring");

    await page.getByRole("checkbox", { name: "Quema baja" }).uncheck();
    await page.getByRole("checkbox", { name: "Quema alta" }).uncheck();

    await expect(page.getByRole("alert").filter({ hasText: /al menos una quema/i })).toBeVisible();

    await page.getByRole("button", { name: /^6\s*Resumen/i }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/borrador incompleto/i)).toBeVisible({ timeout: 20_000 });
  });
});
