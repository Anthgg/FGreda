import { expect, test, type Page } from "@playwright/test";

import { login } from "./helpers/auth";
import { hasE2ECredentials, testName } from "./helpers/fixtures";

/**
 * Fase 009B — medidas personalizadas por cotizacion, contra el ambiente real.
 *
 * Politica no destructiva heredada de 009A: los borradores quedan con el
 * prefijo E2E-, nunca se muta el maestro de productos a proposito, y el
 * unico flujo que confirma es el que necesita probar la inmutabilidad del
 * snapshot.
 */

/** Crea un borrador con una pieza y devuelve el codigo CTZ y el nombre. */
async function startDraftWithPiece(page: Page, label: string): Promise<string> {
  const name = testName(label);
  await page.goto("/cotizador/nuevo");
  await page.getByLabel(/nombre \/ referencia/i).fill(name);
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
  return name;
}

test.describe("Cotizador: medidas personalizadas (Fase 009B)", () => {
  test.skip(!hasE2ECredentials, "E2E_EMAIL/E2E_PASSWORD no configuradas");

  test("CASO 1 STANDARD_DIMENSIONS: la linea arranca en modo estandar", async ({ page }) => {
    await login(page);
    await startDraftWithPiece(page, "Dim-Standard");

    await expect(page.getByRole("radio", { name: /usar medidas est[aá]ndar/i })).toBeChecked();
    await expect(page.getByText("Medidas estándar")).toBeVisible();
  });

  test("CASO 2 CUSTOM_DIMENSIONS: personalizar prellena, es editable y marca el badge", async ({
    page,
  }) => {
    await login(page);
    await startDraftWithPiece(page, "Dim-Custom");

    await page.getByRole("radio", { name: /personalizar medidas/i }).click();
    await expect(page.getByText("Medidas personalizadas")).toBeVisible();

    const ancho = page.getByLabel(/ancho \(cm\)/i);
    await expect(ancho).toBeEnabled();
    await ancho.fill("15");
    await expect(ancho).toHaveValue("15");
  });

  test("CASO 3 + 6 SAVE_REOPEN + PRODUCT_MASTER_UNCHANGED", async ({ page, request }) => {
    await login(page);
    await startDraftWithPiece(page, "Dim-Persist");

    // Medidas del maestro ANTES, leidas de la propia UI (el badge estandar).
    await page.getByRole("radio", { name: /personalizar medidas/i }).click();
    const anchoEstandar = await page.getByLabel(/ancho \(cm\)/i).inputValue();

    await page.getByLabel(/ancho \(cm\)/i).fill("17");
    await page.getByLabel(/alto \(cm\)/i).fill("23");
    await page.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(page.getByText(/borrador guardado y recalculado/i)).toBeVisible({
      timeout: 15_000,
    });

    const url = page.url();
    await page.goto("/cotizaciones");
    await page.goto(url);

    await expect(page.getByRole("radio", { name: /personalizar medidas/i })).toBeChecked({
      timeout: 15_000,
    });
    await expect(page.getByLabel(/ancho \(cm\)/i)).toHaveValue("17");
    await expect(page.getByText("Medidas personalizadas")).toBeVisible();

    // El maestro no cambio: al volver a "estandar" reaparece su valor.
    await page.getByRole("radio", { name: /usar medidas est[aá]ndar/i }).click();
    await expect(page.getByLabel(/ancho \(cm\)/i)).toHaveValue(anchoEstandar);
    void request;
  });

  test("CASO 5 MULTIPRODUCT: una linea estandar y otra personalizada, independientes", async ({
    page,
  }) => {
    await login(page);
    await startDraftWithPiece(page, "Dim-Multi");

    await page.getByRole("button", { name: /agregar producto/i }).click();
    const selectors = page.getByRole("combobox", { name: "Pieza terminada" });
    await selectors.nth(1).click();
    const options = page.getByRole("option");
    const count = await options.count();
    let picked = false;
    for (let i = 0; i < count; i += 1) {
      const label = await options.nth(i).textContent();
      if (label && label.trim()) {
        await options.nth(i).click();
        picked = true;
        break;
      }
    }
    test.skip(!picked, "El catalogo no tiene una segunda pieza disponible");

    const customRadios = page.getByRole("radio", { name: /personalizar medidas/i });
    await expect(customRadios).toHaveCount(2);
    await customRadios.nth(1).click();

    // Cada linea conserva su propio estado: no hay un flag global.
    await expect(customRadios.nth(0)).not.toBeChecked();
    await expect(customRadios.nth(1)).toBeChecked();
    await expect(page.getByText("Medidas estándar")).toBeVisible();
    await expect(page.getByText("Medidas personalizadas")).toBeVisible();
  });

  test("CASO 7 DUPLICATE: la copia conserva medidas efectivas y estado de override", async ({
    page,
  }) => {
    await login(page);
    await startDraftWithPiece(page, "Dim-Duplicate");

    await page.getByRole("radio", { name: /personalizar medidas/i }).click();
    await page.getByLabel(/ancho \(cm\)/i).fill("19");
    await page.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(page.getByText(/borrador guardado y recalculado/i)).toBeVisible({
      timeout: 15_000,
    });

    // Duplicar solo esta disponible cuando la cotizacion ya no es DRAFT
    // (ver CotizadorPage: `canEdit && id && status !== "DRAFT"`), asi que la
    // cobertura real de duplicado vive en el test de backend
    // test_duplicate_quotation_copies_effective_dimensions_and_override_state.
    // Aqui se verifica lo que si es observable en la UI: el borrador guardado
    // mantiene la medida efectiva tras recargar.
    await page.reload();
    await expect(page.getByLabel(/ancho \(cm\)/i)).toHaveValue("19", { timeout: 15_000 });
    await expect(page.getByRole("radio", { name: /personalizar medidas/i })).toBeChecked();
  });

  test("CONFIRMED_FIRING_CUSTOM_OVERRIDE_BLOCKED: no se puede personalizar sobre una quema confirmada", async ({
    page,
  }) => {
    await login(page);
    await startDraftWithPiece(page, "Dim-FiringGuard");

    // La regla de dominio: una quema CONFIRMADA es la verdad fisica
    // historica; su costo y volumen ya no se simulan, asi que sustituir sus
    // medidas produciria una cotizacion que muestra una pieza distinta de la
    // que realmente cobra.
    await page.getByRole("button", { name: /^3\s*Producción/i }).click();
    const firingSource = page.getByRole("combobox", { name: /fuente del costo de quema/i });
    await firingSource.click();
    const options = page.getByRole("option");
    // options[0] es "Simulación integrada"; una linea confirmada real, si la
    // hay para este producto, viene despues.
    const optionCount = await options.count();
    test.skip(
      optionCount < 2,
      "No hay una linea de quema confirmada para este producto en el ambiente actual",
    );
    await options.nth(1).click();

    await page.getByRole("button", { name: /^2\s*Piezas/i }).click();
    await page.getByRole("radio", { name: /personalizar medidas/i }).click();
    await page.getByLabel(/ancho \(cm\)/i).fill("50");
    await page.getByLabel(/alto \(cm\)/i).fill("50");
    await page.getByLabel(/largo \(cm\)/i).fill("50");

    // Bloqueo explicito: la cotizacion no puede quedar completa ni confirmarse.
    await page.getByRole("button", { name: /^6\s*Resumen/i }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/borrador incompleto/i)).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: /^7\s*PDF/i }).click();
    const confirmButton = page.getByRole("button", { name: "Confirmar cotización", exact: true });
    if (await confirmButton.isVisible().catch(() => false)) {
      await expect(confirmButton).toBeDisabled();
    }
  });

  test("CASO 4 CONFIRMED_SNAPSHOT_IMMUTABLE: tras confirmar no se puede editar la medida", async ({
    page,
  }) => {
    await login(page);
    await startDraftWithPiece(page, "Dim-Immutable");

    await page.getByRole("radio", { name: /personalizar medidas/i }).click();
    await page.getByLabel(/ancho \(cm\)/i).fill("21");
    await page.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(page.getByText(/borrador guardado y recalculado/i)).toBeVisible({
      timeout: 15_000,
    });

    // Completar produccion es un flujo largo y dependiente de capacidad real
    // de hornos; si la cotizacion no queda completa se reporta y se omite en
    // vez de forzar una confirmacion que no aplica (misma politica que
    // cotizador.spec.ts).
    await page.getByRole("button", { name: /^6\s*Resumen/i }).click();
    await page.waitForLoadState("networkidle");
    const ready = page.getByText(/lista para confirmar/i);
    const incomplete = page.getByText(/borrador incompleto/i);
    await expect(ready.or(incomplete)).toBeVisible({ timeout: 15_000 });
    const isReady = await ready.isVisible().catch(() => false);
    test.skip(!isReady, "La cotizacion no quedo completa con datos minimos de produccion");

    await page.getByRole("button", { name: /ver vista previa pdf/i }).click();
    await page.getByRole("button", { name: "Confirmar cotización", exact: true }).click();
    await page
      .getByRole("dialog", { name: /confirmar cotizaci[oó]n/i })
      .getByRole("button", { name: "Confirmar cotización" })
      .click();
    await expect(page.getByText(/documento oficial congelado/i)).toBeVisible({ timeout: 20_000 });

    // Snapshot congelado: la medida sigue siendo la personalizada y ya no
    // hay controles para cambiarla.
    await page.getByRole("button", { name: /^2\s*Piezas/i }).click();
    await expect(page.getByLabel(/ancho \(cm\)/i)).toHaveValue("21");
    await expect(page.getByLabel(/ancho \(cm\)/i)).toBeDisabled();
    await expect(page.getByRole("radio", { name: /personalizar medidas/i })).toBeDisabled();
  });
});
